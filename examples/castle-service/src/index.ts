import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { validator } from 'hono/validator';
import { swaggerUI } from '@hono/swagger-ui';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getAllCastles,
  getCastleById,
  createCastle,
  deleteCastle,
  type CreateCastleRequest
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const openApiSpec = JSON.parse(
  readFileSync(join(__dirname, '../spec/openapi.json'), 'utf-8')
);

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

app.get('/castles', (c) => {
  const castles = getAllCastles();
  return c.json(castles);
});

app.get('/castles/:id', (c) => {
  const id = c.req.param('id');
  const castle = getCastleById(id);

  if (!castle) {
    return c.json(
      {
        error: 'not_found',
        message: 'Castle not found'
      },
      404
    );
  }

  return c.json(castle);
});

app.post(
  '/castles',
  validator('json', (value, c) => {
    const castleData = value as Partial<CreateCastleRequest>;

    if (!castleData.name || typeof castleData.name !== 'string') {
      return c.json(
        {
          error: 'validation_error',
          message: 'Name is required and must be a string'
        },
        400
      );
    }

    if (!castleData.region || typeof castleData.region !== 'string') {
      return c.json(
        {
          error: 'validation_error',
          message: 'Region is required and must be a string'
        },
        400
      );
    }

    if (!castleData.yearBuilt || typeof castleData.yearBuilt !== 'number') {
      return c.json(
        {
          error: 'validation_error',
          message: 'Year built is required and must be a number'
        },
        400
      );
    }

    if (castleData.yearBuilt < 1000 || castleData.yearBuilt > 2100) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Year built must be between 1000 and 2100'
        },
        400
      );
    }

    return castleData as CreateCastleRequest;
  }),
  (c) => {
    const castleData = c.req.valid('json');
    const newCastle = createCastle(castleData);
    return c.json(newCastle, 201);
  }
);

app.delete('/castles/:id', (c) => {
  const id = c.req.param('id');
  const deleted = deleteCastle(id);

  if (!deleted) {
    return c.json(
      {
        error: 'not_found',
        message: 'Castle not found'
      },
      404
    );
  }

  return c.body(null, 204);
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'castle-service' });
});

// Serve OpenAPI specification as JSON
app.get('/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// Serve Swagger UI documentation
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// Redirect root to docs for convenience
app.get('/', (c) => {
  return c.redirect('/docs');
});

export default app;