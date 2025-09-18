import { useState } from 'react'

interface GetStartedButtonProps {
  children: React.ReactNode
}

function GetStartedButton({ children }: GetStartedButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="btn btn-primary btn-outline btn-sm gap-2 whitespace-nowrap"
      >
        <svg
          className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Get Started
      </button>

      {isExpanded && (
        <>
          {/* Desktop dropdown */}
          <div className="hidden md:block absolute top-12 right-0 z-10 w-[48rem] p-4 bg-base-100 rounded-lg border shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-base-content">Get Started</h3>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {children}
          </div>

          {/* Mobile fullscreen overlay */}
          <div className="md:hidden fixed inset-0 z-50 bg-base-100 p-4 overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-base-content">Get Started</h3>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {children}
          </div>
        </>
      )}
    </div>
  )
}

export default GetStartedButton
