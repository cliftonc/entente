import { useState } from 'react'
import type { TeamMember } from '@entente/types'

interface TeamMemberRowProps {
  member: TeamMember
  onUpdateRole: (role: 'admin' | 'member') => void
  onRemove: () => void
  updating: boolean
  removing: boolean
  isPending?: boolean
}

function TeamMemberRow({
  member,
  onUpdateRole,
  onRemove,
  updating,
  removing,
  isPending = false
}: TeamMemberRowProps) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const canModify = member.role !== 'owner'

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'admin' | 'member'
    onUpdateRole(newRole)
  }

  const handleRemoveClick = () => {
    setShowRemoveConfirm(true)
  }

  const handleConfirmRemove = () => {
    onRemove()
    setShowRemoveConfirm(false)
  }

  const handleCancelRemove = () => {
    setShowRemoveConfirm(false)
  }

  return (
    <div className="flex items-center justify-between p-4 bg-base-50 rounded-lg border border-base-200">
      <div className="flex items-center gap-4">
        <div className="avatar">
          <div className="w-10 h-10 rounded-full">
            {member.avatarUrl && !isPending ? (
              <img src={member.avatarUrl} alt={member.name} />
            ) : (
              <div className="bg-primary text-primary-content w-full h-full flex items-center justify-center text-sm font-medium">
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-base-content">{member.name}</span>
            {isPending && (
              <span className="badge badge-warning badge-sm">Pending</span>
            )}
          </div>
          <div className="text-sm text-base-content/60">
            {member.email} • @{member.username}
          </div>
          <div className="text-xs text-base-content/50">
            {isPending ? 'Invited' : 'Joined'} {new Date(member.joinedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {updating && (
          <div className="loading loading-spinner loading-sm"></div>
        )}

        {canModify && !isPending ? (
          <select
            className="select select-sm"
            value={member.role}
            onChange={handleRoleChange}
            disabled={updating || removing}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span className="badge badge-neutral capitalize">
            {member.role}
          </span>
        )}

        {canModify && (
          <div className="flex items-center gap-2">
            {!showRemoveConfirm ? (
              <button
                className="btn btn-ghost btn-sm text-error hover:bg-error hover:text-error-content"
                onClick={handleRemoveClick}
                disabled={updating || removing}
              >
                {removing ? (
                  <div className="loading loading-spinner loading-sm"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  className="btn btn-error btn-xs"
                  onClick={handleConfirmRemove}
                  disabled={removing}
                >
                  Remove
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={handleCancelRemove}
                  disabled={removing}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamMemberRow