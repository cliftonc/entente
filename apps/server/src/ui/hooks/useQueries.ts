import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query keys for cache management
export const queryKeys = {
  specs: ['specs'] as const,
  spec: (service: string) => ['specs', service] as const,
  interactions: ['interactions'] as const,
  serviceInteractions: (serviceId: string) => ['interactions', 'service', serviceId] as const,
  fixtures: ['fixtures'] as const,
  deployments: ['deployments'] as const,
  verification: (provider: string) => ['verification', provider] as const,
}

// Specs queries (OpenAPI specifications)
export function useSpecs() {
  return useQuery({
    queryKey: queryKeys.specs,
    queryFn: async () => {
      const response = await fetch('/api/specs')
      if (!response.ok) throw new Error('Failed to fetch specs')
      return response.json()
    },
  })
}

export function useSpec(service: string) {
  return useQuery({
    queryKey: queryKeys.spec(service),
    queryFn: async () => {
      const response = await fetch(`/api/specs/${service}`)
      if (!response.ok) throw new Error('Failed to fetch spec')
      return response.json()
    },
    enabled: !!service,
  })
}

// Interactions queries
export function useInteractions() {
  return useQuery({
    queryKey: queryKeys.interactions,
    queryFn: async () => {
      const response = await fetch('/api/interactions')
      if (!response.ok) throw new Error('Failed to fetch interactions')
      return response.json()
    },
  })
}

export function useServiceInteractions(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.serviceInteractions(serviceId),
    queryFn: async () => {
      const response = await fetch(`/api/interactions?service=${serviceId}`)
      if (!response.ok) throw new Error('Failed to fetch service interactions')
      return response.json()
    },
    enabled: !!serviceId,
  })
}

// Fixtures queries
export function useFixtures() {
  return useQuery({
    queryKey: queryKeys.fixtures,
    queryFn: async () => {
      const response = await fetch('/api/fixtures')
      if (!response.ok) throw new Error('Failed to fetch fixtures')
      return response.json()
    },
  })
}

// Deployments queries
export function useDeployments() {
  return useQuery({
    queryKey: queryKeys.deployments,
    queryFn: async () => {
      const response = await fetch('/api/deployments')
      if (!response.ok) throw new Error('Failed to fetch deployments')
      return response.json()
    },
  })
}

// Mutations
export function useCreateSpec() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ service, data }: { service: string; data: any }) => {
      const response = await fetch(`/api/specs/${service}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create spec')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.specs })
    },
  })
}

export function useUpdateFixture() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/fixtures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to update fixture')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixtures })
    },
  })
}

export function useRecordInteraction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (interactionData: any) => {
      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interactionData),
      })
      if (!response.ok) throw new Error('Failed to record interaction')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions })
    },
  })
}