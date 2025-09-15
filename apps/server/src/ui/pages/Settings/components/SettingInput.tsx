import { useState, useEffect } from 'react'

interface SettingInputProps {
  label: string
  description: string
  type?: 'text' | 'number' | 'email'
  value: string | number
  onChange: (value: string) => void
  loading?: boolean
  disabled?: boolean
  min?: number
  max?: number
  suffix?: string
  placeholder?: string
}

function SettingInput({
  label,
  description,
  type = 'text',
  value,
  onChange,
  loading = false,
  disabled = false,
  min,
  max,
  suffix,
  placeholder
}: SettingInputProps) {
  const [localValue, setLocalValue] = useState(String(value))

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  // Debounce changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== String(value) && localValue.trim() !== '') {
        onChange(localValue)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [localValue, value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
  }

  const handleBlur = () => {
    // Save immediately on blur if different
    if (localValue !== String(value) && localValue.trim() !== '') {
      onChange(localValue)
    }
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
        {loading && (
          <div className="loading loading-spinner loading-sm"></div>
        )}

        <div className="flex items-center gap-2">
          <input
            type={type}
            className="input input-sm w-20 text-right"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={loading || disabled}
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

export default SettingInput