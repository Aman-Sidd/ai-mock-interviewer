/**
 * OpenRouter SDK wrapper for Deepseek API integration
 * Uses the `openai` npm package configured for OpenRouter endpoint
 */

import OpenAI from 'openai'

// Initialize OpenRouter client
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'AI Interview Practice Partner'
  }
})

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GenerateOptions {
  temperature?: number
  max_tokens?: number
}

/**
 * Generate a response using Deepseek via OpenRouter
 * @param messages - Conversation history with system prompt
 * @param options - Temperature and max_tokens
 * @returns Assistant's response text
 */
export async function generateResponse(
  messages: Message[],
  options: GenerateOptions = {}
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured. Please add it to .env.local')
  }

  const maxRetries = 5
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openrouter.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1000
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenRouter response')
      }

      return content
    } catch (error: any) {
      lastError = error as Error
      const status = error?.status || error?.code
      
      console.error(`OpenRouter attempt ${attempt}/${maxRetries} failed (status: ${status}):`, error?.message)

      // For 429 (rate limit), use longer backoff; for other errors, standard backoff
      let delayMs = 0
      if (attempt < maxRetries) {
        if (status === 429) {
          // Rate limit: 3s, 6s, 12s, 24s, 48s
          delayMs = Math.pow(2, attempt) * 3000
        } else {
          // Other errors: 1s, 2s, 4s, 8s, 16s (exponential backoff)
          delayMs = Math.pow(2, attempt - 1) * 1000
        }
        console.log(`Retrying in ${delayMs}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw new Error(`Failed to generate response after ${maxRetries} attempts: ${lastError?.message}`)
}

/**
 * Build messages array for conversation context
 * @param systemPrompt - System instructions for the interviewer
 * @param history - Conversation history
 * @param userMessage - Latest user message
 * @returns Formatted messages array for API
 */
export function buildMessages(
  systemPrompt: string,
  history: Message[],
  userMessage: string
): Message[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ]
}

/**
 * Extract text from a file path in the prompts folder
 * Used to load prompt templates at runtime
 */
export async function loadPromptFile(filePath: string): Promise<string> {
  try {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const fullPath = join(process.cwd(), 'prompts', filePath)
    return readFileSync(fullPath, 'utf-8')
  } catch (error) {
    console.error(`Failed to load prompt file: ${filePath}`, error)
    return ''
  }
}

/**
 * Render template variables in prompt text
 * Usage: renderTemplate("Hello {{name}}", { name: "John" }) → "Hello John"
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(`{{${key}}}`, value)
  })
  return result
}
