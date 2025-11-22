'use client'

interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = 'Generating response...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
      </div>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}
