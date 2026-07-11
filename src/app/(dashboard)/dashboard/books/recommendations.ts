'use server'

import { auth } from '@clerk/nextjs/server'
import { unstable_cache } from 'next/cache'
import {
	fetchGutendexCandidates,
	getGutenbergBook,
	getPopularCachedBooks,
	searchGutenbergBooks,
	type NormalizedBook
} from '@/lib/gutenberg'
import { getUserLibraryData } from '@/app/(dashboard)/dashboard/library/actions'

export interface RecommendedBook {
	id: number
	title: string
	author: string
	coverUrl: string
	score: number
	reason: string
}

const STOPWORDS = new Set([
	'fiction',
	'the',
	'of',
	'and',
	'a',
	'in',
	'to',
	'for',
	'stories',
	'literature'
])

// "England -- Fiction" -> ["england"]; drops generic tokens so overlap is meaningful.
function subjectTokens(subjects: string[]): Set<string> {
	const tokens = new Set<string>()
	for (const subject of subjects) {
		for (const part of subject.split(/--|,/)) {
			const token = part.trim().toLowerCase()
			if (token.length > 2 && !STOPWORDS.has(token)) {
				tokens.add(token)
			}
		}
	}
	return tokens
}

// Gutendex lists many editions/translations of the same work under different
// ids. Collapse them so a recommendation row shows distinct titles, not the same
// book four times.
function titleKey(title: string, author: string): string {
	return `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`
}

interface RankOptions {
	// Keep only books sharing a language with the seed (defaults to English).
	// Prevents foreign-language translations dominating the list.
	preferredLanguages?: Set<string>
	// Normalized "title::author" keys to drop (e.g. the source book's own editions).
	excludeTitleKeys?: Set<string>
}

function scoreAndRank(
	candidates: NormalizedBook[],
	seedTokens: Set<string>,
	seedAuthors: Set<string>,
	excludeIds: Set<number>,
	options: RankOptions = {}
): RecommendedBook[] {
	const { preferredLanguages, excludeTitleKeys } = options
	// Dedupe by work (title+author), keeping the highest-scoring edition.
	const byTitle = new Map<string, RecommendedBook>()

	for (const book of candidates) {
		if (excludeIds.has(book.id)) continue
		if (!book.coverUrl) continue

		if (
			preferredLanguages &&
			preferredLanguages.size > 0 &&
			book.languages.length > 0 &&
			!book.languages.some(l => preferredLanguages.has(l))
		) {
			continue
		}

		const author = book.author || 'Unknown Author'
		const key = titleKey(book.title, author)
		if (excludeTitleKeys?.has(key)) continue

		const tokens = subjectTokens(book.subjects)
		let shared = 0
		for (const token of tokens) {
			if (seedTokens.has(token)) shared++
		}

		const sameAuthor = seedAuthors.has(author.toLowerCase())

		const score =
			shared * 2 +
			(sameAuthor ? 4 : 0) +
			Math.min(book.downloadCount / 50000, 1)

		if (score <= 0) continue

		const reason = sameAuthor
			? `More by ${author}`
			: shared > 0
				? 'Similar themes'
				: 'Popular pick'

		const existing = byTitle.get(key)
		if (existing && existing.score >= score) continue

		byTitle.set(key, {
			id: book.id,
			title: book.title,
			author,
			coverUrl: book.coverUrl,
			score: Math.round(score * 100) / 100,
			reason
		})
	}

	return Array.from(byTitle.values()).sort((a, b) => b.score - a.score)
}

// Popular fallback: DB cache first (instant), then a browse fetch if the cache
// is still cold. Never throws, never hangs.
async function popularBooks(
	excludeIds: Set<number>
): Promise<RecommendedBook[]> {
	let books = await getPopularCachedBooks(24, Array.from(excludeIds))
	if (books.length === 0) {
		books = await searchGutenbergBooks('all', 1)
	}
	return books
		.filter(b => !excludeIds.has(b.id) && b.coverUrl)
		.slice(0, 12)
		.map(b => ({
			id: b.id,
			title: b.title,
			author: b.author,
			coverUrl: b.coverUrl,
			score: b.downloadCount,
			reason: 'Popular on Project Gutenberg'
		}))
}

// Content-based "you might also like" for a single book, from its own metadata.
export const fetchSimilarBooks = unstable_cache(
	async (bookId: number): Promise<RecommendedBook[]> => {
		try {
			const source = await getGutenbergBook(bookId)
			if (!source) return []

			const seedTokens = subjectTokens(source.subjects)
			const author = source.author || ''
			const seedAuthors = new Set(author ? [author.toLowerCase()] : [])
			const preferredLanguages = new Set(
				source.languages.length ? source.languages : ['en']
			)
			// Don't recommend other editions of the same book.
			const excludeTitleKeys = new Set([
				titleKey(source.title, author || 'Unknown Author')
			])

			const topic = Array.from(seedTokens)[0] || ''
			const [byAuthor, byTopic] = await Promise.all([
				author
					? fetchGutendexCandidates('search', author)
					: Promise.resolve<NormalizedBook[]>([]),
				topic
					? fetchGutendexCandidates('topic', topic)
					: Promise.resolve<NormalizedBook[]>([])
			])

			const ranked = scoreAndRank(
				[...byAuthor, ...byTopic],
				seedTokens,
				seedAuthors,
				new Set([bookId]),
				{ preferredLanguages, excludeTitleKeys }
			)

			return ranked.slice(0, 12)
		} catch (error) {
			console.error('fetchSimilarBooks error:', error)
			return []
		}
	},
	['similar-books'],
	{ revalidate: 86400 }
)

// Personalized recommendations from the user's saved library. The taste profile
// comes straight from the denormalized UserLibrary columns (no per-seed Gutendex
// fetch). Cache key includes a library signature so it refreshes on add/remove,
// and is tagged 'library' so existing revalidateTag('library') calls bust it.
const getRecommendationsForProfile = unstable_cache(
	async (
		_userId: string,
		_signature: string,
		seedTokenList: string[],
		seedAuthorList: string[],
		preferredLanguageList: string[],
		excludeTitleKeyList: string[],
		libraryBookIds: number[]
	): Promise<RecommendedBook[]> => {
		const excludeIds = new Set(libraryBookIds)
		const seedTokens = new Set(seedTokenList)
		const seedAuthors = new Set(seedAuthorList)
		const preferredLanguages = new Set(
			preferredLanguageList.length ? preferredLanguageList : ['en']
		)
		const excludeTitleKeys = new Set(excludeTitleKeyList)

		if (seedTokens.size === 0 && seedAuthors.size === 0) {
			return popularBooks(excludeIds)
		}

		const queries: Array<Promise<NormalizedBook[]>> = []
		for (const author of Array.from(seedAuthors).slice(0, 2)) {
			queries.push(fetchGutendexCandidates('search', author))
		}
		for (const topic of Array.from(seedTokens).slice(0, 2)) {
			queries.push(fetchGutendexCandidates('topic', topic))
		}

		const pools = (await Promise.all(queries)).flat()
		const ranked = scoreAndRank(
			pools,
			seedTokens,
			seedAuthors,
			excludeIds,
			{
				preferredLanguages,
				excludeTitleKeys
			}
		)

		if (ranked.length < 6) {
			const seenTitles = new Set(
				ranked.map(r => titleKey(r.title, r.author))
			)
			const filler = await popularBooks(
				new Set([...excludeIds, ...ranked.map(r => r.id)])
			)
			for (const book of filler) {
				if (!seenTitles.has(titleKey(book.title, book.author))) {
					ranked.push(book)
				}
			}
		}

		return ranked.slice(0, 12)
	},
	['library-recommendations'],
	{ revalidate: 3600, tags: ['library'] }
)

export async function fetchRecommendations(): Promise<RecommendedBook[]> {
	try {
		const { userId } = await auth()
		if (!userId) return []

		const library = await getUserLibraryData(userId)
		const libraryBookIds = library
			.map(b => parseInt(b.bookId, 10))
			.filter(n => !Number.isNaN(n))

		const seedTokens = new Set<string>()
		const seedAuthors = new Set<string>()
		const preferredLanguages = new Set<string>()
		const excludeTitleKeys = new Set<string>()

		// Most-recently-updated books are the freshest taste signal.
		for (const row of library.slice(0, 8)) {
			for (const token of subjectTokens(row.subjects ?? []))
				seedTokens.add(token)
			if (row.bookAuthor) seedAuthors.add(row.bookAuthor.toLowerCase())
			for (const lang of row.languages ?? []) preferredLanguages.add(lang)
			excludeTitleKeys.add(
				titleKey(row.bookTitle, row.bookAuthor ?? 'Unknown Author')
			)
		}

		const signature = libraryBookIds
			.slice()
			.sort((a, b) => a - b)
			.join(',')

		return await getRecommendationsForProfile(
			userId,
			signature,
			Array.from(seedTokens),
			Array.from(seedAuthors),
			Array.from(preferredLanguages),
			Array.from(excludeTitleKeys),
			libraryBookIds
		)
	} catch (error) {
		console.error('fetchRecommendations error:', error)
		return []
	}
}
