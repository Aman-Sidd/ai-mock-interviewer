import { NextRequest, NextResponse } from 'next/server'
import { generateFeedback } from '@/lib/interviewEngine'
import { GetFeedbackResponse } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      )
    }

    const feedback = await generateFeedback(sessionId)

    const response: GetFeedbackResponse = {
      feedback
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: any) {
    console.error('get-feedback error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate feedback' },
      { status: 500 }
    )
  }
}
