'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { createChatCompletion } from '@/lib/ai'
import { unstable_cache } from 'next/cache'

export async function getBookTransaction(
	id: string,
	bookId: string,
	bookTitle: string,
	bookAuthor: string,
	bookCover: string
) {
	const { userId } = await auth()
	if (!userId) {
		throw new Error('User ID is null')
	}

	const transaction = await prisma.transactions.upsert({
		where: {
			userId_bookId: {
				userId,
				bookId
			}
		},
		update: {
			updatedAt: new Date()
		},
		create: {
			userId,
			bookId,
			bookTitle,
			bookAuthor,
			bookCover
		}
	})

	return transaction.id
}

export const getBookTransactionDataById = unstable_cache(
	async (id: string) => {
		const transaction = await prisma.transactions.findUnique({
			where: {
				id: id
			}
		})

		return transaction
	},
	['transaction-by-id'],
	{ revalidate: 60 }
)

export const getUserLibraryData = unstable_cache(
	async (userId: string) => {
		if (!userId) {
			throw new Error('User ID is null')
		}

		const library = await prisma.userLibrary.findMany({
			where: {
				userId: userId
			},
			orderBy: {
				updatedAt: 'desc'
			}
		})

		return library
	},
	['user-library'],
	{ revalidate: 60 }
)

export async function getUserLibrary() {
	const { userId } = await auth()
	if (!userId) {
		throw new Error('User ID is null')
	}

	return getUserLibraryData(userId)
}

const MAX_SUMMARY_LENGTH = 10000
const RATE_LIMIT_DELAY = 1000

function truncateContent(content: string, maxLength: number): string {
	return content.slice(0, maxLength)
}

export const summarizeContent = async (
	bookContent: string
): Promise<string> => {
	const truncatedContent = truncateContent(bookContent, MAX_SUMMARY_LENGTH)
	const summaryPrompt = `
        Summarize the following content briefly:
        ${truncatedContent}
    `

	try {
		const response = await createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{ role: 'system', content: 'You are a summarizer AI.' },
				{ role: 'user', content: summaryPrompt }
			]
		})

		return (
			response.choices[0].message.content ||
			truncatedContent.slice(0, 1000)
		)
	} catch (error) {
		return truncatedContent.slice(0, 1000)
	}
}

export const getBookContent = async (bookId: string): Promise<string> => {
	try {
		const response = await fetch(
			`https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`
		)

		if (!response.ok) {
			const alternateResponse = await fetch(
				`https://www.gutenberg.org/files/${bookId}/${bookId}.txt`
			)
			if (!alternateResponse.ok) {
				return ''
			}
			return alternateResponse.text()
		}

		return response.text()
	} catch (error) {
		return ''
	}
}

export const getAIResponse = async (
	userMessage: string,
	bookContent: string
): Promise<string> => {
	try {
		const prompt = `
        I am an AI assistant specializing in analyzing and discussing books.
        I will provide insights, analysis, and answer questions about books based on the content provided.
        
        The book content is:
        ${truncateContent(bookContent, 5000)}
        
        The user's question or message is:
        ${userMessage}
        
        Provide a thoughtful and insightful response to the user's message based on the book content.
        If the user's message isn't specifically about the book, I'll provide a general response related to the book.
        If I don't know the answer to something specific, I'll be honest about it.
        `

		const response = await createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{ role: 'system', content: 'You are a book analysis AI.' },
				{ role: 'user', content: prompt }
			]
		})

		return (
			response.choices[0].message.content ||
			"I'm sorry, I couldn't analyze this book content at the moment."
		)
	} catch (error) {
		return "I'm sorry, I couldn't analyze this book content at the moment. Please try again later."
	}
}
