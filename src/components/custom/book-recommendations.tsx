'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Book } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { RecommendedBook } from '@/app/(dashboard)/dashboard/books/recommendations'

interface BookRecommendationsProps {
	title: string
	swrKey: string
	fetcher: () => Promise<RecommendedBook[]>
	// When true the whole section unmounts if there are no results (used for
	// "Similar Books", where an empty row would just be noise).
	hideWhenEmpty?: boolean
}

function RecommendationSkeleton() {
	return (
		<div className="flex flex-col">
			<div className="relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-md">
				<Skeleton className="w-full h-full" />
			</div>
			<Skeleton className="h-3 w-3/4 mb-1" />
			<Skeleton className="h-3 w-1/2" />
		</div>
	)
}

export function BookRecommendations({
	title,
	swrKey,
	fetcher,
	hideWhenEmpty = false
}: BookRecommendationsProps) {
	const router = useRouter()

	const { data: books, isLoading } = useSWR<RecommendedBook[]>(
		swrKey,
		fetcher,
		{
			revalidateOnFocus: false,
			revalidateIfStale: false,
			dedupingInterval: 60_000
		}
	)

	const isEmpty = !isLoading && (!books || books.length === 0)

	if (hideWhenEmpty && isEmpty) {
		return null
	}

	return (
		<section className="mb-10">
			<h3 className="text-xl font-semibold mb-4">{title}</h3>

			{isEmpty && (
				<p className="text-sm text-muted-foreground">
					No recommendations yet. Add a few books to your library and
					we&apos;ll suggest more you might like.
				</p>
			)}

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
				{isLoading
					? Array.from({ length: 6 }).map((_, index) => (
							<RecommendationSkeleton key={index} />
						))
					: books?.map(book => (
							<div
								key={book.id}
								onClick={() =>
									router.push(`/dashboard/books/${book.id}`)
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
									<div className="absolute top-2 left-2">
										<Badge
											variant="secondary"
											className="text-[10px] px-1.5 py-0.5 bg-background/80 backdrop-blur-sm"
										>
											{book.reason}
										</Badge>
									</div>
									<div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-background/70 backdrop-blur-sm">
										<p className="text-xs font-medium truncate">
											{book.title}
										</p>
									</div>
								</div>
								<p className="text-xs text-center text-muted-foreground truncate w-full">
									{book.author}
								</p>
							</div>
						))}
			</div>
		</section>
	)
}
