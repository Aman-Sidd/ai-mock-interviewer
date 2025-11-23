'use client'

import { useState, useEffect, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface ChatInterfaceProps {
  sessionId: string
  onInterviewComplete: () => void
}

interface MessageItem {
  speaker: 'user' | 'assistant'
  content: string
}

export default function ChatInterface({ sessionId, onInterviewComplete }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [userInput, setUserInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [turnInfo, setTurnInfo] = useState({ current: 0, max: 6 })
  const [interviewComplete, setInterviewComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedPersona, setDetectedPersona] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch initial state (first question should already be in the session)
    const initializeInterview = async () => {
      try {
        // The first question is generated in startSession, we can fetch it from a temp storage
        // For now, we'll show a placeholder and let the first API call set it
        setMessages([{ speaker: 'assistant', content: 'Starting your interview...' }])
      } catch (error) {
        console.error('Error initializing interview:', error)
      }
    }

    initializeInterview()
  }, [sessionId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmitAnswer = async () => {
    if (!userInput.trim() || isLoading) return

    const userMessage = userInput
    setUserInput('')
    setMessages((prev) => [...prev, { speaker: 'user', content: userMessage }])
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answer: userMessage })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer')
      }

      // Capture detected persona after first response
      if (data.detectedPersona && !detectedPersona) {
        setDetectedPersona(data.detectedPersona)
      }

      setMessages((prev) => [...prev, { speaker: 'assistant', content: data.assistantResponse }])
      setTurnInfo({ current: data.turnCount, max: data.maxTurns })

      if (data.action === 'end-interview') {
        setInterviewComplete(true)
        setTimeout(onInterviewComplete, 1000)
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'An error occurred'
      setError(errorMsg)
      console.error('Error submitting answer:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col p-4">
      <div className="flex-1 max-w-3xl w-full mx-auto flex flex-col">
        {/* Header */}
        <div className="bg-white rounded-t-lg shadow-md p-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Interview in Progress</h2>
              {detectedPersona && (
                <p className="text-xs text-blue-600 mt-1">
                  <span className="bg-blue-100 px-2 py-1 rounded">Communication Style: {detectedPersona}</span>
                </p>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Turn {turnInfo.current} / {turnInfo.max}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 bg-white overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {error}
              </p>
              <p className="text-xs text-red-600 mt-1">
                The AI service is experiencing high demand. Retrying...
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${
                  msg.speaker === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && <LoadingSpinner />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {!interviewComplete && (
          <div className="bg-white rounded-b-lg shadow-md p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                placeholder="Type your answer here..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <button
                onClick={handleSubmitAnswer}
                disabled={isLoading || !userInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {interviewComplete && (
          <div className="bg-green-50 rounded-b-lg shadow-md p-4 border-t border-green-200 text-center">
            <p className="text-green-700 font-semibold">Interview Complete! Generating feedback...</p>
          </div>
        )}
      </div>
    </div>
  )
}
