'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { createChatCompletion } from '@/lib/ai'
import { checkAiRateLimit } from '@/lib/rate-limit'
import { unstable_cache } from 'next/cache'
import { revalidatePath, revalidateTag } from 'next/cache'

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

	const [transaction] = await Promise.all([
		prisma.transactions.upsert({
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
		}),
		prisma.userLibrary.upsert({
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
	])

	revalidateTag('library')
	return transaction.id
}

const getBookTransactionDataByIdCached = unstable_cache(
	async (id: string, userId: string) => {
		return prisma.transactions.findFirst({
			where: { id, userId }
		})
	},
	['transaction-by-id'],
	{ revalidate: 60 }
)

export async function getBookTransactionDataById(id: string) {
	const { userId } = await auth()
	if (!userId) return null
	return getBookTransactionDataByIdCached(id, userId)
}

export interface LibraryBook {
	id: string
	userId: string
	bookTitle: string
	bookId: string
	bookCover: string | null
	bookAuthor: string | null
	createdAt: Date
	updatedAt: Date
	favorite: boolean
}

export const getUserLibraryData = unstable_cache(
	async (userId: string) => {
		if (!userId) {
			throw new Error('User ID is null')
		}

		const library = await prisma.userLibrary.findMany({
			where: {
				userId
			},
			orderBy: {
				updatedAt: 'desc'
			}
		})

		return library
	},
	['user-library-data'],
	{
		revalidate: 300,
		tags: ['library']
	}
)

export async function revalidateLibrary(userId: string) {
	'use server'
	revalidatePath('/dashboard/library')
	revalidateTag('library')
}

export async function getUserLibrary() {
	const { userId } = await auth()
	if (!userId) {
		throw new Error('User ID is null')
	}

	const data = await getUserLibraryData(userId)
	return data
}

const MAX_SUMMARY_LENGTH = 10000

function truncateContent(content: string, maxLength: number): string {
	return content.slice(0, maxLength)
}

export const summarizeContent = async (
	bookContent: string
): Promise<string> => {
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const { allowed } = await checkAiRateLimit(userId)
	if (!allowed) {
		return truncateContent(bookContent, MAX_SUMMARY_LENGTH).slice(0, 1000)
	}

	const truncatedContent = truncateContent(bookContent, MAX_SUMMARY_LENGTH)
	const summaryPrompt = `Summarize in 3-4 sentences max: ${truncatedContent}`

	try {
		const response = await createChatCompletion({
			model: 'qwen/qwen3-32b',
			messages: [
				{
					role: 'system',
					content:
						'You are a concise book summarizer. Keep responses under 100 words.'
				},
				{ role: 'user', content: summaryPrompt }
			],
			temperature: 0.3,
			max_tokens: 300
		})

		return (
			response.choices[0].message.content ||
			truncatedContent.slice(0, 1000)
		)
	} catch (error: any) {
		console.error('Summary Error:', error)
		if (error?.message?.includes('not configured')) {
			return '⚠️ AI summarization is disabled. Please configure your Groq API key (GROQ_API_KEY) to enable this feature.'
		}
		if (error?.message?.includes('authentication failed')) {
			return '⚠️ AI authentication failed. Please check your API key at https://console.groq.com/keys'
		}
		return truncatedContent.slice(0, 1000)
	}
}

export const getBookContent = async (bookId: string): Promise<string> => {
	const { userId } = await auth()
	if (!userId) return ''

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
	const { userId } = await auth()
	if (!userId) throw new Error('Unauthorized')

	const { allowed } = await checkAiRateLimit(userId)
	if (!allowed) {
		return "⏳ You've reached the hourly limit for AI requests. Please try again later."
	}

	try {
		const prompt = `Book: ${truncateContent(bookContent, 3000)}

Question: ${userMessage}

Answer briefly (max 150 words):`

		const response = await createChatCompletion({
			model: 'qwen/qwen3-32b',
			messages: [
				{
					role: 'system',
					content:
						'You are a book analysis assistant. Keep responses under 150 words. Answer with the minimum information required. Do not explain reasoning unless explicitly asked. Do not add examples, background, author references, or interpretations. Respond in one or two sentences when possible.'
				},
				{ role: 'user', content: prompt }
			],
			temperature: 0.5,
			max_tokens: 400
		})

		return (
			response.choices[0].message.content ||
			"I'm sorry, I couldn't analyze this book content at the moment."
		)
	} catch (error: any) {
		console.error('AI Response Error:', error)

		if (error?.message?.includes('not configured')) {
			return '⚠️ **AI Chat is Disabled**\n\nTo enable AI chat features, please:\n1. Get your API key from https://console.groq.com/keys\n2. Add it to your `.env` file as `GROQ_API_KEY=your-key-here`\n3. Restart the development server'
		}

		if (error?.message?.includes('authentication failed')) {
			return '⚠️ **Authentication Failed**\n\nPlease check your Groq API key at https://console.groq.com/keys to use AI features.'
		}

		if (error?.message?.includes('Invalid')) {
			return '⚠️ **Invalid API Key**\n\nYour Groq API key appears to be invalid or expired. Please check your configuration at https://console.groq.com/keys'
		}

		return "I'm sorry, I couldn't analyze this book content at the moment. Please try again later."
	}
}

export async function toggleBookFavorite(
	bookId: string,
	currentFavoriteState: boolean
): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		await prisma.userLibrary.updateMany({
			where: {
				userId,
				bookId
			},
			data: {
				favorite: !currentFavoriteState
			}
		})

		revalidateTag('library')
		return true
	} catch (error) {
		return false
	}
}
