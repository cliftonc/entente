# Entente - Claude Development Guide

## Project Overview
Entente is a schema-first contract testing platform with centralized management. It combines OpenAPI specifications with real interaction recording to provide automated contract testing between services.

## Architecture
- **TypeScript-first** functional programming approach (no classes)
- **pnpm workspace** monorepo structure
- **Hono API** server (Cloudflare Worker compatible)
- **React + Tailwind + DaisyUI** admin interface
- **Neon PostgreSQL** for data persistence (to be implemented)

## Key Concepts
- **OpenAPI-First**: All contracts start with OpenAPI specs
- **Automatic Recording**: CI environments record real interactions
- **Smart Fixtures**: Self-bootstrapping test data with approval workflow
- **Deployment Awareness**: Only test against actively deployed versions
- **Real Verification**: Providers verify against actual consumer usage

## Project Structure
```
entente/
├── packages/
│   ├── types/           # Shared TypeScript interfaces
│   ├── consumer/        # Consumer testing library (@entente/consumer)
│   ├── provider/        # Provider verification library (@entente/provider)
│   ├── fixtures/        # Fixture management utilities (@entente/fixtures)
│   └── cli/             # Command line interface (@entente/cli)
├── apps/
│   └── server/          # Central service (Hono API + React UI)
│   └── docs/          # documentation (Starlight / astro)
└── CLAUDE.md           # This file
```

## Development Commands
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server (API + UI)
pnpm server:dev

# Run tests
pnpm test

# Lint and format
pnpm lint:fix && pnpm format

# Work on specific package
pnpm --filter @entente/consumer dev
pnpm --filter @entente/server dev:api
```

## Tech Stack
- **Runtime**: Node.js 24+, Cloudflare Workers
- **Language**: TypeScript 5.7+ (functional style)
- **Framework**: Hono 4.x (API), React 18+ (UI), Vite 6.x
- **Styling**: Tailwind CSS 3.4+ + DaisyUI 5+
- **Database**: Neon PostgreSQL (to be integrated)
- **Testing**: Vitest 2.x
- **Tooling**: Biome 1.9+ (lint/format), pnpm 9+ (workspace)

## Important Notes
- Use functional programming patterns, avoid classes
- All APIs return proper TypeScript types from @entente/types
- Server is configured for cloudflare worker deployment
- UI follows admin dashboard pattern with left nav + top menu
- UI should also be built to work on mobile, using standard tailwind and daisyui classes

# General Principles
Clean Code: Prioritize readability, maintainability, and reusability.
Conciseness: Aim for concise and expressive code.
Descriptive Naming: Use clear and descriptive names for variables, functions, components, and files (e.g., getUserProfile, ProductCard, useAuth).
DRY (Don't Repeat Yourself): Extract reusable logic into functions, custom hooks, or components.
Modularization: Break down complex problems and features into smaller, manageable units (components, functions, utilities).
TypeScript First: All new code should be written in TypeScript, leveraging its type safety features.
Testable Code: Design code to be easily testable.
Package Management: This project uses pnpm for managing dependencies. All package installations and scripts should use pnpm instead of npm or yarn.
Documentation: All principal documentation should be created in the docs folder.
