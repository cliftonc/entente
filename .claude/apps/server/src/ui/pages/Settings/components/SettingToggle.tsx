interface SettingToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  loading?: boolean
  disabled?: boolean
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  loading = false,
  disabled = false,
}: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label className="text-base font-medium text-base-content">{label}</label>
        <p className="text-sm text-base-content/60 mt-1">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        {loading && <div className="loading loading-spinner loading-sm"></div>}

        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={loading || disabled}
        />
      </div>
    </div>
  )
}

export default SettingToggle
