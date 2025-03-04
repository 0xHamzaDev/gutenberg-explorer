'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import {
	getBookTransaction,
	getUserLibrary,
	toggleBookFavorite,
	LibraryBook,
	revalidateLibrary
} from '@/app/(dashboard)/dashboard/library/actions'
import { removeBookFromLibrary } from '@/app/(dashboard)/dashboard/books/actions'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { redirect } from 'next/navigation'
import { Star, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import useSWR from 'swr'

type Book = LibraryBook

function ensureProperUrl(url: string | null | undefined): string {
	if (!url) return '/images/book.jpg'

	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return `https:${url.startsWith('//') ? url : `//${url}`}`
	}

	return url
}

export default function LibraryPage(): JSX.Element {
	const { data: books = [], mutate, isLoading } = useSWR<Book[]>(
		'user-library',
		getUserLibrary,
		{
			refreshInterval: 1000,
			revalidateOnFocus: true,
			dedupingInterval: 500
		}
	)

	const sortedBooks = useMemo(() => {
		return [...books].sort((a, b) => {
			if (a.favorite && !b.favorite) return -1
			if (!a.favorite && b.favorite) return 1
			return 0
		})
	}, [books])

	const handleFavorite = async (bookId: string) => {
		const newBooks = books.map(book =>
			book.bookId === bookId
				? { ...book, favorite: !book.favorite }
				: book
		)
		await mutate(newBooks, false)

		const success = await toggleBookFavorite(bookId)
		if (!success) {
			toast.error('Failed to update favorite status')
			await mutate()
		} else {
			await mutate()
		}
	}

	const handleRemove = async (bookId: string) => {
		try {
			const bookToRemove = books.find(book => book.bookId === bookId)
			if (!bookToRemove) return

			const newBooks = books.filter(book => book.bookId !== bookId)
			await mutate(newBooks, false)

			const removed = await removeBookFromLibrary(parseInt(bookId))

			if (removed) {
				toast.success('Book removed from library')
				await mutate()
			} else {
				await mutate()
			}
		} catch (error) {
			toast.error('An error occurred while removing the book')
			await mutate()
		}
	}

	const BookSkeleton = () => (
		<div className="flex flex-col items-center">
			<div className="relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-md">
				<Skeleton className="w-full h-full" />
			</div>
			<Skeleton className="h-4 w-3/4 mb-1" />
			<Skeleton className="h-3 w-1/2" />
		</div>
	)

	const handleLibraryBook = async (
		id: string,
		bookId: string,
		bookTitle: string,
		bookAuthor: string | null,
		bookCover: string | null
	) => {
		const transactionId = await getBookTransaction(
			id,
			bookId,
			bookTitle,
			bookAuthor || 'Unknown Author',
			bookCover || '/images/book.jpg'
		)
		redirect(`/dashboard/library/${transactionId}`)
	}

	return (
		<div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
			<div className="flex items-center justify-between mb-8">
				<h2 className="text-3xl font-bold">My Library</h2>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
				{isLoading
					? Array.from({ length: 12 }).map((_, index) => (
							<BookSkeleton key={index} />
						))
					: sortedBooks.map(book => (
							<div
								key={book.id}
								className="flex flex-col items-center cursor-pointer group relative"
							>
								<div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
									<Button
										size="icon"
										variant="ghost"
										className={cn(
											"h-8 w-8 bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors",
											book.favorite && "text-yellow-400"
										)}
										onClick={(e) => {
											e.stopPropagation()
											handleFavorite(book.bookId)
										}}
									>
										<Star className={cn("w-5 h-5", book.favorite && "fill-current")} />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-8 w-8 bg-background/70 backdrop-blur-sm hover:bg-background/90 hover:text-destructive transition-colors"
										onClick={(e) => {
											e.stopPropagation()
											handleRemove(book.bookId)
										}}
									>
										<Trash2 className="w-5 h-5" />
									</Button>
								</div>
								<div 
									className="relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-md shadow-md transition-all duration-300 group-hover:shadow-lg"
									onClick={() =>
										handleLibraryBook(
											book.id,
											book.bookId,
											book.bookTitle,
											book.bookAuthor,
											book.bookCover
										)
									}
								>
									<Image
										src={ensureProperUrl(book.bookCover)}
										alt={`Cover of ${book.bookTitle}`}
										width={250}
										height={375}
										sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
										className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
									/>
									{book.favorite && (
										<div className="absolute top-2 left-2 z-10">
											<Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
										</div>
									)}
									<div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-background/70 backdrop-blur-sm">
										<p className="text-xs font-medium truncate">
											{book.bookTitle}
										</p>
									</div>
								</div>
								<p className="text-xs text-center text-muted-foreground truncate w-full">
									{book.bookAuthor}
								</p>
							</div>
					))}
			</div>

			{sortedBooks.length === 0 && !isLoading && (
				<p className="text-center text-muted-foreground mt-8">
					No books in your library.
				</p>
			)}
		</div>
	)
}
