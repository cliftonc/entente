import { useState } from 'react'
import type { InviteTeamMemberRequest } from '@entente/types'

interface InviteFormProps {
  onInvite: (invitation: InviteTeamMemberRequest) => void
  onCancel: () => void
  loading: boolean
  error?: string
}

function InviteForm({ onInvite, onCancel, loading, error }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      onInvite({ email: email.trim(), role })
    }
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const canSubmit = email.trim() && isValidEmail(email.trim()) && !loading

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="email"
            className={`input input-sm w-full ${error ? 'input-error' : ''}`}
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <select
          className="select select-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
          disabled={loading}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="btn btn-primary btn-sm text-primary-content"
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <div className="loading loading-spinner loading-sm"></div>
                Sending...
              </>
            ) : (
              'Send Invite'
            )}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="text-error text-sm">
          {error}
        </div>
      )}

      <div className="text-xs text-base-content/60">
        <p>The invited user will receive an email with instructions to join your team.</p>
      </div>
    </form>
  )
}

export default InviteForm