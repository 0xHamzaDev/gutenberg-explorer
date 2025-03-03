'use server'

import { clerkClient, auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { z } from 'zod'
import { unstable_cache } from 'next/cache'

const BookSchema = z.object({
	id: z.number(),
	title: z.string(),
	author: z.string(),
	coverUrl: z.string()
})

const GutenbergBookResponseSchema = z.object({
	results: z
		.array(
			z.object({
				id: z.number(),
				title: z.string(),
				authors: z
					.array(
						z.object({
							name: z.string()
						})
					)
					.optional()
					.default([]),
				formats: z.record(z.string())
			})
		)
		.optional()
		.default([])
})

const GutenbergBookDetailSchema = z.object({
	id: z.number(),
	title: z.string(),
	authors: z
		.array(
			z.object({
				name: z.string()
			})
		)
		.default([]),
	formats: z.record(z.string()),
	download_count: z.number(),
	languages: z.array(z.string()),
	subjects: z.array(z.string()),
	detail: z.string().optional()
})

type Book = z.infer<typeof BookSchema>
type GutenbergBookDetail = z.infer<typeof GutenbergBookDetailSchema>

async function fetchWithRetry(
	url: string,
	options = {},
	retries = 3,
	backoff = 300
) {
	let lastError
	for (let i = 0; i < retries; i++) {
		try {
			return await fetch(url, options)
		} catch (err) {
			lastError = err
			await new Promise(resolve =>
				setTimeout(resolve, backoff * Math.pow(2, i))
			)
		}
	}
	throw lastError
}

export const fetchBooks = unstable_cache(
	async (query: string, page: number = 1): Promise<Book[]> => {
		try {
			const apiUrl = `https://gutendex.com/books?search=${encodeURIComponent(
				query
			)}&page=${page}`
			const response = await fetchWithRetry(apiUrl)

			if (!response.ok) {
				throw new Error(`Failed to fetch books: ${response.statusText}`)
			}

			const rawData = await response.json()

			const data = GutenbergBookResponseSchema.parse(rawData)

			return data.results.map(book => {
				let coverUrl =
					book.formats['image/jpeg'] || 'default-cover-url.jpg'

				if (
					coverUrl &&
					!coverUrl.startsWith('http://') &&
					!coverUrl.startsWith('https://') &&
					coverUrl !== 'default-cover-url.jpg'
				) {
					coverUrl = `https:${
						coverUrl.startsWith('//') ? coverUrl : `//${coverUrl}`
					}`
				}

				return {
					id: book.id,
					title: book.title,
					author: book.authors?.[0]?.name || 'Unknown Author',
					coverUrl: coverUrl
				}
			})
		} catch (error) {
			console.error('Error fetching books:', error)

			return []
		}
	},
	[],
	{ revalidate: 3600 }
)

export const fetchBookById = unstable_cache(
	async (bookId: number): Promise<GutenbergBookDetail> => {
		try {
			const apiUrl = `https://gutendex.com/books/${bookId}`
			const response = await fetchWithRetry(apiUrl)

			if (!response.ok) {
				throw new Error(
					`Failed to fetch book by ID: ${response.statusText}`
				)
			}

			const rawData = await response.json()

			const bookData = GutenbergBookDetailSchema.parse(rawData)

			const fixedFormats: Record<string, string> = {}

			for (const [format, url] of Object.entries(bookData.formats)) {
				if (url && typeof url === 'string') {
					if (
						!url.startsWith('http://') &&
						!url.startsWith('https://')
					) {
						fixedFormats[format] = `https:${
							url.startsWith('//') ? url : `//${url}`
						}`
					} else {
						fixedFormats[format] = url
					}
				}
			}

			return {
				...bookData,
				formats: fixedFormats
			}
		} catch (error) {
			throw new Error('Failed to fetch book details')
		}
	},
	['book-detail'],
	{ revalidate: 86400 }
)

export const isBookInLibraryCached = unstable_cache(
	async (bookId: number, userId: string): Promise<boolean> => {
		try {
			if (!userId) {
				return false
			}

			const count = await prisma.userLibrary.count({
				where: {
					userId,
					bookId: bookId.toString()
				}
			})

			const isInLibrary = count > 0

			return isInLibrary
		} catch (error) {
			return false
		}
	},
	['book-in-library'],
	{ revalidate: 5 }
)

export async function isBookInLibrary(bookId: number): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const libraryBook = await prisma.userLibrary.findFirst({
			where: {
				userId,
				bookId: bookId.toString()
			}
		})

		const isInLibrary = Boolean(libraryBook)

		return isInLibrary
	} catch (error) {
		return false
	}
}

export async function addBookToLibrary(
	bookId: number,
	bookTitle: string,
	bookCover?: string,
	bookAuthor?: string
): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const existingEntry = await prisma.userLibrary.findFirst({
			where: {
				userId,
				bookId: bookId.toString()
			}
		})

		if (existingEntry) {
			await prisma.userLibrary.update({
				where: { id: existingEntry.id },
				data: { updatedAt: new Date() }
			})
			return true
		}

		const result = await prisma.userLibrary.create({
			data: {
				userId,
				bookId: bookId.toString(),
				bookTitle,
				bookCover: bookCover || '',
				bookAuthor: bookAuthor || 'Unknown',
				createdAt: new Date()
			}
		})

		return Boolean(result)
	} catch (error) {
		return false
	}
}

export async function removeBookFromLibrary(bookId: number): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const existingEntry = await prisma.userLibrary.findFirst({
			where: {
				userId,
				bookId: bookId.toString()
			}
		})

		if (!existingEntry) {
			return true
		}

		const result = await prisma.userLibrary.delete({
			where: {
				id: existingEntry.id
			}
		})

		return Boolean(result)
	} catch (error) {
		return false
	}
}
