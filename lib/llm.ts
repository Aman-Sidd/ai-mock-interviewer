/**
 * OpenRouter template rendering utility.
 * Simple template replacement for prompt variables: {{key}} -> value
 */

export function renderTemplate(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const val = vars[key]
    return val === undefined ? '' : String(val)
  })
}

/**
 * Call OpenRouter API via the /api/llm endpoint.
 * Returns the assistant's response content.
 */
export async function callOpenRouter(prompt: string, temperature = 0.3, max_tokens = 512): Promise<string> {
  const resp = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, temperature, max_tokens })
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`OpenRouter error: ${resp.status} ${err?.error || ''}`)
  }

  const data = await resp.json()
  return data?.content || ''
}

