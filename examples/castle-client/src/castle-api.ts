export interface Castle {
  id: string
  name: string
  region: string
  yearBuilt: number
}

export interface CreateCastleRequest {
  name: string
  region: string
  yearBuilt: number
}

export interface CastleApiError {
  error: string
  message: string
}

export class CastleApiClient {
  constructor(private readonly baseUrl: string) {}

  async getAllCastles(): Promise<Castle[]> {
    const response = await fetch(`${this.baseUrl}/castles`)

    if (!response.ok) {
      const error: CastleApiError = await response.json()
      throw new Error(`Failed to get castles: ${error.message}`)
    }

    return response.json()
  }

  async getCastleById(id: string): Promise<Castle> {
    const response = await fetch(`${this.baseUrl}/castles/${id}`)

    if (!response.ok) {
      const error: CastleApiError = await response.json()
      throw new Error(`Failed to get castle ${id}: ${error.message}`)
    }

    return response.json()
  }

  async createCastle(castleData: CreateCastleRequest): Promise<Castle> {
    const response = await fetch(`${this.baseUrl}/castles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(castleData),
    })

    if (!response.ok) {
      const error: CastleApiError = await response.json()
      throw new Error(`Failed to create castle: ${error.message}`)
    }

    return response.json()
  }

  async deleteCastle(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/castles/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error: CastleApiError = await response.json()
      throw new Error(`Failed to delete castle ${id}: ${error.message}`)
    }
  }

  async getCastlesByRegion(region: string): Promise<Castle[]> {
    const allCastles = await this.getAllCastles()
    return allCastles.filter(castle => castle.region.toLowerCase().includes(region.toLowerCase()))
  }

  async getOldestCastles(limit = 5): Promise<Castle[]> {
    const allCastles = await this.getAllCastles()
    return allCastles.sort((a, b) => a.yearBuilt - b.yearBuilt).slice(0, limit)
  }
}
