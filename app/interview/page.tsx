'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'
import FeedbackReport from '@/components/FeedbackReport'
import LoadingSpinner from '@/components/LoadingSpinner'
import { FeedbackReport as FeedbackType } from '@/lib/types'

export default function InterviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('sessionId')

  const [firstQuestion, setFirstQuestion] = useState<string>('')
  const [feedback, setFeedback] = useState<FeedbackType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      router.push('/')
      return
    }

    // First question is already sent to client, so we don't need to fetch it again
    // It will be passed via the interview flow
    setIsLoading(false)
  }, [sessionId, router])

  const handleInterviewComplete = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/get-feedback?sessionId=${sessionId}`)
      if (!res.ok) throw new Error('Failed to get feedback')

      const data = await res.json()
      setFeedback(data.feedback)
    } catch (err) {
      setError('Failed to generate feedback: ' + err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetakeInterview = () => {
    router.push('/')
  }

  if (!sessionId) {
    return <div className="p-4">Loading...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={handleRetakeInterview}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (feedback) {
    return (
      <FeedbackReport
        feedback={feedback}
        onRetake={handleRetakeInterview}
      />
    )
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <ChatInterface
      sessionId={sessionId}
      onInterviewComplete={handleInterviewComplete}
    />
  )
}
