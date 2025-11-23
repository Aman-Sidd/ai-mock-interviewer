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

/**
 * Add persona-specific instructions to the interviewer prompt
 */
function addPersonaInstructions(basePrompt: string, persona: Persona | null): string {
  if (!persona) return basePrompt

  const personaInstructions = {
    efficient: `\n\n[COMMUNICATION STYLE: The user is efficient and wants quick, direct answers. Keep questions concise and focused. Avoid lengthy explanations.]`,
    chatty: `\n\n[COMMUNICATION STYLE: The user tends to be verbose and detailed. Be patient with longer answers. Gently redirect if they go off-topic, but acknowledge their enthusiasm.]`,
    confused: `\n\n[COMMUNICATION STYLE: The user may seem uncertain or confused. Be supportive and encouraging. Offer to rephrase questions or break them down. Provide clarification when needed.]`,
    'edge-case': `\n\n[COMMUNICATION STYLE: The user may provide off-topic or unexpected answers. Stay professional and redirect tactfully. If they go beyond your scope, acknowledge it and refocus on the role.]`
  }

  return basePrompt + (personaInstructions[persona] || '')
}

export async function startSession(
  role: Role,
  duration: number
): Promise<{ sessionId: string; firstQuestion: string }> {
  const sessionId = generateId()

  // Load system prompt
  const systemPrompt = await loadPromptFile('system_interviewer.txt')

  // Load role-specific prompt
  const roleTemplate = await loadPromptFile(`role_templates/${role}.txt`)

  // Combine prompts
  const combinedSystemPrompt = `${systemPrompt}\n\n${roleTemplate}`

  // Generate first question with specific instructions to be engaging
  const firstQuestionPrompt = `You're starting a mock interview for a ${role} position. Your goal is to start with an engaging, open-ended question that gets the candidate talking and helps you understand their experience and thinking.

Based on the role guidelines above, ask one specific opening question (NOT generic). Make it inviting and show genuine interest. Keep it to 2-3 sentences max.`

  const firstQuestion = await generateResponse(
    buildMessages(combinedSystemPrompt, [], firstQuestionPrompt),
    { temperature: 0.7, max_tokens: 150 }
  )

  // Create session - persona is detected later from responses
  const session: InterviewSession = {
    id: sessionId,
    role,
    detectedPersona: null, // Will be detected from user answers
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
  detectedPersona: Persona | null
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

  // Detect persona from this answer (if not already detected)
  if (!session.detectedPersona) {
    const userAnswers = session.history
      .filter((m) => m.speaker === 'user')
      .map((m) => m.content)
    session.detectedPersona = detectPersona(userAnswers)
    console.log(`Detected persona: ${session.detectedPersona}`)
  }

  // Load prompts
  const systemPrompt = await loadPromptFile('system_interviewer.txt')
  const roleTemplate = await loadPromptFile(`role_templates/${session.role}.txt`)
  const combinedSystemPrompt = `${systemPrompt}\n\n${roleTemplate}`

  // Add persona-aware instructions
  const personaAwarePrompt = addPersonaInstructions(combinedSystemPrompt, session.detectedPersona)

  // Simple heuristic to detect if we need a follow-up (avoid model reasoning)
  const wordCount = userAnswer.trim().split(/\s+/).length
  const isShallowAnswer = wordCount < 30 || userAnswer.split('.').length === 1
  
  // Determine action based on heuristic and turn count
  let action: 'followup' | 'next-question' | 'end-interview' = 'next-question'

  if (session.turnCount >= session.maxTurns) {
    action = 'end-interview'
  } else if (isShallowAnswer) {
    action = 'followup'
  }

  // Generate response based on action and detected persona
  let assistantResponse = ''

  if (action === 'followup') {
    const historyAsMessages = session.history.map((m) => ({
      role: m.speaker === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }))
    assistantResponse = await generateResponse(
      buildMessages(
        personaAwarePrompt,
        historyAsMessages,
        `Respond naturally to what they just said. Ask a probing follow-up question to help them elaborate or provide more specific details. Be conversational and genuine in your reaction.`
      ),
      { temperature: 0.6, max_tokens: 120 }
    )
  } else if (action === 'next-question') {
    const historyAsMessages = session.history.map((m) => ({
      role: m.speaker === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }))
    assistantResponse = await generateResponse(
      buildMessages(
        personaAwarePrompt,
        historyAsMessages,
        `Acknowledge what they said briefly, then ask the next interview question naturally. Make sure it's a different topic area from what you've already covered. Be conversational.`
      ),
      { temperature: 0.6, max_tokens: 150 }
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
    maxTurns: session.maxTurns,
    detectedPersona: session.detectedPersona
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
  const prompt = renderTemplate(feedbackTemplate, { 
    ROLE: session.role,
    PERSONA: session.detectedPersona || 'unknown'
  })

  // Build conversation summary
  const conversationSummary = session.history
    .map((msg) => `${msg.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
    .join('\n\n')

  // Generate feedback JSON
  const feedbackJson = await generateResponse(
    buildMessages(
      prompt,
      [],
      `Candidate persona: ${session.detectedPersona || 'not detected'}\n\nInterview conversation:\n\n${conversationSummary}`
    ),
    { temperature: 0.3, max_tokens: 800 }
  )

  // Parse feedback - handle various formats
  try {
    // Try to parse the response as-is first
    let feedback = JSON.parse(feedbackJson.trim())
    
    // Validate required fields
    if (!feedback.overallScore || !feedback.strengths || !feedback.actionableTips || !feedback.roleEvaluation) {
      throw new Error('Missing required feedback fields')
    }
    
    return {
      overallScore: Math.min(10, Math.max(1, feedback.overallScore)),
      strengths: Array.isArray(feedback.strengths) ? feedback.strengths.slice(0, 4) : ['Good participation'],
      areasForImprovement: Array.isArray(feedback.areasForImprovement) ? feedback.areasForImprovement.slice(0, 3) : feedback.weaknesses?.slice(0, 3) || ['Could be more specific'],
      actionableTips: Array.isArray(feedback.actionableTips) ? feedback.actionableTips.slice(0, 3) : ['Practice more interviews'],
      roleEvaluation: feedback.roleEvaluation || 'Good overall fit for the role',
      communicationQuality: feedback.communicationQuality,
      depthOfThinking: feedback.depthOfThinking,
      specificExamples: feedback.specificExamples,
      problemSolvingApproach: feedback.problemSolvingApproach,
      collaboration: feedback.collaboration,
      selfAwareness: feedback.selfAwareness
    }
  } catch (error) {
    console.error('Failed to parse feedback JSON. Attempting extraction...')
    
    // Try to extract JSON from markdown code blocks
    let jsonString = feedbackJson
    
    // Remove markdown code blocks
    jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    
    // Try to find JSON object
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const feedback = JSON.parse(jsonMatch[0])
        console.log('Successfully parsed extracted JSON')
        return {
          overallScore: Math.min(10, Math.max(1, feedback.overallScore || 6)),
          strengths: feedback.strengths || ['Engaged in conversation', 'Showed interest in role'],
          areasForImprovement: feedback.areasForImprovement?.slice(0, 3) || feedback.weaknesses?.slice(0, 3) || ['Could provide more examples'],
          actionableTips: feedback.actionableTips?.slice(0, 3) || ['Practice with real scenarios', 'Prepare specific stories'],
          roleEvaluation: feedback.roleEvaluation || 'Demonstrated potential for the role',
          communicationQuality: feedback.communicationQuality,
          depthOfThinking: feedback.depthOfThinking,
          specificExamples: feedback.specificExamples,
          problemSolvingApproach: feedback.problemSolvingApproach,
          collaboration: feedback.collaboration,
          selfAwareness: feedback.selfAwareness
        }
      } catch (parseError) {
        console.error('Failed to parse extracted JSON:', parseError)
      }
    }

    console.error('Could not parse feedback response:', feedbackJson.substring(0, 200))

    // Fallback feedback
    return {
      overallScore: 6,
      strengths: [
        'Engaged actively in the interview',
        'Showed interest in learning and growth',
        'Communicated clearly'
      ],
      areasForImprovement: [
        'Could provide more specific examples',
        'Could elaborate more on technical details',
        'Could ask clarifying questions'
      ],
      actionableTips: [
        'Prepare concrete examples from past experiences',
        'Research the role and company before interviewing',
        'Practice explaining your thinking process and the "why" behind decisions'
      ],
      roleEvaluation: `You demonstrated genuine interest in the ${session.role} position. To improve your candidacy for future interviews, focus on providing specific, concrete examples with measurable outcomes, and dive deeper into your decision-making process to show strategic thinking.`
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
