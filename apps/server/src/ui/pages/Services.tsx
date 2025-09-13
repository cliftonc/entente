function Services() {
  const services = [
    {
      name: 'order-service',
      version: '2.1.0',
      description: 'Handles order management and processing',
      environment: 'production',
      lastUpdated: '2024-01-15T10:30:00Z',
      interactions: 450,
      consumers: ['web-app', 'mobile-app'],
    },
    {
      name: 'payment-service',
      version: '1.8.0',
      description: 'Payment processing and billing',
      environment: 'production',
      lastUpdated: '2024-01-14T16:20:00Z',
      interactions: 320,
      consumers: ['web-app', 'admin-dashboard'],
    },
    {
      name: 'user-service',
      version: '3.0.0',
      description: 'User authentication and profile management',
      environment: 'staging',
      lastUpdated: '2024-01-13T09:15:00Z',
      interactions: 180,
      consumers: ['web-app', 'mobile-app', 'admin-dashboard'],
    },
  ]

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
            <span className="label-text">Environment</span>
          </label>
          <select className="select select-bordered">
            <option>All environments</option>
            <option>production</option>
            <option>staging</option>
            <option>development</option>
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
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <div key={service.name} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-start justify-between">
                <h2 className="card-title text-lg">{service.name}</h2>
                <div className={`badge ${
                  service.environment === 'production' ? 'badge-success' :
                  service.environment === 'staging' ? 'badge-warning' : 'badge-info'
                }`}>
                  {service.environment}
                </div>
              </div>
              
              <div className="text-sm text-base-content/70 mb-4">
                v{service.version}
              </div>
              
              <p className="text-base-content/80 mb-4">
                {service.description}
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Interactions</span>
                  <span className="font-medium">{service.interactions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Consumers</span>
                  <span className="font-medium">{service.consumers.length}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-sm text-base-content/70 mb-2">Consumers:</div>
                <div className="flex flex-wrap gap-1">
                  {service.consumers.map((consumer) => (
                    <span key={consumer} className="badge badge-ghost badge-sm">
                      {consumer}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="card-actions justify-end">
                <button className="btn btn-ghost btn-sm">View Spec</button>
                <button className="btn btn-primary btn-sm">Details</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal would go here */}
    </div>
  )
}

export default Services