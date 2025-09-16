# @entente/docs

Documentation site for Entente contract testing platform, built with Astro Starlight.

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

## Overview

This is the documentation website for Entente, featuring:
- **Astro Starlight** for fast, accessible documentation
- **Tailwind CSS + DaisyUI** matching the main Entente application design
- **Cloudflare Workers** deployment for global edge performance
- **Easy content management** through Markdown/MDX files

## Development

### Prerequisites

- Node.js 24+
- pnpm 9+

### Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Or from the root of the monorepo
pnpm docs:dev
```

The documentation site will be available at http://localhost:4321

### Building

```bash
# Build for production
pnpm build

# Or from the root
pnpm docs:build
```

### Deployment

Deploy to Cloudflare Workers:

```bash
# Deploy to production
pnpm deploy

# Or from the root
pnpm docs:deploy
```

## 🚀 Project Structure

```
apps/docs/
├── src/
│   ├── content/
│   │   └── docs/           # Documentation content (Markdown/MDX)
│   │       ├── index.mdx   # Homepage
│   │       ├── introduction.md
│   │       ├── getting-started/
│   │       ├── guides/
│   │       └── reference/
│   ├── styles/
│   │   └── global.css      # Custom styling with Tailwind + DaisyUI
│   └── assets/             # Static assets
├── astro.config.mjs        # Astro configuration
├── wrangler.toml          # Cloudflare Workers configuration
└── package.json
```

## Content Management

### Adding New Pages

1. Create a new `.md` or `.mdx` file in `src/content/docs/`
2. Add frontmatter with title and description:

```markdown
---
title: Your Page Title
description: Brief description of the page content
---

# Your Page Title

Content goes here...
```

3. Update the sidebar navigation in `astro.config.mjs` if needed

### Content Organization

- **Getting Started** - Installation, quick start, basic setup
- **Guides** - Detailed how-to guides for specific features
- **Reference** - API documentation, configuration options

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm deploy`          | Deploy to Cloudflare Workers                     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |

## Features

### Starlight Features

- **Fast performance** - Built on Astro for optimal loading
- **Responsive design** - Works great on all device sizes
- **Search** - Built-in search functionality
- **Dark mode** - Automatic dark/light mode switching
- **Accessibility** - WCAG compliant out of the box

### Custom Features

- **Entente branding** - Consistent with main application design
- **DaisyUI components** - Rich component library for enhanced styling
- **Cloudflare deployment** - Global edge performance

## 👀 Want to learn more?

Check out [Starlight's docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build), or jump into the [Astro Discord server](https://astro.build/chat).
