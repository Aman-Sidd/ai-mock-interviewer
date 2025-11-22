/**
 * Interview Engine - Core logic for managing interview sessions,
 * persona detection, follow-up decisions, and feedback synthesis
 */

import { InterviewSession, Persona, Role, FeedbackReport } from './types'
import { generateResponse, buildMessages, renderTemplate, loadPromptFile, Message } from './openrouter'

// Simple UUID generator (no dependency)
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// In-memory session storage (MVP - replace with DB in production)
const sessions = new Map<string, InterviewSession>()

export async function startSession(
  role: Role,
  persona: Persona,
  duration: number
): Promise<{ sessionId: string; firstQuestion: string }> {
  const sessionId = generateId()

  // Load system prompt
  const systemPrompt = await loadPromptFile('system_interviewer.txt')

  // Load role-specific prompt
  const roleTemplate = await loadPromptFile(`role_templates/${role}.txt`)

  // Combine prompts
  const combinedSystemPrompt = `${systemPrompt}\n\n${roleTemplate}`

  // Generate first question
  const firstQuestion = await generateResponse(
    buildMessages(combinedSystemPrompt, [], 'Start the interview with your first question'),
    { temperature: 0.7, max_tokens: 200 }
  )

  // Create session
  const session: InterviewSession = {
    id: sessionId,
    role,
    persona,
    duration,
    turnCount: 1,
    maxTurns: Math.min(Math.max(Math.ceil(duration / 5), 4), 6), // 4-6 turns based on duration
    history: [
      {
        speaker: 'assistant',
        content: firstQuestion,
        timestamp: new Date()
      }
    ],
    state: 'in-progress',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  sessions.set(sessionId, session)
  return { sessionId, firstQuestion }
}

/**
 * Submit a user answer and get the next action
 */
export async function submitAnswer(
  sessionId: string,
  userAnswer: string
): Promise<{
  acknowledged: boolean
  action: 'followup' | 'next-question' | 'end-interview'
  assistantResponse: string
  turnCount: number
  maxTurns: number
}> {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  // Add user answer to history
  session.history.push({
    speaker: 'user',
    content: userAnswer,
    timestamp: new Date()
  })

  // Load prompts
  const systemPrompt = await loadPromptFile('system_interviewer.txt')
  const roleTemplate = await loadPromptFile(`role_templates/${session.role}.txt`)
  const followupDetector = await loadPromptFile('followup_detector.txt')
  const combinedSystemPrompt = `${systemPrompt}\n\n${roleTemplate}`

  // Detect persona and decide action
  const personaAnalysis = await generateResponse(
    buildMessages(
      followupDetector,
      [],
      `Analyze this answer for depth and decide next action: "${userAnswer}"`
    ),
    { temperature: 0.2, max_tokens: 150 }
  )

  // Determine action based on analysis and turn count
  let action: 'followup' | 'next-question' | 'end-interview' = 'next-question'

  if (session.turnCount >= session.maxTurns) {
    action = 'end-interview'
  } else if (
    personaAnalysis.toLowerCase().includes('shallow') ||
    personaAnalysis.toLowerCase().includes('followup')
  ) {
    action = 'followup'
  }

  // Generate response based on action
  let assistantResponse = ''

  if (action === 'followup') {
    const historyAsMessages = session.history.map((m) => ({
      role: m.speaker === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }))
    assistantResponse = await generateResponse(
      buildMessages(
        combinedSystemPrompt,
        historyAsMessages,
        'Ask a probing follow-up question based on their answer.'
      ),
      { temperature: 0.6, max_tokens: 200 }
    )
  } else if (action === 'next-question') {
    const historyAsMessages = session.history.map((m) => ({
      role: m.speaker === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }))
    assistantResponse = await generateResponse(
      buildMessages(
        combinedSystemPrompt,
        historyAsMessages,
        'Ask the next interview question. Make it different from previous ones.'
      ),
      { temperature: 0.6, max_tokens: 200 }
    )
  } else {
    // end-interview
    assistantResponse =
      "Thank you for the interview. Let me analyze your responses and prepare your feedback."
    session.state = 'completed'
  }

  // Add assistant response to history
  session.history.push({
    speaker: 'assistant',
    content: assistantResponse,
    timestamp: new Date()
  })

  session.turnCount++
  session.updatedAt = new Date()

  return {
    acknowledged: true,
    action,
    assistantResponse,
    turnCount: session.turnCount,
    maxTurns: session.maxTurns
  }
}

/**
 * Generate feedback for a completed interview
 */
export async function generateFeedback(sessionId: string): Promise<FeedbackReport> {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  // Load feedback template
  const feedbackTemplate = await loadPromptFile('feedback_generator.txt')
  const prompt = renderTemplate(feedbackTemplate, { ROLE: session.role })

  // Build conversation summary
  const conversationSummary = session.history
    .map((msg) => `${msg.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
    .join('\n\n')

  // Generate feedback JSON
  const feedbackJson = await generateResponse(
    buildMessages(
      prompt,
      [],
      `Interview conversation:\n\n${conversationSummary}`
    ),
    { temperature: 0.5, max_tokens: 600 }
  )

  // Parse feedback
  try {
    const feedback = JSON.parse(feedbackJson)
    return {
      overallScore: feedback.overallScore || 5,
      strengths: feedback.strengths || [],
      weaknesses: feedback.weaknesses || [],
      actionableTips: feedback.actionableTips || [],
      roleEvaluation: feedback.roleEvaluation || ''
    }
  } catch (error) {
    console.error('Failed to parse feedback:', error)
    return {
      overallScore: 5,
      strengths: ['Good participation'],
      weaknesses: ['Feedback parsing error'],
      actionableTips: ['Try again'],
      roleEvaluation: 'Unable to generate evaluation'
    }
  }
}

/**
 * Get session data
 */
export function getSession(sessionId: string): InterviewSession | undefined {
  return sessions.get(sessionId)
}

/**
 * Detect persona from answers (heuristics)
 */
export function detectPersona(answers: string[]): Persona {
  if (answers.length === 0) return 'edge-case'

  const totalWords = answers.reduce((sum, ans) => sum + ans.split(/\s+/).length, 0)
  const avgLength = totalWords / answers.length

  // Heuristics
  if (avgLength < 30) return 'efficient'
  if (avgLength > 150) return 'chatty'
  if (answers.some((a) => a.includes("don't know") || a.includes('not sure'))) return 'confused'

  return 'efficient'
}
