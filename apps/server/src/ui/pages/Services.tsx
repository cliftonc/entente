import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import TimestampDisplay from '../components/TimestampDisplay'
import { interactionApi, serviceApi } from '../utils/api'

function Services() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const {
    data: services,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceApi.getAll(),
  })

  // Services are already unified with type included
  const allServices = services || []

  // Apply filters
  const filteredServices = allServices.filter(service => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === 'all' || service.type === typeFilter
    return matchesSearch && matchesType
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Services</h1>
          <p className="text-base-content/70 mt-1">
            Manage OpenAPI specifications and service contracts
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="skeleton h-6 w-32 mb-4" />
                <div className="skeleton h-4 w-16 mb-4" />
                <div className="skeleton h-16 w-full mb-4" />
                <div className="skeleton h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Services</h1>
          <p className="text-base-content/70 mt-1">
            Manage OpenAPI specifications and service contracts
          </p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Error loading services data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Services</h1>
          <p className="text-base-content/70 mt-1">
            Manage OpenAPI specifications and service contracts
          </p>
        </div>
        <button className="btn btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Spec
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-base-100 p-4 rounded-lg shadow">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Service Type</span>
          </label>
          <select
            className="select select-bordered"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="consumer">Consumers</option>
            <option value="provider">Providers</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Search</span>
          </label>
          <input
            type="text"
            placeholder="Search services..."
            className="input input-bordered"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.length === 0 ? (
          <div className="col-span-full text-center text-base-content/70 py-12">
            {searchTerm || typeFilter !== 'all'
              ? 'No services match your filters'
              : 'No services found'}
          </div>
        ) : (
          filteredServices.map(service => (
            <Link key={service.name} to={`/services/${service.type}/${service.name}`} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <h2 className="card-title text-lg">{service.name}</h2>
                  <div
                    className={`badge ${
                      service.type === 'consumer' ? 'badge-primary' : 'badge-secondary'
                    }`}
                  >
                    {service.type}
                  </div>
                </div>

                <div className="text-sm text-base-content/70 mb-4">
                  Last updated: <TimestampDisplay timestamp={service.updatedAt} />
                </div>

                <p className="text-base-content/80">
                  {service.description || 'No description available'}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Upload Modal would go here */}
    </div>
  )
}

export default Services
