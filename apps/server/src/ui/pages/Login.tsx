import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const { login, error } = useAuth()

  const handleGitHubLogin = () => {
    setIsLoading(true)
    login()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          {/* Header and Docs */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1">
              <div className="avatar">
                <div className="w-8 rounded bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white">
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="text-lg font-bold">E</span>
                  </div>
                </div>
              </div>
              <span className="text-2xl font-bold">ntente</span>
            </div>

            <a
              href="https://docs.entente.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-base text-base-content/70 hover:text-base-content hover:bg-base-200 rounded transition-colors"
              title="Documentation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Docs
            </a>
          </div>


          <p className="text-center text-base-content/70 mb-8">
            Automated contract testing platform that combines OpenAPI specifications with real interaction recording to ensure your services work together seamlessly.
          </p>

          {error && (
            <div className="alert alert-error mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="btn btn-primary btn-block"
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Connecting...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Continue with GitHub
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  )
}
