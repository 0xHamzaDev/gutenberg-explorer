'use server'
import OpenAI from 'openai'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: 'https://api.sambanova.ai/v1'
})

async function createChatCompletion(params: any) {
	const response = await openai.chat.completions.create(params)
	return response
}

export { OpenAI, createChatCompletion }
