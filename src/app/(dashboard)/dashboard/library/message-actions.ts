'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db'
import { unstable_cache } from 'next/cache'

export interface Message {
	role: 'user' | 'bot'
	content: string
	timestamp?: Date
}

/**
 * Saves a message to a transaction
 * @param transactionId The ID of the transaction to save the message to
 * @param message The message to save (object with role and content)
 * @returns True if the message was saved successfully, false otherwise
 */
export async function saveMessageToTransaction(
	transactionId: string,
	message: Message
): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const transaction = await prisma.transactions.findFirst({
			where: {
				id: transactionId,
				userId
			}
		})

		if (!transaction) {
			return false
		}

		const existingMessages = transaction.messages || []

		const messageToStore = JSON.stringify({
			...message,
			timestamp: message.timestamp || new Date().toISOString()
		})

		await prisma.transactions.update({
			where: {
				id: transactionId
			},
			data: {
				messages: [...existingMessages, messageToStore],
				updatedAt: new Date()
			}
		})

		return true
	} catch (error) {
		return false
	}
}

/**
 * Saves multiple messages to a transaction
 * @param transactionId The ID of the transaction to save the messages to
 * @param messages Array of messages to save
 * @returns True if the messages were saved successfully, false otherwise
 */
export async function saveMessagesToTransaction(
	transactionId: string,
	messages: Message[]
): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const transaction = await prisma.transactions.findFirst({
			where: {
				id: transactionId,
				userId
			}
		})

		if (!transaction) {
			return false
		}

		const messagesToStore = messages.map(message =>
			JSON.stringify({
				...message,
				timestamp: message.timestamp || new Date().toISOString()
			})
		)

		await prisma.transactions.update({
			where: {
				id: transactionId
			},
			data: {
				messages: messagesToStore,
				updatedAt: new Date()
			}
		})

		return true
	} catch (error) {
		return false
	}
}

/**
 * Loads messages from a transaction
 * @param transactionId The ID of the transaction to load messages from
 * @returns Array of messages or null if an error occurred
 */
export const getTransactionMessagesCached = unstable_cache(
	async (
		transactionId: string,
		userId: string
	): Promise<Message[] | null> => {
		try {
			if (!userId) {
				return null
			}

			const transaction = await prisma.transactions.findFirst({
				where: {
					id: transactionId,
					userId
				}
			})

			if (!transaction) {
				return null
			}

			const storedMessages = transaction.messages || []

			const parsedMessages = storedMessages.map(messageString => {
				try {
					const parsed = JSON.parse(messageString)
					return {
						role: parsed.role,
						content: parsed.content,
						timestamp: parsed.timestamp
							? new Date(parsed.timestamp)
							: undefined
					} as Message
				} catch (e) {
					return {
						role: 'bot' as const,
						content: 'Error: Message could not be loaded',
						timestamp: new Date()
					}
				}
			})

			return parsedMessages
		} catch (error) {
			return null
		}
	},
	['transaction-messages'],
	{ revalidate: 30 }
)

/**
 * Helper function that handles auth and calls the cached function
 * @param transactionId The ID of the transaction to load messages from
 * @returns Array of messages or empty array if an error occurred
 */
export async function getTransactionMessages(
	transactionId: string
): Promise<Message[]> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return []
		}

		const messages = await getTransactionMessagesCached(
			transactionId,
			userId
		)
		return messages || []
	} catch (error) {
		return []
	}
}

/**
 * Clears all messages from a transaction
 * @param transactionId The ID of the transaction to clear messages from
 * @returns True if the messages were cleared successfully, false otherwise
 */
export async function clearTransactionMessages(
	transactionId: string
): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const transaction = await prisma.transactions.findFirst({
			where: {
				id: transactionId,
				userId
			}
		})

		if (!transaction) {
			return false
		}

		await prisma.transactions.update({
			where: {
				id: transactionId
			},
			data: {
				messages: [],
				updatedAt: new Date()
			}
		})

		return true
	} catch (error) {
		return false
	}
}

/**
 * Searches for messages in a transaction by query string
 * @param transactionId The ID of the transaction to search in
 * @param query The query string to search for
 * @returns Array of messages that match the query or empty array if an error occurred
 */
export async function searchTransactionMessages(
	transactionId: string,
	query: string
): Promise<Message[]> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return []
		}

		if (!query.trim()) {
			return getTransactionMessages(transactionId)
		}

		const allMessages = await getTransactionMessages(transactionId)

		const normalizedQuery = query.toLowerCase()
		const filteredMessages = allMessages.filter(message =>
			message.content.toLowerCase().includes(normalizedQuery)
		)

		return filteredMessages
	} catch (error) {
		return []
	}
}

/**
 * Gets messages from a specific date range
 * @param transactionId The ID of the transaction to get messages from
 * @param startDate The start date (inclusive)
 * @param endDate The end date (inclusive)
 * @returns Array of messages in the date range or empty array if an error occurred
 */
export async function getTransactionMessagesByDateRange(
	transactionId: string,
	startDate: Date,
	endDate: Date
): Promise<Message[]> {
	try {
		const allMessages = await getTransactionMessages(transactionId)

		const filteredMessages = allMessages.filter(message => {
			const messageDate = message.timestamp || new Date(0)
			return messageDate >= startDate && messageDate <= endDate
		})

		return filteredMessages
	} catch (error) {
		return []
	}
}

/**
 * Gets the last N messages from a transaction
 * @param transactionId The ID of the transaction to get messages from
 * @param count The number of messages to retrieve
 * @returns Array of the last N messages or empty array if an error occurred
 */
export async function getLastTransactionMessages(
	transactionId: string,
	count: number = 10
): Promise<Message[]> {
	try {
		const allMessages = await getTransactionMessages(transactionId)

		const lastMessages = allMessages.slice(-count)

		return lastMessages
	} catch (error) {
		return []
	}
}

/**
 * Updates a specific message in a transaction
 * @param transactionId The ID of the transaction
 * @param messageIndex The index of the message to update
 * @param updatedMessage The updated message content
 * @returns True if the message was updated successfully, false otherwise
 */
export async function updateTransactionMessage(
	transactionId: string,
	messageIndex: number,
	updatedMessage: Partial<Message>
): Promise<boolean> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return false
		}

		const transaction = await prisma.transactions.findFirst({
			where: {
				id: transactionId,
				userId
			}
		})

		if (!transaction) {
			return false
		}

		const existingMessages = transaction.messages || []

		if (messageIndex < 0 || messageIndex >= existingMessages.length) {
			return false
		}

		let originalMessage: Message
		try {
			originalMessage = JSON.parse(existingMessages[messageIndex])
		} catch (e) {
			return false
		}

		const mergedMessage = {
			...originalMessage,
			...updatedMessage,
			timestamp:
				updatedMessage.timestamp ||
				originalMessage.timestamp ||
				new Date().toISOString()
		}

		const messageToStore = JSON.stringify(mergedMessage)

		const updatedMessages = [...existingMessages]
		updatedMessages[messageIndex] = messageToStore

		await prisma.transactions.update({
			where: {
				id: transactionId
			},
			data: {
				messages: updatedMessages,
				updatedAt: new Date()
			}
		})

		return true
	} catch (error) {
		return false
	}
}
