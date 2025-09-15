import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TenantSettings, TenantSettingsUpdate } from '@entente/types'
import SettingToggle from './components/SettingToggle'
import SettingInput from './components/SettingInput'

function GeneralSettings() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<TenantSettings> => {
      const response = await fetch('/api/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }
      return response.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: TenantSettingsUpdate) => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        throw new Error('Failed to update settings')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const handleUpdate = (updates: TenantSettingsUpdate) => {
    updateMutation.mutate(updates)
  }

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-base-200 rounded w-48"></div>
          <div className="space-y-4">
            <div className="h-4 bg-base-200 rounded w-full"></div>
            <div className="h-4 bg-base-200 rounded w-3/4"></div>
            <div className="h-4 bg-base-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div className="text-center text-base-content/60">
          Failed to load settings
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <h2 className="text-xl font-semibold text-base-content mb-6">Data Management</h2>

        <div className="space-y-6">
          <SettingToggle
            label="Auto-cleanup"
            description="Automatically clean up old interactions and data"
            checked={settings.autoCleanupEnabled}
            onChange={(checked) => handleUpdate({ autoCleanupEnabled: checked })}
            loading={updateMutation.isPending}
          />

          <SettingInput
            label="Auto-cleanup interval"
            description="Number of days to keep data before automatic cleanup"
            type="number"
            value={settings.autoCleanupDays}
            min={1}
            max={365}
            suffix="days"
            disabled={!settings.autoCleanupEnabled}
            onChange={(value) => handleUpdate({ autoCleanupDays: Number(value) })}
            loading={updateMutation.isPending}
          />

          <SettingInput
            label="Data retention period"
            description="Maximum number of days to retain data regardless of cleanup settings"
            type="number"
            value={settings.dataRetentionDays}
            min={7}
            max={1095}
            suffix="days"
            onChange={(value) => handleUpdate({ dataRetentionDays: Number(value) })}
            loading={updateMutation.isPending}
          />
        </div>
      </div>

      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <h2 className="text-xl font-semibold text-base-content mb-6">Notifications</h2>

        <div className="space-y-6">
          <SettingToggle
            label="Email notifications"
            description="Receive email notifications for important events"
            checked={settings.notificationsEnabled}
            onChange={(checked) => handleUpdate({ notificationsEnabled: checked })}
            loading={updateMutation.isPending}
          />
        </div>
      </div>

      {updateMutation.isError && (
        <div className="alert alert-error">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to update settings. Please try again.</span>
        </div>
      )}

      <div className="text-sm text-base-content/60">
        <p>Settings are automatically saved when changed.</p>
        <p>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
      </div>
    </div>
  )
}

export default GeneralSettings