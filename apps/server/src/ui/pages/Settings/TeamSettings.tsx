import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TeamMember, InviteTeamMemberRequest } from '@entente/types'
import TeamMemberRow from './components/TeamMemberRow'
import InviteForm from './components/InviteForm'

function TeamSettings() {
  const queryClient = useQueryClient()
  const [showInviteForm, setShowInviteForm] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async (): Promise<TeamMember[]> => {
      const response = await fetch('/api/settings/team')
      if (!response.ok) {
        throw new Error('Failed to fetch team members')
      }
      return response.json()
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async (invitation: InviteTeamMemberRequest) => {
      const response = await fetch('/api/settings/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invitation),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invitation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      setShowInviteForm(false)
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: 'admin' | 'member' }) => {
      const response = await fetch(`/api/settings/team/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      })
      if (!response.ok) {
        throw new Error('Failed to update role')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/settings/team/${userId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to remove member')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingInvitations = members.filter(m => m.status === 'pending')

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-base-200 rounded w-48"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-base-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-base-200 rounded w-48"></div>
                  <div className="h-3 bg-base-200 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-base-content">Team Members</h2>
            <p className="text-base-content/60 mt-1">
              Manage who has access to your tenant
            </p>
          </div>

          <button
            className="btn btn-primary btn-sm text-primary-content"
            onClick={() => setShowInviteForm(!showInviteForm)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Member
          </button>
        </div>

        {showInviteForm && (
          <div className="mb-6 p-4 bg-base-200 rounded-lg">
            <InviteForm
              onInvite={(invitation) => inviteMutation.mutate(invitation)}
              onCancel={() => setShowInviteForm(false)}
              loading={inviteMutation.isPending}
              error={inviteMutation.error?.message}
            />
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-base-content mb-3">
              Active Members ({activeMembers.length})
            </h3>
            <div className="space-y-2">
              {activeMembers.map((member) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  onUpdateRole={(role) => updateRoleMutation.mutate({ userId: member.userId, role })}
                  onRemove={() => removeMemberMutation.mutate(member.userId)}
                  updating={updateRoleMutation.isPending}
                  removing={removeMemberMutation.isPending}
                />
              ))}
            </div>
          </div>

          {pendingInvitations.length > 0 && (
            <div>
              <h3 className="font-medium text-base-content mb-3">
                Pending Invitations ({pendingInvitations.length})
              </h3>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <TeamMemberRow
                    key={invitation.id}
                    member={invitation}
                    onUpdateRole={() => {}} // No role updates for pending
                    onRemove={() => removeMemberMutation.mutate(invitation.userId)}
                    updating={false}
                    removing={removeMemberMutation.isPending}
                    isPending
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {members.length === 0 && (
          <div className="text-center py-8 text-base-content/60">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>No team members yet</p>
            <p className="text-sm">Invite your first team member to get started</p>
          </div>
        )}
      </div>

      {(updateRoleMutation.isError || removeMemberMutation.isError) && (
        <div className="alert alert-error">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {updateRoleMutation.error?.message || removeMemberMutation.error?.message}
          </span>
        </div>
      )}
    </div>
  )
}

export default TeamSettings