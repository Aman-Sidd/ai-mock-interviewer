import { renderTemplate } from '@/lib/llm'

const PROMPT = `You are an expert technical interviewer. Your task is to generate interview questions based on the following inputs:

Job Title: {{jobTitle}}
Job Description: {{jobDescription}}
Interview Duration: {{duration}}
Interview Type: {{type}}

IMPORTANT: Return ONLY a JSON object in the following format, with no additional text or explanations:

{
  "interviewQuestions": [
    {
      "question": "Your question here",
      "type": "Technical/Behavioral/Experience/Problem Solving/Leadership"
    }
  ]
}

Guidelines for generating questions:
1. Analyze the job description to identify key responsibilities, required skills, and expected experience
2. Generate questions based on the interview duration (shorter duration = fewer questions)
3. Ensure questions match the tone and structure of a {{type}} interview
4. Include a mix of question types based on the interview type
5. Focus on the most important aspects of the role

Remember: Return ONLY the JSON object, no other text or explanations. Also, remember to not add "json" as prefix`

function extractJsonWithKey(text: string, key = 'interviewQuestions') {
  const regex = new RegExp("\\{[\\s\\S]*?\"" + key + "\"[\\s\\S]*?\\}", 'g')
  const match = text.match(regex)
  if (match && match.length > 0) return match[0]

  const loose = text.match(/\{[\s\S]*\}/)
  return loose ? loose[0] : null
}

export async function POST(request: Request) {
  try {
    const { job_position, job_description, interview_duration, interview_types } = await request.json()

    if (!job_position || !job_description || !interview_duration || !Array.isArray(interview_types) || interview_types.length === 0) {
      return Response.json(
        { error: 'Missing required fields: job_position, job_description, interview_duration, interview_types' },
        { status: 400 }
      )
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json(
        { error: 'OPENROUTER_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const prompt = renderTemplate(PROMPT, {
      jobTitle: job_position,
      jobDescription: job_description,
      duration: interview_duration,
      type: interview_types[0]
    })

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
        temperature: 0.2,
        max_tokens: 700
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
    const raw = body?.choices?.[0]?.message?.content

    if (!raw) {
      return Response.json(
        { error: 'No content in OpenRouter response', body },
        { status: 502 }
      )
    }

    const cleaned = String(raw).replace(/```/g, '').trim()
    const jsonStr = extractJsonWithKey(cleaned, 'interviewQuestions')

    if (!jsonStr) {
      return Response.json(
        { error: 'Failed to extract JSON from model response', raw: cleaned },
        { status: 500 }
      )
    }

    try {
      const parsed = JSON.parse(jsonStr)
      if (!Array.isArray(parsed.interviewQuestions)) {
        return Response.json(
          { error: 'Model response did not contain interviewQuestions array', parsed },
          { status: 500 }
        )
      }

      return Response.json({ questions: parsed.interviewQuestions })
    } catch (err: any) {
      return Response.json(
        { error: 'Failed to parse JSON from model', parseError: err?.message, raw: jsonStr },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('generate-questions error:', error)
    return Response.json(
      { error: 'Internal error', details: error?.message },
      { status: 500 }
    )
  }
}
