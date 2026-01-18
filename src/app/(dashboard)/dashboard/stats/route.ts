import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'

export async function GET(request: Request) {
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
			recentActivity: recentActivity.slice(0, 5),
			calendarData,
			topSubjects
		})
	} catch (error) {
		console.error('Error fetching reading statistics:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch reading statistics' },
			{ status: 500 }
		)
	}
}
