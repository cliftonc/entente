# @entente/server - Claude Development Guide

## Purpose
Central Entente service providing both REST API (Hono) and admin web interface (React). Handles all contract testing data and coordination.

## Architecture
- **Backend**: Hono framework (Cloudflare Worker compatible)
- **Frontend**: React + Vite + Tailwind CSS + DaisyUI
- **Database**: Prepared for Neon PostgreSQL
- **Deployment**: Configured for both local development and Cloudflare Workers

## Project Structure
```
apps/server/
├── src/
│   ├── api/              # Hono backend
│   │   ├── index.ts      # Main API server
│   │   └── routes/       # API route modules
│   └── ui/               # React frontend
│       ├── components/   # React components
│       ├── pages/        # Page components
│       ├── hooks/        # Custom hooks
│       └── utils/        # Utility functions
├── wrangler.toml         # Cloudflare Workers config
├── vite.config.ts        # Vite configuration
└── tailwind.config.js    # Tailwind + DaisyUI config
```

## API Routes

### Authentication Routes (No auth required)
- `GET /auth/github` - Initiate GitHub OAuth flow
- `GET /auth/github/callback` - Handle GitHub OAuth callback
- `GET /auth/session` - Get current session info
- `POST /auth/logout` - Logout current user

## IMPORTANT

If you need an auth key, look in `~/.entente/entente.json`

### Protected API Routes (Authentication required)
- `GET/POST /api/specs/:service` - OpenAPI specification management
- `POST /api/interactions` - Record client interactions
- `GET /api/interactions/:service` - Get recorded interactions
- `GET/POST /api/fixtures/*` - Fixture management (CRUD + approval)
- `POST /api/deployments` - Record deployment state
- `GET /api/deployments/active` - Get active deployments
- `GET/POST /api/verification/:provider` - Provider verification
- `GET /api/can-i-deploy` - Check deployment compatibility

### Health Check
- `GET /health` - Server health status

## UI Pages
- **Dashboard** - Overview with stats and recent activity
- **Services** - Service management and OpenAPI specs
- **Interactions** - Recorded consumer interactions
- **Fixtures** - Fixture approval and management
- **Deployments** - Deployment tracking across environments
- **Verification** - Provider verification results

## Development
```bash
# Start both API and UI in development
pnpm dev

# Check types
pnpm typecheck

# Build
pnpm build

# Deploy to Cloudflare Workers
pnpm deploy
```

If you want debug logs, you need to set `ENTENTE_DEBUG=true` when starting the server

```bash
ENTENTE_DEBUG=true pnpm dev
```

It is important that you correctly add types and typecheck all new features.  Avoid the use of any unless there is no alternative.

## Development vs Production
- **Development**: Uses cloudflare worker for fast local development with hot reload
- **Production**: Deploys as Cloudflare Worker for serverless execution

## Environment Variables
Required environment variables in `.dev.vars`:

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
APP_URL=http://localhost:3000

# Optional
NODE_ENV=development
```

## Database Integration
Connected to Neon PostgreSQL with Drizzle ORM:

- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Drizzle ORM with schema definitions
- **Migrations**: Available via `pnpm db:migrate`

### Database Commands
```bash
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Run pending migrations
```

## Authentication System

IMPORTANT:  If you need an authorization token you can typically find one in ~/entente/entente.json,

### GitHub OAuth Flow
The application uses GitHub OAuth for authentication:

1. **Login Initiation**: User clicks login → redirects to `GET /auth/github`
2. **GitHub Authorization**: Server redirects to GitHub OAuth with scopes `['user:email']`
3. **OAuth Callback**: GitHub redirects back to `GET /auth/github/callback?code=...&state=...`
4. **Token Exchange**: Server exchanges authorization code for access token
5. **User Data**: Server fetches user profile from GitHub API
6. **User Creation**: Server creates/updates user record in database
7. **Session Creation**: Server creates secure session with HttpOnly cookies
8. **Redirect**: User redirected to dashboard with active session

### Authentication Middleware
- **Environment Middleware**: Loads all environment variables for both development and Cloudflare Workers
- **Database Middleware**: Connects to Neon PostgreSQL using environment variables
- **Auth Middleware**: Protects API routes, validates sessions, requires authentication

### Frontend Authentication
- **AuthProvider**: React context providing authentication state and methods
- **ProtectedRoute**: Component that shows login page when not authenticated
- **useAuth Hook**: Access authentication state (`authenticated`, `user`, `loading`, `error`)
- **TanStack Query**: Integrated with auth for cache invalidation on logout

### Session Management
- **Sessions**: Stored in database with expiration
- **Cookies**: HttpOnly, SameSite=Lax, Secure (in production)
- **State Management**: OAuth state verification prevents CSRF attacks
- **Logout**: Clears database session and cookies, invalidates query cache

### User & Tenant Model
- **Users**: GitHub profile data (id, username, email, name, avatar)
- **Tenants**: Organizations/teams that users belong to
- **Roles**: User roles within tenants (owner, admin, member)
- **Personal Tenant**: Each user gets a personal tenant automatically

## UI Theme
Using DaisyUI theme called "entente" with:
- Primary: Blue (#3b82f6)
- Secondary: Green (#10b981)
- Accent: Amber (#f59e0b)
- Admin layout with left sidebar navigation

## State Management
- **TanStack Query**: Server state management with caching and background updates
- **Zustand**: Client state management for UI state and application data
- **React Router**: Client-side routing with protected routes
