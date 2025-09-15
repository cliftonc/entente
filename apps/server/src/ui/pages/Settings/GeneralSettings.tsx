import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TenantSettings, TenantSettingsUpdate } from '@entente/types'
import SettingToggle from './components/SettingToggle'

// Custom input component that doesn't auto-save
interface LocalSettingInputProps {
  label: string
  description: string
  type?: 'text' | 'number' | 'email'
  value: string | number
  onChange: (value: string | number) => void
  disabled?: boolean
  min?: number
  max?: number
  suffix?: string
  placeholder?: string
}

function LocalSettingInput({
  label,
  description,
  type = 'text',
  value,
  onChange,
  disabled = false,
  min,
  max,
  suffix,
  placeholder
}: LocalSettingInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = type === 'number' ? Number(e.target.value) : e.target.value
    onChange(newValue)
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label className="text-base font-medium text-base-content">
          {label}
        </label>
        <p className="text-sm text-base-content/60 mt-1">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <input
            type={type}
            className="input input-sm w-20 text-right"
            value={String(value)}
            onChange={handleChange}
            disabled={disabled}
            min={min}
            max={max}
            placeholder={placeholder}
          />
          {suffix && (
            <span className="text-sm text-base-content/60">{suffix}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<TenantSettings | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

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

  // Initialize local settings when data loads
  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings)
      setHasChanges(false)
    }
  }, [settings, localSettings])

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
      setHasChanges(false)
    },
  })

  const handleLocalUpdate = (field: keyof TenantSettingsUpdate, value: any) => {
    if (!localSettings) return

    setLocalSettings(prev => ({
      ...prev!,
      [field]: value
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    if (!localSettings || !settings) return

    const updates: TenantSettingsUpdate = {}

    if (localSettings.tenantName !== settings.tenantName) {
      updates.tenantName = localSettings.tenantName
    }
    if (localSettings.autoCleanupEnabled !== settings.autoCleanupEnabled) {
      updates.autoCleanupEnabled = localSettings.autoCleanupEnabled
    }
    if (localSettings.autoCleanupDays !== settings.autoCleanupDays) {
      updates.autoCleanupDays = localSettings.autoCleanupDays
    }
    if (localSettings.dataRetentionDays !== settings.dataRetentionDays) {
      updates.dataRetentionDays = localSettings.dataRetentionDays
    }
    if (localSettings.notificationsEnabled !== settings.notificationsEnabled) {
      updates.notificationsEnabled = localSettings.notificationsEnabled
    }

    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates)
    }
  }

  const handleReset = () => {
    if (settings) {
      setLocalSettings(settings)
      setHasChanges(false)
    }
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

  if (!settings || !localSettings) {
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
        <h2 className="text-xl font-semibold text-base-content mb-6">Tenant Information</h2>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="text-base font-medium text-base-content">
                Tenant name
              </label>
              <p className="text-sm text-base-content/60 mt-1">
                The display name for your organization or workspace
              </p>
            </div>
            <div className="flex-1 max-w-md">
              <input
                type="text"
                className="input input-bordered w-full"
                value={localSettings.tenantName}
                onChange={(e) => handleLocalUpdate('tenantName', e.target.value)}
                placeholder="Enter tenant name"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <h2 className="text-xl font-semibold text-base-content mb-6">Data Management</h2>

        <div className="space-y-6">
          <SettingToggle
            label="Auto-cleanup"
            description="Automatically clean up old interactions and data"
            checked={localSettings.autoCleanupEnabled}
            onChange={(checked) => handleLocalUpdate('autoCleanupEnabled', checked)}
          />

          <LocalSettingInput
            label="Auto-cleanup interval"
            description="Number of days to keep data before automatic cleanup"
            type="number"
            value={localSettings.autoCleanupDays}
            min={1}
            max={365}
            suffix="days"
            disabled={!localSettings.autoCleanupEnabled}
            onChange={(value) => handleLocalUpdate('autoCleanupDays', value)}
          />

          <LocalSettingInput
            label="Data retention period"
            description="Maximum number of days to retain data regardless of cleanup settings"
            type="number"
            value={localSettings.dataRetentionDays}
            min={7}
            max={1095}
            suffix="days"
            onChange={(value) => handleLocalUpdate('dataRetentionDays', value)}
          />
        </div>
      </div>

      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <h2 className="text-xl font-semibold text-base-content mb-6">Notifications</h2>

        <div className="space-y-6">
          <SettingToggle
            label="Email notifications"
            description="Receive email notifications for important events"
            checked={localSettings.notificationsEnabled}
            onChange={(checked) => handleLocalUpdate('notificationsEnabled', checked)}
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

      {updateMutation.isSuccess && (
        <div className="alert alert-success">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Settings saved successfully!</span>
        </div>
      )}

      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-base-content/60">
            <p>
              {hasChanges ? 'You have unsaved changes.' : 'All changes saved.'}
            </p>
            <p>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleReset}
              disabled={!hasChanges || updateMutation.isPending}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <div className="loading loading-spinner loading-sm"></div>
              )}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GeneralSettings