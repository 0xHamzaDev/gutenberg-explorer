import 'server-only'
import prisma from '@/lib/db'
import { z } from 'zod'

/**
 * Cache-first data access for Project Gutenberg book metadata.
 *
 * Gutendex (gutendex.com) is a slow, intermittently-unavailable third party.
 * Hitting it synchronously on every page load is why the UI hung "forever".
 * Best practice applied here:
 *   1. Every network call has a hard timeout (no more open-ended hangs).
 *   2. Postgres is the durable cache / read-model. Reads hit the DB first.
 *   3. When Gutendex is slow or down, we serve stale cache instead of failing.
 */

export interface NormalizedBook {
	id: number
	title: string
	author: string
	coverUrl: string
	subjects: string[]
	languages: string[]
	downloadCount: number
}

// Book metadata is effectively immutable on Gutenberg, so a long TTL is safe.
const BOOK_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const GUTENDEX_TIMEOUT_MS = 8000

const GutendexBookSchema = z.object({
	id: z.number(),
	title: z.string(),
	authors: z
		.array(z.object({ name: z.string() }))
		.optional()
		.default([]),
	subjects: z.array(z.string()).optional().default([]),
	languages: z.array(z.string()).optional().default([]),
	formats: z.record(z.string()).optional().default({}),
	download_count: z.number().optional().default(0)
})

const GutendexListSchema = z.object({
	results: z.array(GutendexBookSchema).optional().default([])
})

type GutendexBook = z.infer<typeof GutendexBookSchema>

function fixUrl(url: string | undefined | null): string {
	if (!url) return ''
	if (url.startsWith('http://') || url.startsWith('https://')) return url
	return `https:${url.startsWith('//') ? url : `//${url}`}`
}

// AbortController-based timeout so a stalled Gutendex request fails fast
// instead of holding the request (and the user's skeleton) open indefinitely.
async function fetchJsonWithTimeout(
	url: string,
	timeoutMs = GUTENDEX_TIMEOUT_MS
): Promise<unknown> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)
	try {
		const res = await fetch(url, { signal: controller.signal })
		if (!res.ok) throw new Error(`Gutendex HTTP ${res.status}`)
		return await res.json()
	} finally {
		clearTimeout(timer)
	}
}

function normalize(raw: GutendexBook): NormalizedBook {
	return {
		id: raw.id,
		title: raw.title,
		author: raw.authors?.[0]?.name || 'Unknown Author',
		coverUrl: fixUrl(raw.formats?.['image/jpeg']),
		subjects: raw.subjects,
		languages: raw.languages,
		downloadCount: raw.download_count
	}
}

function fromCache(row: {
	id: number
	title: string
	author: string | null
	coverUrl: string | null
	subjects: string[]
	languages: string[]
	downloadCount: number
}): NormalizedBook {
	return {
		id: row.id,
		title: row.title,
		author: row.author || 'Unknown Author',
		coverUrl: row.coverUrl || '',
		subjects: row.subjects,
		languages: row.languages,
		downloadCount: row.downloadCount
	}
}

// Write-through: keep the Postgres cache warm for every book we see, so later
// reads (and recommendations) can be served from the DB even if Gutendex is down.
async function cacheBooks(books: NormalizedBook[]): Promise<void> {
	if (books.length === 0) return
	try {
		await Promise.allSettled(
			books.map(b =>
				prisma.gutenbergBook.upsert({
					where: { id: b.id },
					create: {
						id: b.id,
						title: b.title,
						author: b.author,
						coverUrl: b.coverUrl,
						subjects: b.subjects,
						languages: b.languages,
						downloadCount: b.downloadCount
					},
					update: {
						title: b.title,
						author: b.author,
						coverUrl: b.coverUrl,
						subjects: b.subjects,
						languages: b.languages,
						downloadCount: b.downloadCount,
						cachedAt: new Date()
					}
				})
			)
		)
	} catch (error) {
		console.error('cacheBooks error:', error)
	}
}

/**
 * Single book detail, cache-first. Returns null only when the book is neither
 * cached nor reachable via Gutendex.
 */
export async function getGutenbergBook(
	id: number
): Promise<NormalizedBook | null> {
	let cached
	try {
		cached = await prisma.gutenbergBook.findUnique({ where: { id } })
	} catch (error) {
		console.error('getGutenbergBook cache read error:', error)
	}

	const isFresh =
		cached && Date.now() - cached.cachedAt.getTime() < BOOK_TTL_MS
	if (cached && isFresh) return fromCache(cached)

	try {
		const raw = await fetchJsonWithTimeout(
			`https://gutendex.com/books/${id}`
		)
		const book = normalize(GutendexBookSchema.parse(raw))
		await cacheBooks([book])
		return book
	} catch (error) {
		console.error(`getGutenbergBook fetch error (${id}):`, error)
		// Serve stale rather than nothing when the API is unavailable.
		return cached ? fromCache(cached) : null
	}
}

/**
 * Search / browse, Gutendex-first with a hard timeout. On success the results
 * are written through to the cache; on failure we degrade to the DB cache so the
 * grid still shows books instead of an endless skeleton.
 */
export async function searchGutenbergBooks(
	query: string,
	page = 1
): Promise<NormalizedBook[]> {
	const trimmed = query.trim()
	const isBrowseAll = !trimmed || trimmed.toLowerCase() === 'all'

	try {
		const url = `https://gutendex.com/books/?search=${encodeURIComponent(
			trimmed || 'all'
		)}&page=${page}`
		const raw = await fetchJsonWithTimeout(url)
		const books = GutendexListSchema.parse(raw).results.map(normalize)
		void cacheBooks(books)
		return books
	} catch (error) {
		console.error(`searchGutenbergBooks fallback (${query}):`, error)
		// Degraded mode: answer from the Postgres cache.
		try {
			if (isBrowseAll) {
				const rows = await prisma.gutenbergBook.findMany({
					orderBy: { downloadCount: 'desc' },
					take: 32
				})
				return rows.map(fromCache)
			}
			const rows = await prisma.gutenbergBook.findMany({
				where: {
					OR: [
						{ title: { contains: trimmed, mode: 'insensitive' } },
						{ author: { contains: trimmed, mode: 'insensitive' } }
					]
				},
				orderBy: { downloadCount: 'desc' },
				take: 32
			})
			return rows.map(fromCache)
		} catch (dbError) {
			console.error('searchGutenbergBooks cache read error:', dbError)
			return []
		}
	}
}

/**
 * Fetch recommendation candidates by an arbitrary Gutendex query param
 * (e.g. `search`=author or `topic`=subject), timeout-guarded and cache-warming.
 * Returns [] on failure so a slow/down Gutendex degrades gracefully instead of
 * blocking the whole recommendation build.
 */
export async function fetchGutendexCandidates(
	param: 'search' | 'topic',
	value: string
): Promise<NormalizedBook[]> {
	try {
		const url = `https://gutendex.com/books/?${param}=${encodeURIComponent(
			value
		)}`
		const raw = await fetchJsonWithTimeout(url)
		const books = GutendexListSchema.parse(raw).results.map(normalize)
		void cacheBooks(books)
		return books
	} catch (error) {
		console.error(`fetchGutendexCandidates (${param}=${value}):`, error)
		return []
	}
}

/** Instant, DB-only popular list. Used as a recommendation fallback. */
export async function getPopularCachedBooks(
	limit = 12,
	excludeIds: number[] = []
): Promise<NormalizedBook[]> {
	try {
		const rows = await prisma.gutenbergBook.findMany({
			where: excludeIds.length
				? { id: { notIn: excludeIds } }
				: undefined,
			orderBy: { downloadCount: 'desc' },
			take: limit
		})
		return rows.map(fromCache)
	} catch (error) {
		console.error('getPopularCachedBooks error:', error)
		return []
	}
}
