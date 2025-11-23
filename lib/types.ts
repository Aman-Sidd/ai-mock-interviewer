/**
 * Core TypeScript types for AI Interview Practice Partner
 */

export type Persona = 'efficient' | 'chatty' | 'confused' | 'edge-case'

export type Role = 'software_engineer' | 'product_manager' | 'sales'

export interface Message {
  speaker: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface InterviewSession {
  id: string
  role: Role
  detectedPersona: Persona | null // Will be detected from user responses
  duration: number // minutes
  turnCount: number
  maxTurns: number // 4-6
  history: Message[]
  state: 'started' | 'in-progress' | 'completed'
  createdAt: Date
  updatedAt: Date
}

export interface FeedbackReport {
  overallScore: number // 1-10
  strengths: string[]
  weaknesses?: string[] // deprecated, use areasForImprovement
  areasForImprovement?: string[]
  actionableTips: string[]
  roleEvaluation: string
  communicationQuality?: string
  depthOfThinking?: string
  specificExamples?: string
  problemSolvingApproach?: string
  collaboration?: string
  selfAwareness?: string
}

export interface StartInterviewRequest {
  role: Role
  duration: number
}

export interface StartInterviewResponse {
  sessionId: string
  firstQuestion: string
  maxTurns: number
}

export interface SubmitAnswerRequest {
  sessionId: string
  answer: string
}

export interface SubmitAnswerResponse {
  acknowledged: boolean
  action: 'followup' | 'next-question' | 'end-interview'
  assistantResponse: string
  turnCount: number
  maxTurns: number
  detectedPersona?: Persona | null
}

export interface GetFeedbackResponse {
  feedback: FeedbackReport
}
