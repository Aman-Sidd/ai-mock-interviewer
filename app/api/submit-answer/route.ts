import { NextRequest, NextResponse } from 'next/server'
import { submitAnswer } from '@/lib/interviewEngine'
import { SubmitAnswerRequest, SubmitAnswerResponse } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body: SubmitAnswerRequest = await request.json()
    const { sessionId, answer } = body

    if (!sessionId || !answer) {
      return NextResponse.json(
        { error: 'Missing sessionId or answer' },
        { status: 400 }
      )
    }

    const result = await submitAnswer(sessionId, answer)

    const response: SubmitAnswerResponse = {
      acknowledged: result.acknowledged,
      action: result.action,
      assistantResponse: result.assistantResponse,
      turnCount: result.turnCount,
      maxTurns: result.maxTurns,
      detectedPersona: result.detectedPersona
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: any) {
    console.error('submit-answer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit answer' },
      { status: 500 }
    )
  }
}
