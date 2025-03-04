import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { unstable_cache } from 'next/cache'

interface BookData {
	id: string
	title: string
	author: string | null
	coverUrl: string | null
	subjects: string[] | null
}

interface RecommendationData {
	id: string
	title: string
	author: string | null
	coverUrl: string | null
	relevanceScore: number
}

async function fetchBooksFromGutenberg(
	query: string = '',
	page: number = 1,
	limit: number = 20,
	topic: string = ''
): Promise<any[]> {
	try {
		let apiUrl = `https://gutendex.com/books?`

		if (topic && topic.trim() !== '') {
			apiUrl += `topic=${encodeURIComponent(topic)}&`
		}

		if (query && query.trim() !== '') {
			apiUrl += `search=${encodeURIComponent(query)}&`
		}

		apiUrl += `page=${page}`

		const response = await fetch(apiUrl)
		if (!response.ok) {
			throw new Error(`Failed to fetch books: ${response.statusText}`)
		}

		const data = await response.json()

		return (data.results || []).slice(0, limit).map((book: any) => ({
			id: book.id.toString(),
			title: book.title,
			author: book.authors?.[0]?.name || null,
			coverUrl: book.formats?.['image/jpeg'] || null,
			subjects: book.subjects || []
		}))
	} catch (error) {
		console.error('Error fetching books from Gutenberg:', error)
		return []
	}
}

const getRecommendationsCached = unstable_cache(
	async (
		topics: string[],
		keywords: string[],
		readBookIds: Set<string>
	): Promise<BookData[]> => {
		const allBooks: BookData[] = []
		const usedIds = new Set<string>()

		const topicPromises = topics.slice(0, 3).map(subject =>
			fetchBooksFromGutenberg('', 1, 12, subject)
				.then(books => {
					books.forEach(book => {
						if (
							!usedIds.has(book.id) &&
							!readBookIds.has(book.id)
						) {
							usedIds.add(book.id)
							allBooks.push(book)
						}
					})
				})
				.catch(error => {
					console.error(
						`Error fetching books for subject ${subject}:`,
						error
					)
				})
		)

		await Promise.all(topicPromises)

		if (allBooks.length < 15 && keywords.length > 0) {
			const keywordPromises = keywords.slice(0, 3).map(keyword =>
				fetchBooksFromGutenberg('', 1, 8, keyword)
					.then(async books => {
						if (books.length === 0) {
							books = await fetchBooksFromGutenberg(keyword, 1, 8)
						}
						books.forEach(book => {
							if (
								!usedIds.has(book.id) &&
								!readBookIds.has(book.id)
							) {
								usedIds.add(book.id)
								allBooks.push(book)
							}
						})
					})
					.catch(error => {
						console.error(
							`Error fetching books for keyword ${keyword}:`,
							error
						)
					})
			)

			await Promise.all(keywordPromises)
		}

		if (allBooks.length < 10) {
			try {
				const popularBooks = await fetchBooksFromGutenberg('', 1, 15)
				popularBooks.forEach(book => {
					if (!usedIds.has(book.id) && !readBookIds.has(book.id)) {
						usedIds.add(book.id)
						allBooks.push(book)
					}
				})
			} catch (error) {
				console.error(`Error fetching popular books:`, error)
			}
		}

		return allBooks
	},
	['recommendations'],
	{ revalidate: 3600 }
)

async function fetchRecommendationBooks(
	topics: string[],
	keywords: string[],
	readBookIds: Set<string>
): Promise<BookData[]> {
	return getRecommendationsCached(topics, keywords, readBookIds)
}

export async function GET() {
	try {
		const { userId } = await auth()

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const transactions = await prisma.transactions.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' }
		})

		const library = await prisma.userLibrary.findMany({
			where: { userId }
		})

		const totalBooks = transactions.length
		const totalBooksInLibrary = library.length
		const totalAuthors = new Set(
			transactions.map(t => t.bookAuthor).filter(Boolean)
		).size

		let totalMessages = 0
		const messagesByBook = new Map<string, number>()
		let userMessageCount = 0
		let botMessageCount = 0

		const messageContents: string[] = []
		const interestKeywords: { [key: string]: number } = {}

		for (const transaction of transactions) {
			const messages = transaction.messages || []

			let bookMessageCount = 0

			for (const messageStr of messages) {
				try {
					const message = JSON.parse(messageStr)
					totalMessages++
					bookMessageCount++

					if (message.role === 'user') {
						userMessageCount++

						if (message.content) {
							messageContents.push(message.content)

							const words = message.content
								.toLowerCase()
								.split(/\W+/)
								.filter(Boolean)
							for (const word of words) {
								if (word.length > 3) {
									interestKeywords[word] =
										(interestKeywords[word] || 0) + 1
								}
							}
						}
					} else if (message.role === 'bot') {
						botMessageCount++
					}
				} catch (e) {
					// Skip invalid messages
				}
			}

			if (bookMessageCount > 0) {
				messagesByBook.set(transaction.bookId, bookMessageCount)
			}
		}

		const subjectCounts: Record<string, number> = {}
		const readBookIds = new Set(transactions.map(t => t.bookId))

		for (const transaction of transactions) {
			if (transaction.bookTitle) {
				const titleWords = transaction.bookTitle
					.toLowerCase()
					.split(/\W+/)
					.filter(word => word.length > 4)

				for (const word of titleWords) {
					subjectCounts[word] = (subjectCounts[word] || 0) + 1
				}
			}
		}

		const topSubjects = Object.entries(subjectCounts)
			.sort((a: [string, number], b: [string, number]) => b[1] - a[1])
			.slice(0, 5)
			.map(([subject]) => subject)

		const topKeywords = Object.entries(interestKeywords)
			.sort((a: [string, number], b: [string, number]) => b[1] - a[1])
			.slice(0, 10)
			.map(([keyword]) => keyword)

		let allBooks: BookData[] = []
		const usedIds = new Set<string>()
		try {
			const defaultLiterarySubjects = [
				'fiction',
				'novel',
				'story',
				'literature',
				'fantasy',
				'adventure',
				'mystery',
				'history',
				'science',
				'philosophy',
				'romance'
			]

			const searchSubjects =
				topSubjects.length >= 3
					? topSubjects
					: [
							...topSubjects,
							...defaultLiterarySubjects.slice(
								0,
								5 - topSubjects.length
							)
					  ]

			allBooks = await fetchRecommendationBooks(
				searchSubjects,
				topKeywords,
				readBookIds
			)
		} catch (error) {
			console.error('Error fetching books for recommendations:', error)
		}

		const recommendations: RecommendationData[] = allBooks
			.filter(book => !readBookIds.has(book.id))
			.map(book => {
				let relevanceScore = 0

				const bookTitleText = (book.title || '').toLowerCase()

				for (const subject of topSubjects) {
					if (bookTitleText.includes(subject)) {
						relevanceScore += 3
					}
				}

				for (const keyword of topKeywords) {
					if (bookTitleText.includes(keyword)) {
						relevanceScore += 2
					}
				}

				if (book.subjects && Array.isArray(book.subjects)) {
					const bookSubjectsText = book.subjects
						.join(' ')
						.toLowerCase()

					for (const subject of topSubjects) {
						if (bookSubjectsText.includes(subject)) {
							relevanceScore += 8
						}
					}

					for (const keyword of topKeywords) {
						if (bookSubjectsText.includes(keyword)) {
							relevanceScore += 4
						}
					}
				}

				relevanceScore += 1

				return {
					id: book.id,
					title: book.title,
					author: book.author,
					coverUrl: book.coverUrl,
					relevanceScore
				}
			})
			.sort(
				(a: RecommendationData, b: RecommendationData) =>
					b.relevanceScore - a.relevanceScore
			)
			.slice(0, 6)

		const recommendationSubjects: string[] = []

		recommendations.forEach(book => {
			const bookData = allBooks.find(b => b.id === book.id)
			if (
				bookData &&
				bookData.subjects &&
				Array.isArray(bookData.subjects)
			) {
				bookData.subjects.forEach(subject => {
					const cleanSubject = subject.trim()
					if (
						cleanSubject.length > 3 &&
						cleanSubject.length < 30 &&
						!recommendationSubjects.includes(cleanSubject) &&
						!cleanSubject.includes(',')
					) {
						recommendationSubjects.push(cleanSubject)
					}
				})
			}
		})

		const displaySubjects = recommendationSubjects.slice(
			0,
			Math.min(10, recommendationSubjects.length)
		)

		const booksWithMessages = messagesByBook.size
		const averageMessagesPerBook =
			booksWithMessages > 0
				? Math.round((totalMessages / booksWithMessages) * 10) / 10
				: 0

		const readingHours = transactions.reduce((acc, t) => {
			const hour = new Date(t.createdAt).getHours()
			acc[hour] = (acc[hour] || 0) + 1
			return acc
		}, {} as Record<number, number>)

		const readingDays = transactions.reduce((acc, t) => {
			const day = new Date(t.createdAt).getDay()
			acc[day] = (acc[day] || 0) + 1
			return acc
		}, {} as Record<number, number>)

		const readingHoursData = Array.from({ length: 24 }, (_, hour) => ({
			hour,
			count: readingHours[hour] || 0
		}))

		const readingDaysData = Array.from({ length: 7 }, (_, index) => ({
			name: [
				'Sunday',
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday'
			][index],
			count: readingDays[index] || 0
		}))

		const sortedTransactions = [...transactions].sort(
			(a, b) =>
				new Date(a.createdAt).getTime() -
				new Date(b.createdAt).getTime()
		)

		const firstReadDate = sortedTransactions.length
			? new Date(sortedTransactions[0].createdAt)
			: null
		const lastReadDate = sortedTransactions.length
			? new Date(
					sortedTransactions[sortedTransactions.length - 1].createdAt
			  )
			: null

		const daysSinceFirstRead = firstReadDate
			? Math.floor(
					(new Date().getTime() - firstReadDate.getTime()) /
						(1000 * 3600 * 24)
			  )
			: 0

		const daysSinceLastRead = lastReadDate
			? Math.floor(
					(new Date().getTime() - lastReadDate.getTime()) /
						(1000 * 3600 * 24)
			  )
			: null

		const recentActivity = transactions.slice(0, 5).map(t => ({
			id: t.id,
			bookId: t.bookId,
			title: t.bookTitle,
			author: t.bookAuthor,
			date: t.updatedAt,
			messageCount: (t.messages || []).length,
			transactionId: t.id
		}))

		const now = new Date()
		const oneYearAgo = new Date()
		oneYearAgo.setFullYear(now.getFullYear() - 1)

		const calendarData: { day: string; value: number }[] = []
		const dateCountMap: Record<string, number> = {}

		transactions.forEach(transaction => {
			const date = new Date(transaction.createdAt)
			if (date >= oneYearAgo && date <= now) {
				const formattedDate = date.toISOString().split('T')[0]
				dateCountMap[formattedDate] =
					(dateCountMap[formattedDate] || 0) + 1
			}
		})

		Object.entries(dateCountMap).forEach(([day, value]) => {
			calendarData.push({ day, value })
		})

		const currentDate = new Date()
		while (currentDate <= now) {
			const formattedDate = currentDate.toISOString().split('T')[0]
			if (!dateCountMap[formattedDate]) {
				calendarData.push({ day: formattedDate, value: 0 })
			}
			currentDate.setDate(currentDate.getDate() + 1)
		}

		calendarData.sort((a, b) => a.day.localeCompare(b.day))

		return NextResponse.json({
			totalBooks,
			totalBooksInLibrary,
			totalAuthors,
			totalMessages,
			userMessageCount,
			botMessageCount,
			averageMessagesPerBook,
			booksWithMessages,
			readingHoursData,
			readingDaysData,
			daysSinceFirstRead,
			daysSinceLastRead,
			firstReadDate,
			lastReadDate,
			recentActivity,
			calendarData,
			topSubjects:
				displaySubjects.length > 0 ? displaySubjects : topSubjects,
			recommendations: totalBooks > 2 ? recommendations : []
		})
	} catch (error) {
		console.error('Error fetching reading statistics:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch reading statistics' },
			{ status: 500 }
		)
	}
}
