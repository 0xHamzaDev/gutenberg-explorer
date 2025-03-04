'use client'

import Image from 'next/image'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription
} from '@/components/ui/card'
import { useState, useRef, useEffect } from 'react'
import { fetchBooks } from '@/app/(dashboard)/dashboard/books/actions'
import { Search, Sparkles, Book, BookOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'

interface Book {
	id: number
	title: string
	author: string
	coverUrl: string
}

interface Recommendation {
	id: string
	title: string
	author: string | null
	coverUrl: string | null
	relevanceScore: number
}

interface ReadingStats {
	recommendations: Recommendation[]
	topSubjects: string[]
	totalBooks: number
	recentActivity: {
		id: string
		bookId: string
		title: string
		author: string | null
		date: string
		messageCount: number
		transactionId?: string
	}[]
}

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value)

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedValue(value)
		}, delay)

		return () => {
			clearTimeout(timer)
		}
	}, [value, delay])

	return debouncedValue
}

export default function BooksPage(): JSX.Element {
	const [searchQuery, setSearchQuery] = useState<string>('')
	const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false)
	const [currentPage, setCurrentPage] = useState<number>(1)
	const [allBooks, setAllBooks] = useState<Book[]>([])
	const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const debouncedQuery = useDebounce(searchQuery, 300)

	const { data: recommendationsData, isLoading: recommendationsLoading } =
		useSWR<ReadingStats>(
			'/dashboard/stats',
			async url => {
				const response = await fetch(url)
				if (!response.ok) {
					throw new Error('Failed to fetch recommendations')
				}
				const data = await response.json()
				return {
					recommendations: data.recommendations || [],
					topSubjects: data.topSubjects || [],
					totalBooks: data.totalBooks || 0,
					recentActivity: data.recentActivity || []
				}
			},
			{ revalidateOnFocus: false }
		)

	const {
		data: books,
		error,
		isLoading
	} = useSWR<Book[]>(
		['books', debouncedQuery || 'all', 1],
		() => fetchBooks(debouncedQuery || 'all', 1),
		{
			revalidateOnFocus: false,
			revalidateIfStale: false
		}
	)

	useEffect(() => {
		if (books) {
			setAllBooks(books)
			setCurrentPage(1)
		}
	}, [books])

	const handleSearchIconClick = () => {
		setIsSearchVisible(true)
		searchInputRef.current?.focus()
	}

	const handleBookClick = (bookId: string) => {
		router.push(`/dashboard/books/${bookId}`)
	}

	const handleLoadMore = async () => {
		setIsLoadingMore(true)
		const nextPage = currentPage + 1
		try {
			const moreBooks = await fetchBooks(
				debouncedQuery || 'all',
				nextPage
			)
			if (moreBooks.length > 0) {
				setAllBooks(prev => [...prev, ...moreBooks])
				setCurrentPage(nextPage)
			}
		} catch (error) {
			console.error('Error loading more books:', error)
		} finally {
			setIsLoadingMore(false)
		}
	}

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

	const RecommendedBooks = () => {
		if (recommendationsLoading) {
			return (
				<div className="mb-10">
					<div className="flex items-center mb-4">
						<Skeleton className="h-7 w-48 mr-2" />
						<Skeleton className="h-5 w-5" />
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton
								key={index}
								className="aspect-[2/3] rounded-md"
							/>
						))}
					</div>
				</div>
			)
		}

		if (
			!recommendationsData?.recommendations ||
			recommendationsData.recommendations.length === 0 ||
			!recommendationsData.totalBooks ||
			recommendationsData.totalBooks <= 2
		) {
			return null
		}

		return (
			<div className="mb-10">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
					<div>
						<h3 className="text-2xl font-bold flex items-center">
							Recommended for You
							<Sparkles className="h-5 w-5 ml-2 text-yellow-500" />
						</h3>
						<p className="text-muted-foreground text-sm mt-1">
							Books from Gutenberg's library matching your reading
							interests
						</p>
					</div>

					{recommendationsData.topSubjects &&
						recommendationsData.topSubjects.length > 0 && (
							<div className="mt-3 md:mt-0 flex flex-wrap gap-2 md:justify-end">
								<span className="inline-block text-xs font-medium text-muted-foreground pr-2">
									Topics of Interest:
								</span>
								{recommendationsData.topSubjects.map(
									(subject, index) => (
										<span
											key={index}
											className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
										>
											{subject}
										</span>
									)
								)}
							</div>
						)}
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
					{recommendationsData.recommendations.map(book => (
						<div
							key={book.id}
							onClick={() =>
								router.push(`/dashboard/books/${book.id}`)
							}
							className="flex flex-col items-center cursor-pointer group relative"
						>
							<div className="absolute top-2 right-2 bg-primary/90 text-white text-xs font-semibold px-2 py-1 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity">
								{Math.min(
									99,
									Math.round(book.relevanceScore * 10)
								)}
								% match
							</div>
							<div className="relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-md shadow-md transition-all duration-300 group-hover:shadow-lg">
								{book.coverUrl ? (
									<Image
										src={book.coverUrl}
										alt={`Cover of ${book.title}`}
										width={250}
										height={375}
										sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
										className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
									/>
								) : (
									<div className="flex items-center justify-center w-full h-full bg-muted">
										<Book className="h-12 w-12 text-muted-foreground" />
									</div>
								)}
								<div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-background/70 backdrop-blur-sm">
									<p className="text-xs font-medium truncate">
										{book.title}
									</p>
								</div>
							</div>
							<p className="text-xs text-center text-muted-foreground truncate w-full">
								{book.author || 'Unknown Author'}
							</p>
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
			<div className="flex items-center justify-between mb-8">
				<h2 className="text-3xl font-bold">Explore Books</h2>
				<div className="relative flex items-center">
					<div className={cn(
						"flex items-center bg-background rounded-full border px-3 py-2 w-64 transition-all duration-300",
						isSearchVisible ? "ring-1 ring-ring" : ""
					)}>
						<Search className="h-4 w-4 text-muted-foreground shrink-0" />
						<input
							ref={searchInputRef}
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onFocus={() => setIsSearchVisible(true)}
							onBlur={() => {
								if (!searchQuery) {
									setIsSearchVisible(false)
								}
							}}
							placeholder="Search for a book..."
							className="flex-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-sm ml-2 placeholder:text-muted-foreground"
						/>
						{searchQuery && (
							<button
								onClick={() => {
									setSearchQuery('')
									setIsSearchVisible(false)
									searchInputRef.current?.blur()
								}}
								className="p-1 hover:bg-muted rounded-full"
							>
								<X className="h-3 w-3 text-muted-foreground" />
							</button>
						)}
					</div>
				</div>
			</div>

			{!searchQuery && <RecommendedBooks />}

			<div className="mb-6">
				<h3 className="text-xl font-semibold mb-4">
					{searchQuery ? `Search Results for "${searchQuery}"` : "All Books"}
				</h3>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
				{isLoading
					? Array.from({ length: 12 }).map((_, index) => (
							<BookSkeleton key={index} />
						))
					: allBooks?.map(book => (
							<div
								key={book.id}
								onClick={() =>
									handleBookClick(book.id.toString())
								}
								className="flex flex-col items-center cursor-pointer group relative"
							>
								<div className="relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-md shadow-md transition-all duration-300 group-hover:shadow-lg">
									{book.coverUrl ? (
										<Image
											src={book.coverUrl}
											alt={`Cover of ${book.title}`}
											width={250}
											height={375}
											sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
											className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
										/>
									) : (
										<div className="flex items-center justify-center w-full h-full bg-muted">
											<Book className="h-12 w-12 text-muted-foreground" />
										</div>
									)}
									<div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-background/70 backdrop-blur-sm">
										<p className="text-xs font-medium truncate">
											{book.title}
										</p>
									</div>
								</div>
								<p className="text-xs text-center text-muted-foreground truncate w-full">
									{book.author || 'Unknown Author'}
								</p>
							</div>
					))}
			</div>

			{allBooks?.length === 0 && !isLoading && (
				<p className="text-center text-muted-foreground mt-8">
					No books found. Try a different search term.
				</p>
			)}

			{allBooks?.length > 0 && (
				<div className="flex justify-center mt-8">
					<Button
						onClick={handleLoadMore}
						disabled={isLoadingMore}
						className="px-6 py-2"
					>
						{isLoadingMore ? 'Loading...' : 'See More Books'}
					</Button>
				</div>
			)}
		</div>
	)
}
