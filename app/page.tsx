'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Role, Persona } from '@/lib/types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'sales', label: 'Sales' }
]

const PERSONAS: { value: Persona; label: string; description: string }[] = [
  { value: 'efficient', label: 'Efficient', description: 'Short, crisp answers' },
  { value: 'chatty', label: 'Chatty', description: 'Long, detailed responses' },
  { value: 'confused', label: 'Confused', description: 'Uncertain, asking for clarification' },
  { value: 'edge-case', label: 'Edge Case', description: 'Random or off-topic responses' }
]

export default function Home() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('software_engineer')
  const [persona, setPersona] = useState<Persona>('efficient')
  const [duration, setDuration] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartInterview = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/start-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, persona, duration })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start interview')
      }

      router.push(`/interview?sessionId=${data.sessionId}`)
    } catch (error: any) {
      const errorMsg = error?.message || 'An error occurred'
      setError(errorMsg)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Interview Practice Partner
          </h1>
          <p className="text-gray-600">
            Practice mock interviews with AI-powered feedback
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {error}
              </p>
              <p className="text-xs text-red-600 mt-2">
                This usually means the AI service is experiencing high demand. Please try again in a moment.
              </p>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Role
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`p-3 text-left rounded-lg border-2 transition ${
                    role === r.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Persona Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Persona
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPersona(p.value)}
                  className={`p-3 text-left rounded-lg border-2 transition text-sm ${
                    persona === p.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-xs text-gray-600">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Interview Duration: {duration} minutes
            </label>
            <input
              type="range"
              min="15"
              max="45"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>15 min</span>
              <span>45 min</span>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartInterview}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting Interview...' : 'Start Interview'}
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">How it works:</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>✓ Answer interview questions naturally</li>
            <li>✓ Get follow-up questions to explore your experience</li>
            <li>✓ Receive detailed feedback with improvement tips</li>
            <li>✓ Practice as many times as you want</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
