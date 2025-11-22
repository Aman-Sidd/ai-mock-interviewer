/**
 * OpenRouter API endpoint for chat completions.
 * Proxies requests to OpenRouter's Deepseek model.
 */

export async function POST(request: Request) {
  try {
    const { prompt, temperature = 0.3, max_tokens = 512 } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return Response.json(
        { error: 'Missing or invalid `prompt` in request body' },
        { status: 400 }
      )
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json(
        { error: 'OPENROUTER_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
    const resp = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens
      })
    })

    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      console.error('OpenRouter error:', resp.status, t)
      return Response.json(
        { error: 'OpenRouter API error', status: resp.status, details: t },
        { status: 502 }
      )
    }

    const body = await resp.json()
    const content = body?.choices?.[0]?.message?.content

    if (!content) {
      return Response.json(
        { error: 'No content in OpenRouter response', body },
        { status: 502 }
      )
    }

    return Response.json({ content })
  } catch (err: any) {
    console.error('OpenRouter proxy error:', err)
    return Response.json(
      { error: 'Internal error', details: err?.message },
      { status: 500 }
    )
  }
}
