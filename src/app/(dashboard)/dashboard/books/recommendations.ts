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
import {
	scoreAndRank,
	subjectTokens,
	titleKey,
	type RecommendedBook
} from '@/lib/recommendation-utils'
export type { RecommendedBook } from '@/lib/recommendation-utils'

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
