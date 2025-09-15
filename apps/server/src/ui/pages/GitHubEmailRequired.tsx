export default function GitHubEmailRequired() {
  const handleTryAgain = () => {
    window.location.href = '/auth/github'
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="text-center">
            <div className="text-6xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-warning mb-4">Email Address Required</h1>

            <div className="text-left bg-base-200 p-4 rounded-lg mb-6">
              <p className="text-base-content mb-4">
                Your GitHub account doesn't have a public email address, which is required to use Entente.
              </p>

              <p className="text-base-content mb-4 font-semibold">
                To continue, please:
              </p>

              <ol className="list-decimal list-inside space-y-2 text-sm text-base-content/80 mb-4">
                <li>Go to <a href="https://github.com/settings/profile" target="_blank" rel="noopener noreferrer" className="link link-primary">GitHub Profile Settings</a></li>
                <li>Add an email address to your account</li>
                <li>Make sure it's set to "Public" in your <a href="https://github.com/settings/emails" target="_blank" rel="noopener noreferrer" className="link link-primary">Email Settings</a></li>
                <li>Come back and try logging in again</li>
              </ol>

              <div className="bg-info/10 border border-info/20 rounded p-3">
                <p className="text-xs text-base-content/70">
                  <strong>Why is this needed?</strong> Entente uses your email address to link your account with team invitations and ensure security.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleTryAgain}
                className="btn btn-primary btn-block"
              >
                Try Again
              </button>

              <button
                onClick={handleGoHome}
                className="btn btn-ghost btn-sm"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}