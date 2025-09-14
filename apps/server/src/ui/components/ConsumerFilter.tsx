import { useQuery } from '@tanstack/react-query'
import { consumerApi } from '../utils/api'

interface ConsumerFilterProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
  disabled?: boolean
}

function ConsumerFilter({
  value,
  onChange,
  label = "Consumer",
  className = "",
  disabled = false
}: ConsumerFilterProps) {
  const {
    data: consumers,
    isLoading: consumersLoading,
    error: consumersError
  } = useQuery({
    queryKey: ['consumers'],
    queryFn: consumerApi.getAll,
  })

  return (
    <div className={`form-control ${className}`}>
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <select
        className="select select-bordered"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || consumersLoading}
      >
        <option value="">All Consumers</option>
        {consumersError ? (
          <option disabled>Error loading consumers</option>
        ) : (
          consumers?.map(consumer => (
            <option key={consumer.name} value={consumer.name}>
              {consumer.name}
            </option>
          ))
        )}
      </select>
    </div>
  )
}

export default ConsumerFilter