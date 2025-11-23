/**
 * Groq SDK wrapper for LLM API integration
 * Uses the `groq-sdk` npm package for fast LLM inference
 */

import { Groq } from 'groq-sdk'

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
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
 * Generate a response using Groq
 * @param messages - Conversation history with system prompt
 * @param options - Temperature and max_tokens
 * @returns Assistant's response text
 */
export async function generateResponse(
  messages: Message[],
  options: GenerateOptions = {}
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured. Please add it to .env.local')
  }

  const maxRetries = 5
  let lastError: Error | null = null
  const modelName = 'llama-3.1-8b-instant'

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n[Groq] Attempt ${attempt}/${maxRetries}`)
      console.log(`[Groq] Model: ${modelName}`)
      console.log(`[Groq] Messages: ${messages.length} items`)
      
      const response = await groq.chat.completions.create({
        model: modelName,
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_completion_tokens: options.max_tokens ?? 1000
      })

      console.log(`[Groq] Response structure:`, {
        has_choices: !!response.choices,
        choices_length: response.choices?.length,
        first_choice_keys: response.choices?.[0] ? Object.keys(response.choices[0]) : 'N/A',
        message_keys: response.choices?.[0]?.message ? Object.keys(response.choices[0].message) : 'N/A'
      })

      const content = response.choices?.[0]?.message?.content
      console.log(`[Groq] Content type: ${typeof content}, length: ${content?.length || 0}`)
      
      if (!content) {
        console.error(`[Groq] FULL RESPONSE:`, JSON.stringify(response, null, 2))
        throw new Error('No content in Groq response')
      }

      console.log(`[Groq] ✓ Success on attempt ${attempt}`)
      return content
    } catch (error: any) {
      lastError = error as Error
      const status = error?.status || error?.code
      
      console.error(`[Groq] ✗ Attempt ${attempt}/${maxRetries} failed`)
      console.error(`[Groq] Status: ${status}`)
      console.error(`[Groq] Error message: ${error?.message}`)
      if (attempt === maxRetries) {
        console.error(`[Groq] FULL ERROR:`, error)
      }

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
        console.log(`[Groq] ⏳ Retrying in ${delayMs}ms...`)
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
