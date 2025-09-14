import { useQuery } from '@tanstack/react-query'
import { providerApi } from '../utils/api'

interface ProviderFilterProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
  disabled?: boolean
}

function ProviderFilter({
  value,
  onChange,
  label = 'Provider',
  className = '',
  disabled = false,
}: ProviderFilterProps) {
  const {
    data: providers,
    isLoading: providersLoading,
    error: providersError,
  } = useQuery({
    queryKey: ['providers'],
    queryFn: providerApi.getAll,
  })

  return (
    <div className={`form-control ${className}`}>
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <select
        className="select select-bordered"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || providersLoading}
      >
        <option value="">All Providers</option>
        {providersError ? (
          <option disabled>Error loading providers</option>
        ) : (
          providers?.map(provider => (
            <option key={provider.name} value={provider.name}>
              {provider.name}
            </option>
          ))
        )}
      </select>
    </div>
  )
}

export default ProviderFilter
