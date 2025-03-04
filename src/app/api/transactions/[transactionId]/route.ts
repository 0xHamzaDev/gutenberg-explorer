import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET(
	request: Request,
	{ params }: { params: { transactionId: string } }
) {
	try {
		const { userId } = await auth()

		if (!userId) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 }
			)
		}

		const transactionId = params.transactionId

		const transaction = await prisma.transactions.findFirst({
			where: {
				id: transactionId,
				userId
			}
		})

		if (!transaction) {
			return NextResponse.json(
				{ error: 'Transaction not found' },
				{ status: 404 }
			)
		}

		return NextResponse.json({
			id: transaction.id,
			bookId: transaction.bookId,
			bookTitle: transaction.bookTitle,
			bookAuthor: transaction.bookAuthor,
			createdAt: transaction.createdAt,
			updatedAt: transaction.updatedAt
		})
	} catch (error) {
		console.error('Error fetching transaction:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch transaction' },
			{ status: 500 }
		)
	}
}
