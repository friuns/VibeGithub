# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server on port 3000
npm run build    # Production build with Vite
npm run preview  # Preview production build
```

## Architecture

VibeGithub is a React SPA that wraps GitHub's API to enable AI coding agent integration (Jules, Copilot, OpenCode) directly from issues and PRs.

### Core Flow
- **App.tsx** - Client-side routing using React state (`AppRoute` enum). Handles OAuth redirect and persists auth to localStorage.
- **views/** - Page components: `TokenGate` (login), `Dashboard` (repo list), `RepoDetail` (issues + create issue modal), `IssueDetail` (issue + @agent commenting on PRs)
- **services/githubService.ts** - All GitHub REST API calls. Key operations:
  - Repository CRUD with template support
  - Issues/PRs/Comments
  - Workflow management (secrets, files, dispatch)
  - Secret encryption using libsodium sealed box
- **services/firebaseService.ts** - GitHub OAuth via Firebase Authentication
- **services/cacheService.ts** - Local caching layer

### AI Agent Integration Pattern
Issues created through this app are pre-configured for AI agents:
- Auto-labeled with `jules`
- Assigned to `@copilot` by default
- Comments on PRs can mention `@jules`, `@opencode`, `@copilot`, `@codex`, `@cursor` to trigger agents

### Key Implementation Details
- Uses `?raw` Vite import for `.github/workflows/setup.yml` to bundle workflow content
- Path alias `@/*` maps to project root
- GitHub token stored in localStorage as `gh_token`
- Template repository creation falls back to setup workflow when OAuth restrictions prevent direct template use
