'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
	ArrowLeftIcon,
	BookOpenIcon,
	CalendarIcon,
	UserIcon,
	TriangleAlert
} from 'lucide-react'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'
import {
	fetchBookById,
	isBookInLibrary,
	addBookToLibrary,
	removeBookFromLibrary
} from '@/app/(dashboard)/dashboard/books/actions'

function NoBookFound() {
	const router = useRouter()
	return (
		<div className="flex flex-col items-center justify-center h-96 text-center px-4">
			<TriangleAlert className="w-12 h-12 text-yellow-500 mb-4" />
			<h2 className="text-2xl font-semibold text-gray-800">
				Book Not Found
			</h2>
			<p className="mt-2 text-gray-600">
				We couldn't locate the book you're looking for. It may have been
				removed or the ID is incorrect.
			</p>
			<Button
				className="mt-6 flex items-center gap-2"
				onClick={() => router.push('/dashboard/books')}
			>
				<ArrowLeftIcon className="w-4 h-4" /> Go Back to Books
			</Button>
		</div>
	)
}

interface GutenbergBook {
	id: number
	title: string
	authors: { name: string }[]
	formats: { [key: string]: string }
	download_count: number
	languages: string[]
	subjects: string[]
}

const fetcher = async (url: string) => {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error('Failed to fetch data')
	}
	return response.json()
}

export function GutenbergBookOverview({ bookId }: { bookId: number }) {
	const [buttonLoading, setButtonLoading] = useState(false)
	const [libraryStatusKey, setLibraryStatusKey] = useState(
		`library-status-${bookId}-0`
	)
	const MAX_SUBJECTS_DISPLAYED = 5

	const {
		data: book,
		error: bookError,
		isLoading: bookLoading
	} = useSWR<GutenbergBook>(`book-${bookId}`, () => fetchBookById(bookId), {
		revalidateOnFocus: false
	})

	const { data: inLibrary = false, mutate: refreshLibraryStatus } = useSWR(
		libraryStatusKey,
		async () => {
			try {
				const status = await isBookInLibrary(bookId)
				return status
			} catch (error) {
				return false
			}
		},
		{
			revalidateOnFocus: true,
			dedupingInterval: 0,
			revalidateIfStale: true,
			revalidateOnMount: true,
			refreshInterval: 10 * 1000,
			errorRetryCount: 3
		}
	)

	const handleBookStatus = async () => {
		setButtonLoading(true)

		try {
			if (inLibrary) {
				const removed = await removeBookFromLibrary(bookId)
				if (removed) {
					refreshLibraryStatus(false, false)
					toast.success('Book removed from library successfully!', {
						duration: 3000,
						dismissible: true,
						closeButton: true
					})
				} else {
					toast.error('Failed to remove book from library', {
						duration: 3000,
						dismissible: true,
						closeButton: true
					})
				}
			} else {
				if (book) {
					const added = await addBookToLibrary(
						bookId,
						book.title,
						book.formats['image/jpeg'] || '',
						book.authors?.[0]?.name || ''
					)

					if (added) {
						refreshLibraryStatus(true, false)
						toast.success('Book added to library successfully!', {
							duration: 3000,
							dismissible: true,
							closeButton: true
						})
					} else {
						toast.error('Failed to add book to library', {
							duration: 3000,
							dismissible: true,
							closeButton: true
						})
					}
				}
			}

			setLibraryStatusKey(`library-status-${bookId}-${Date.now()}`)
		} catch (error) {
			toast.error('An unexpected error occurred', {
				duration: 3000,
				dismissible: true,
				closeButton: true
			})
		} finally {
			setButtonLoading(false)
		}
	}

	if (bookLoading) return <GutenbergBookOverviewSkeleton />
	if (!book || bookError) return <NoBookFound />

	return (
		<Card className="w-full mx-auto border-none">
			<CardHeader>
				<CardTitle className="text-3xl font-bold">
					{book.title}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex flex-col md:flex-row gap-6">
					<div className="w-full md:w-1/3 lg:w-1/4">
						<div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
							{book.formats['image/jpeg'] ? (
								<Image
									src={book.formats['image/jpeg']}
									alt={book.title}
									fill
									className="object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center bg-muted">
									<BookOpenIcon className="w-16 h-16 text-muted-foreground" />
								</div>
							)}
						</div>
						{!inLibrary && (
							<Button
								onClick={handleBookStatus}
								className="w-full mt-4"
								disabled={buttonLoading}
								variant="default"
							>
								{buttonLoading
									? 'Processing...'
									: 'Add to Library'}
							</Button>
						)}
					</div>

					<div className="flex-1 space-y-4">
						<div>
							<h3 className="text-lg font-medium">Author</h3>
							<div className="flex items-center mt-1">
								<UserIcon className="w-4 h-4 mr-2 text-muted-foreground" />
								<span>
									{book.authors?.[0]?.name ||
										'Unknown Author'}
								</span>
							</div>
						</div>

						<div>
							<h3 className="text-lg font-medium">Languages</h3>
							<div className="flex flex-wrap gap-2 mt-1">
								{book.languages.map((lang, index) => (
									<Badge key={index} variant="outline">
										{lang}
									</Badge>
								))}
							</div>
						</div>

						<div>
							<h3 className="text-lg font-medium">
								Download Count
							</h3>
							<div className="flex items-center mt-1">
								<CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
								<span>
									{book.download_count.toLocaleString()}{' '}
									downloads
								</span>
							</div>
						</div>

						<div>
							<h3 className="text-lg font-medium">Subjects</h3>
							<div className="flex flex-wrap gap-2 mt-1">
								{book.subjects
									.slice(0, MAX_SUBJECTS_DISPLAYED)
									.map((subject, index) => (
										<Badge key={index} variant="secondary">
											{subject}
										</Badge>
									))}
								{book.subjects.length >
									MAX_SUBJECTS_DISPLAYED && (
									<Badge variant="outline">
										+
										{book.subjects.length -
											MAX_SUBJECTS_DISPLAYED}{' '}
										more
									</Badge>
								)}
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function GutenbergBookOverviewSkeleton() {
	return (
		<Card className="w-full mx-auto border-none">
			<CardHeader>
				<Skeleton className="h-10 w-3/4" />
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex flex-col md:flex-row gap-6">
					<div className="w-full md:w-1/3 lg:w-1/4">
						<Skeleton className="aspect-[2/3] w-full rounded-lg" />
						<Skeleton className="h-10 w-full mt-4" />
					</div>
					<div className="flex-1 space-y-4">
						<div>
							<Skeleton className="h-6 w-32 mb-2" />
							<div className="flex flex-wrap gap-2">
								<Skeleton className="h-6 w-32" />
							</div>
						</div>
						<div>
							<Skeleton className="h-6 w-40 mb-2" />
							<Skeleton className="h-6 w-20" />
						</div>
						<div>
							<Skeleton className="h-6 w-32 mb-2" />
							<div className="flex flex-wrap gap-2">
								<Skeleton className="h-6 w-20" />
								<Skeleton className="h-6 w-20" />
							</div>
						</div>
						<div>
							<Skeleton className="h-6 w-32 mb-2" />
							<div className="flex flex-wrap gap-2">
								{Array.from({ length: 5 }).map((_, i) => (
									<Skeleton key={i} className="h-6 w-24" />
								))}
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default function Preview() {
	const params = useParams()
	const router = useRouter()
	const bookId = parseInt(params.bookId as string)

	return (
		<div className="container py-6 max-w-6xl">
			<Tabs defaultValue="overview" className="w-full">
				<TabsList className="mb-4">
					<TabsTrigger value="overview">
						<BookOpenIcon className="w-4 h-4 mr-2" />
						Book Overview
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<GutenbergBookOverview bookId={bookId} />
				</TabsContent>
			</Tabs>
		</div>
	)
}
