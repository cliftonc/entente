import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Service {
  id: string
  name: string
  version: string
  status: 'active' | 'inactive' | 'deploying'
  lastDeployment?: string
  environment: string
}

interface Interaction {
  id: string
  consumer: string
  provider: string
  method: string
  path: string
  timestamp: string
  status: 'success' | 'failure'
}

interface Fixture {
  id: string
  service: string
  path: string
  method: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface AppState {
  services: Service[]
  interactions: Interaction[]
  fixtures: Fixture[]
  selectedService: string | null
  loading: {
    services: boolean
    interactions: boolean
    fixtures: boolean
  }
  errors: {
    services: string | null
    interactions: string | null
    fixtures: string | null
  }
}

interface AppActions {
  setServices: (services: Service[]) => void
  setInteractions: (interactions: Interaction[]) => void
  setFixtures: (fixtures: Fixture[]) => void
  setSelectedService: (serviceId: string | null) => void
  setLoading: (key: keyof AppState['loading'], value: boolean) => void
  setError: (key: keyof AppState['errors'], error: string | null) => void
  addService: (service: Service) => void
  updateService: (id: string, updates: Partial<Service>) => void
  removeService: (id: string) => void
  addInteraction: (interaction: Interaction) => void
  addFixture: (fixture: Fixture) => void
  updateFixture: (id: string, updates: Partial<Fixture>) => void
  clearErrors: () => void
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      services: [],
      interactions: [],
      fixtures: [],
      selectedService: null,
      loading: {
        services: false,
        interactions: false,
        fixtures: false,
      },
      errors: {
        services: null,
        interactions: null,
        fixtures: null,
      },

      // Actions
      setServices: services => set({ services }, false, 'setServices'),

      setInteractions: interactions => set({ interactions }, false, 'setInteractions'),

      setFixtures: fixtures => set({ fixtures }, false, 'setFixtures'),

      setSelectedService: serviceId =>
        set({ selectedService: serviceId }, false, 'setSelectedService'),

      setLoading: (key, value) =>
        set(state => ({ loading: { ...state.loading, [key]: value } }), false, `setLoading.${key}`),

      setError: (key, error) =>
        set(state => ({ errors: { ...state.errors, [key]: error } }), false, `setError.${key}`),

      addService: service =>
        set(state => ({ services: [...state.services, service] }), false, 'addService'),

      updateService: (id, updates) =>
        set(
          state => ({
            services: state.services.map(s => (s.id === id ? { ...s, ...updates } : s)),
          }),
          false,
          'updateService'
        ),

      removeService: id =>
        set(
          state => ({ services: state.services.filter(s => s.id !== id) }),
          false,
          'removeService'
        ),

      addInteraction: interaction =>
        set(
          state => ({ interactions: [interaction, ...state.interactions] }),
          false,
          'addInteraction'
        ),

      addFixture: fixture =>
        set(state => ({ fixtures: [fixture, ...state.fixtures] }), false, 'addFixture'),

      updateFixture: (id, updates) =>
        set(
          state => ({
            fixtures: state.fixtures.map(f => (f.id === id ? { ...f, ...updates } : f)),
          }),
          false,
          'updateFixture'
        ),

      clearErrors: () =>
        set(
          { errors: { services: null, interactions: null, fixtures: null } },
          false,
          'clearErrors'
        ),
    }),
    { name: 'app-store' }
  )
)
