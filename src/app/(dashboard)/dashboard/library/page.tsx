'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import {
	getBookTransaction,
	getUserLibrary
} from '@/app/(dashboard)/dashboard/library/actions'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { redirect } from 'next/navigation'

interface Book {
	id: string
	userId: string
	bookTitle: string
	bookId: string
	bookCover: string
	createdAt: string
}

function ensureProperUrl(url: string | null | undefined): string | null {
	if (!url) return null

	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return `https:${url.startsWith('//') ? url : `//${url}`}`
	}

	return url
}

export default function LibraryPage(): JSX.Element {
	const [books, setBooks] = useState<Book[]>([])
	const [loading, setLoading] = useState<boolean>(false)

	const fetchAndSetBooks = async () => {
		setLoading(true)
		const booksData = await getUserLibrary()
		setBooks(booksData)
		setLoading(false)
	}

	const debouncedFetch = useMemo(() => {
		let timer: NodeJS.Timeout
		return () => {
			clearTimeout(timer)
			timer = setTimeout(() => fetchAndSetBooks(), 300)
		}
	}, [])

	useEffect(() => {
		debouncedFetch()
	}, [debouncedFetch])

	const BookSkeleton = () => (
		<Card className="overflow-hidden">
			<CardContent className="p-0">
				<Skeleton className="aspect-[2/3] w-full" />
				<div className="p-4">
					<Skeleton className="h-4 w-3/4 mb-2" />
					<Skeleton className="h-3 w-1/2" />
				</div>
			</CardContent>
		</Card>
	)

	const handleLibraryBook = async (
		id: string,
		bookId: string,
		bookTitle: string,
		bookAuthor: string,
		bookCover: string
	) => {
		const transactionId = await getBookTransaction(
			id,
			bookId,
			bookTitle,
			bookAuthor,
			bookCover
		)
		redirect(`/dashboard/library/${transactionId}`)
	}

	return (
		<div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
			<div className="flex items-center justify-between mb-8">
				<h2 className="text-3xl font-bold">My Library</h2>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
				{loading
					? Array.from({ length: 12 }).map((_, index) => (
							<BookSkeleton key={index} />
						))
					: books.map(book => (
							<Card
								key={book.id}
								onClick={() =>
									handleLibraryBook(
										book.id,
										book.bookId,
										book.bookTitle,
										book.bookAuthor,
										book.bookCover
									)
								}
								className="overflow-hidden hover:shadow-lg transition-all duration-300 transform w-full hover:scale-105"
							>
								<CardContent className="p-0 relative">
									<div className="aspect-w-2 aspect-h-3 relative">
										<Image
											src={
												ensureProperUrl(
													book.bookCover
												) || '/images/book.jpg'
											}
											alt={`Cover of ${book.bookTitle}`}
											width={250}
											height={250}
											sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
											className="object-cover rounded-t-lg"
										/>
									</div>
									<div className="p-4">
										<h4 className="font-semibold line-clamp-1 text-sm">
											{book.bookTitle}
										</h4>
										<p className="text-xs text-muted-foreground mt-1">
											{book.bookAuthor}
										</p>
									</div>
								</CardContent>
							</Card>
						))}
			</div>

			{books.length === 0 && !loading && (
				<p className="text-center text-muted-foreground mt-8">
					No books in your library.
				</p>
			)}
		</div>
	)
}
