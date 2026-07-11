'use server'

import { clerkClient, auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { z } from 'zod'
import { unstable_cache } from 'next/cache'
import { revalidateLibrary } from '@/app/(dashboard)/dashboard/library/actions'
import { getGutenbergBook, searchGutenbergBooks } from '@/lib/gutenberg'

const BookSchema = z.object({
	id: z.number(),
	title: z.string(),
	author: z.string(),
	coverUrl: z.string()
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

// Book browsing/search now goes through the Postgres-backed, timeout-guarded
// cache layer (see src/lib/gutenberg.ts) instead of hitting Gutendex directly.
export async function fetchBooks(
	query: string,
	page: number = 1
): Promise<Book[]> {
	const books = await searchGutenbergBooks(query, page)
	return books.map(book => ({
		id: book.id,
		title: book.title,
		author: book.author,
		coverUrl: book.coverUrl || 'default-cover-url.jpg'
	}))
}

export async function fetchBookById(
	bookId: number
): Promise<GutenbergBookDetail> {
	const book = await getGutenbergBook(bookId)
	if (!book) {
		throw new Error('Failed to fetch book details')
	}

	// Adapt the normalized cache shape back to what the detail page/recs expect.
	return {
		id: book.id,
		title: book.title,
		authors: book.author ? [{ name: book.author }] : [],
		formats: book.coverUrl ? { 'image/jpeg': book.coverUrl } : {},
		download_count: book.downloadCount,
		languages: book.languages,
		subjects: book.subjects
	}
}

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

		// Denormalize subjects/languages at add-time (cache-first, so it's cheap
		// and won't hang) so recommendations never re-fetch this book's metadata.
		const detail = await getGutenbergBook(bookId)

		const result = await prisma.userLibrary.create({
			data: {
				userId,
				bookId: bookId.toString(),
				bookTitle,
				bookCover: bookCover || detail?.coverUrl || '',
				bookAuthor: bookAuthor || detail?.author || 'Unknown',
				subjects: detail?.subjects ?? [],
				languages: detail?.languages ?? [],
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

		await revalidateLibrary(userId)

		return Boolean(result)
	} catch (error) {
		return false
	}
}
