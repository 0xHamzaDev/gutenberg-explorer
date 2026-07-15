'use server'
import OpenAI from 'openai'

const API_KEY = process.env.OPENAI_API_KEY || ''
const isApiKeyConfigured = !!process.env.OPENAI_API_KEY

if (!isApiKeyConfigured) {
	console.warn(
		'⚠️  OPENAI_API_KEY is not configured. AI features will be disabled.'
	)
	console.warn(
		'📝 To enable AI features, add your SambaNova API key to .env.local:'
	)
	console.warn('   OPENAI_API_KEY=your-sambanova-api-key-here')
	console.warn('🔗 Get your API key at: https://cloud.sambanova.ai/apis')
}

const openai = new OpenAI({
	apiKey: API_KEY || 'dummy-key',
	baseURL: 'https://api.sambanova.ai/v1'
})

interface ChatCompletionParams {
	model: string
	messages: Array<{
		role: 'system' | 'user' | 'assistant'
		content: string
	}>
	temperature?: number
	max_tokens?: number
}

export async function createChatCompletion(
	params: ChatCompletionParams
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
	if (!isApiKeyConfigured) {
		throw new Error(
			'AI service is not configured. Please add your SambaNova API key to the environment variables.'
		)
	}

	try {
		const response = await openai.chat.completions.create({
			...params,
			stream: false
		})
		return response
	} catch (error: any) {
		if (error?.status === 403) {
			console.error(
				'SambaNova Authentication Error: Please complete onboarding at https://cloud.sambanova.ai/apis'
			)
			throw new Error(
				'SambaNova API authentication failed. Please complete your account setup at https://cloud.sambanova.ai/apis'
			)
		}

		if (error?.status === 401) {
			console.error('SambaNova API Key Error: Invalid or expired API key')
			throw new Error(
				'Invalid SambaNova API key. Please check your API key at https://cloud.sambanova.ai/apis'
			)
		}

		console.error('SambaNova API Error:', error)
		throw error
	}
}
