'use server'
import OpenAI from 'openai'

const API_KEY = process.env.GROQ_API_KEY || ''
const isApiKeyConfigured = !!process.env.GROQ_API_KEY

if (!isApiKeyConfigured) {
	console.warn(
		'⚠️  GROQ_API_KEY is not configured. AI features will be disabled.'
	)
	console.warn('📝 To enable AI features, add your Groq API key to .env:')
	console.warn('   GROQ_API_KEY=your-groq-api-key-here')
	console.warn('🔗 Get your API key at: https://console.groq.com/keys')
}

const openai = new OpenAI({
	apiKey: API_KEY || 'dummy-key',
	baseURL: 'https://api.groq.com/openai/v1'
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
			'AI service is not configured. Please add your Groq API key to the environment variables.'
		)
	}

	try {
		// Qwen3 on Groq is a reasoning model. `reasoning_effort: 'none'` disables
		// chain-of-thought so answers stay concise and fit the token budget
		// (it is a Groq-specific field, hence the cast). `stream: false` selects
		// the non-streaming overload so the result has `.choices`.
		const response = await openai.chat.completions.create({
			...params,
			stream: false,
			reasoning_effort: 'none'
		} as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
		return response
	} catch (error: any) {
		if (error?.status === 403) {
			console.error(
				'Groq Authentication Error: Please check your account at https://console.groq.com'
			)
			throw new Error(
				'Groq API authentication failed. Please check your account setup at https://console.groq.com'
			)
		}

		if (error?.status === 401) {
			console.error('Groq API Key Error: Invalid or expired API key')
			throw new Error(
				'Invalid Groq API key. Please check your API key at https://console.groq.com/keys'
			)
		}

		console.error('Groq API Error:', error)
		throw error
	}
}
