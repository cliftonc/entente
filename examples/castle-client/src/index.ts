import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { validator } from 'hono/validator'
import { CastleApiClient, type CreateCastleRequest } from './castle-api.js'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())

const castleServiceUrl = process.env.CASTLE_SERVICE_URL || 'http://localhost:4001'
const castleApi = new CastleApiClient(castleServiceUrl)

app.get('/french-heritage', async c => {
  try {
    const castles = await castleApi.getAllCastles()

    const heritage = {
      totalCastles: castles.length,
      regions: [...new Set(castles.map(castle => castle.region))],
      oldestCastle: castles.reduce((oldest, current) =>
        current.yearBuilt < oldest.yearBuilt ? current : oldest
      ),
      averageAge: Math.floor(
        castles.reduce((sum, castle) => sum + (2024 - castle.yearBuilt), 0) / castles.length
      ),
      castles: castles.map(castle => ({
        id: castle.id,
        name: castle.name,
        region: castle.region,
        age: 2024 - castle.yearBuilt,
      })),
    }

    return c.json(heritage)
  } catch (error) {
    return c.json(
      {
        error: 'service_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

app.get('/heritage/regions/:region', async c => {
  try {
    const region = c.req.param('region')
    const castles = await castleApi.getCastlesByRegion(region)

    return c.json({
      region,
      count: castles.length,
      castles: castles.map(castle => ({
        id: castle.id,
        name: castle.name,
        yearBuilt: castle.yearBuilt,
        age: 2024 - castle.yearBuilt,
      })),
    })
  } catch (error) {
    return c.json(
      {
        error: 'service_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

app.get('/heritage/oldest', async c => {
  try {
    const limitParam = c.req.query('limit')
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 5

    if (Number.isNaN(limit) || limit < 1) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Limit must be a positive number',
        },
        400
      )
    }

    const oldestCastles = await castleApi.getOldestCastles(limit)

    return c.json({
      limit,
      castles: oldestCastles.map(castle => ({
        id: castle.id,
        name: castle.name,
        region: castle.region,
        yearBuilt: castle.yearBuilt,
        age: 2024 - castle.yearBuilt,
      })),
    })
  } catch (error) {
    return c.json(
      {
        error: 'service_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

app.post(
  '/heritage/recommend',
  validator('json', (value, c) => {
    const data = value as Partial<{ region?: string; maxAge?: number; minAge?: number }>

    if (data.maxAge && (typeof data.maxAge !== 'number' || data.maxAge < 0)) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Max age must be a positive number',
        },
        400
      )
    }

    if (data.minAge && (typeof data.minAge !== 'number' || data.minAge < 0)) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Min age must be a positive number',
        },
        400
      )
    }

    if (data.maxAge && data.minAge && data.minAge > data.maxAge) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Min age cannot be greater than max age',
        },
        400
      )
    }

    return data
  }),
  async c => {
    try {
      const filters = c.req.valid('json')
      let castles = await castleApi.getAllCastles()

      if (filters.region) {
        castles = castles.filter(castle =>
          castle.region.toLowerCase().includes(filters.region?.toLowerCase())
        )
      }

      if (filters.minAge || filters.maxAge) {
        castles = castles.filter(castle => {
          const age = 2024 - castle.yearBuilt

          if (filters.minAge && age < filters.minAge) return false
          if (filters.maxAge && age > filters.maxAge) return false

          return true
        })
      }

      castles.sort(() => Math.random() - 0.5)

      const recommendations = castles.slice(0, 3).map(castle => ({
        id: castle.id,
        name: castle.name,
        region: castle.region,
        yearBuilt: castle.yearBuilt,
        age: 2024 - castle.yearBuilt,
        reason: generateRecommendationReason(castle, filters),
      }))

      return c.json({
        filters,
        recommendations,
        totalMatching: castles.length,
      })
    } catch (error) {
      return c.json(
        {
          error: 'service_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      )
    }
  }
)

app.get('/heritage/castle/:id', async c => {
  try {
    const id = c.req.param('id')
    const castle = await castleApi.getCastleById(id)

    return c.json({
      ...castle,
      age: 2024 - castle.yearBuilt,
      description: `The magnificent ${castle.name} was built in ${castle.yearBuilt} in the ${castle.region} region.`,
      visitRecommendation: generateVisitRecommendation(castle),
    })
  } catch (error) {
    return c.json(
      {
        error: 'service_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

app.get('/health', c => {
  return c.json({
    status: 'ok',
    service: 'castle-client',
    castleServiceUrl,
  })
})

const generateRecommendationReason = (
  castle: { name: string; region: string; yearBuilt: number },
  filters: { region?: string; minAge?: number; maxAge?: number }
): string => {
  const reasons = []

  if (filters.region) {
    reasons.push(`matches your preferred region (${castle.region})`)
  }

  const age = 2024 - castle.yearBuilt
  if (filters.minAge && filters.maxAge) {
    reasons.push(`perfect age (${age} years old)`)
  } else if (filters.minAge) {
    reasons.push(`historic significance (${age} years old)`)
  } else if (filters.maxAge) {
    reasons.push(`relatively recent construction (${age} years old)`)
  }

  if (reasons.length === 0) {
    reasons.push('excellent choice for heritage tourism')
  }

  return reasons.join(', ')
}

const generateVisitRecommendation = (castle: {
  name: string
  region: string
  yearBuilt: number
}): string => {
  const age = 2024 - castle.yearBuilt

  if (age < 200) {
    return 'Perfect for those interested in more recent architectural styles.'
  }
  if (age < 500) {
    return 'Great example of medieval French architecture and history.'
  }
  return 'A rare glimpse into ancient French heritage and medieval life.'
}

export default app
