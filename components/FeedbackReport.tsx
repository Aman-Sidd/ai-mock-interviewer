'use client'

import { FeedbackReport } from '@/lib/types'

interface FeedbackReportProps {
  feedback: FeedbackReport
  onRetake: () => void
}

export default function FeedbackReportComponent({ feedback, onRetake }: FeedbackReportProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col p-4">
      <div className="flex-1 max-w-3xl w-full mx-auto flex flex-col">
        {/* Header */}
        <div className="bg-white rounded-t-lg shadow-md p-6 border-b">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Interview Feedback</h2>

          {/* Overall Score */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{feedback.overallScore}</div>
                <div className="text-xs text-blue-100">/ 10</div>
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">
                {feedback.overallScore >= 8 && 'Excellent performance!'}
                {feedback.overallScore >= 6 && feedback.overallScore < 8 && 'Good job! Keep improving.'}
                {feedback.overallScore >= 4 && feedback.overallScore < 6 && 'Average. More practice needed.'}
                {feedback.overallScore < 4 && 'Needs improvement. Practice more.'}
              </p>
              <p className="text-sm text-gray-600">{feedback.roleEvaluation}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white p-6 space-y-6">
          {/* Strengths */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="text-xl font-semibold text-green-700 mb-3">Strengths</h3>
            <ul className="space-y-2">
              {feedback.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="text-xl font-semibold text-red-700 mb-3">Areas for Improvement</h3>
            <ul className="space-y-2">
              {feedback.weaknesses.map((weakness, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-red-600 font-bold mt-0.5">!</span>
                  <span>{weakness}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="text-xl font-semibold text-blue-700 mb-3">Actionable Tips</h3>
            <ul className="space-y-2">
              {feedback.actionableTips.map((tip: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-blue-600 font-bold mt-0.5">💡</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-b-lg shadow-md p-6 border-t text-center">
          <button
            onClick={onRetake}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition inline-block"
          >
            Take Another Interview
          </button>
        </div>
      </div>
    </div>
  )
}
