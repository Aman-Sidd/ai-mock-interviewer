import { NextRequest, NextResponse } from 'next/server'
import { startSession } from '@/lib/interviewEngine'
import { StartInterviewRequest, StartInterviewResponse } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body: StartInterviewRequest = await request.json()
    const { role, persona, duration } = body

    if (!role || !persona || !duration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { sessionId, firstQuestion } = await startSession(role, persona, duration)

    const response: StartInterviewResponse = {
      sessionId,
      firstQuestion,
      maxTurns: 6
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: any) {
    console.error('start-interview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start interview' },
      { status: 500 }
    )
  }
}
