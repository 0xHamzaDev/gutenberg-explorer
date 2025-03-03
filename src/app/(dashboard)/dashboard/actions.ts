'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { unstable_cache } from 'next/cache'

const monthNames = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
]

interface TransactionData {
	month: string
	transactions: number
}

export interface Transaction {
	id: string
	userId: string
	bookId: string
	bookTitle: string
	bookAuthor: string | null
	bookCover: string | null
	messages?: string[]
	updatedAt: Date
	createdAt: Date
}

export const getUserTransactionsChartDataCached = unstable_cache(
	async (userId: string): Promise<TransactionData[]> => {
		if (!userId) {
			throw new Error('User not authenticated')
		}

		const transactions = await prisma.transactions.findMany({
			where: { userId },
			orderBy: { createdAt: 'asc' }
		})

		const chartDataMap = new Map<string, number>()

		transactions.forEach(transaction => {
			const month = monthNames[new Date(transaction.createdAt).getMonth()]
			chartDataMap.set(month, (chartDataMap.get(month) || 0) + 1)
		})

		const chartData = Array.from(chartDataMap.entries()).map(
			([month, count]) => ({
				month,
				transactions: count
			})
		)

		chartData.sort(
			(a, b) => monthNames.indexOf(a.month) - monthNames.indexOf(b.month)
		)

		return chartData
	},
	['user-transactions-chart'],
	{ revalidate: 3600 }
)

export async function getUserTransactionsChartData(): Promise<
	TransactionData[]
> {
	const { userId } = await auth()

	if (!userId) {
		throw new Error('User not authenticated')
	}

	return getUserTransactionsChartDataCached(userId)
}

export const getUserLastTransactions = unstable_cache(
	async (userId: string): Promise<Transaction[]> => {
		if (!userId) {
			throw new Error('User not authenticated')
		}

		const transactions = await prisma.transactions.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			take: 10
		})

		return transactions
	},
	['user-last-transactions'],
	{ revalidate: 300 }
)

export async function getUserTransactions(): Promise<Transaction[]> {
	const { userId } = await auth()

	if (!userId) {
		throw new Error('User not authenticated')
	}

	return getUserLastTransactions(userId)
}
