# VibeGithub

> **A vibe-coded GitHub wrapper for commanding AI coding agents (Jules, GitHub Copilot, OpenCode) directly from issues**

![Dashboard](screenshots/dashboard.png)

VibeGithub is a modern interface for managing GitHub repositories with native AI agent integration. Create issues that automatically trigger AI coding agents like **Jules**, **GitHub Copilot**, and **OpenCode** to work on your codebase.

## Supported Agents

| Agent | Trigger | Description |
|-------|---------|-------------|
| **Jules** | `@jules` | Google's AI coding agent for code changes and reviews |
| **GitHub Copilot** | `@copilot` | GitHub's AI pair programmer and SWE agent |
| **OpenCode** | `@opencode` | Open-source AI coding assistant |
| **Codex** | `@codex` | OpenAI's code generation model |
| **Cursor** | `@cursor` | AI-first code editor agent |

## What It Does

- **Command AI Agents from Issues** — Create issues that automatically assign to AI agents with proper labels
- **@jules / @opencode / @copilot Integration** — Comment on PRs with agent mentions to request changes
- **Auto-Assignment** — New issues are auto-assigned to your preferred AI agent
- **Workflow References** — Link to CI/CD workflows when creating issues so agents understand your pipeline

![Issues with Jules Labels](screenshots/repo-issues.png)

## Key Features

### Issue → Agent Pipeline

When you create an issue, it automatically:
1. Adds the `jules` label for agent tracking
2. Assigns `@copilot` as the default assignee
3. Lets you reference workflow files for context

![Create Issue Modal](screenshots/create-issue-modal.png)

### Related PR Tracking

View PRs that reference your issue, with:
- One-click merge buttons
- Direct `@jules` commenting for agent commands
- Deployment status tracking
- GitHub Actions run visibility

### Comment with AI Agents

From any related PR, type your command and mention an agent:

```
@jules please fix the failing tests
@opencode refactor this to use async/await
@copilot add error handling to this function
```

The "Send @jules" button automatically appends the agent mention to your comment.

## Screenshots

| Dashboard | Repo Issues |
|-----------|-------------|
| ![Dashboard](screenshots/dashboard.png) | ![Repo Issues](screenshots/repo-detail-full.png) |

| Create Issue | Issue Modal |
|--------------|-------------|
| ![Create Issue](screenshots/create-issue-modal.png) | ![Repo Detail](screenshots/repo-detail.png) |

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/VibeGithub.git
cd VibeGithub
npm install

# Run development server
npm run dev
```

Open `http://localhost:3000` and sign in with GitHub.

## Setup

### Firebase Configuration

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable GitHub authentication under **Authentication > Sign-in method**
3. Update `services/firebaseService.ts` with your config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ... rest of config
};
```

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create an **OAuth App** with callback: `https://YOUR_PROJECT.firebaseapp.com/__/auth/handler`
3. Add Client ID and Secret to Firebase GitHub provider settings

## How Agent Integration Works

### Creating Agent-Ready Issues

Issues created through VibeGithub are pre-configured for AI agent consumption:

```typescript
// From RepoDetail.tsx
const createdIssue = await createIssue(token, repo.owner.login, repo.name, {
  title: newTitle,
  body: newBody,
  labels: ['jules'],      // Auto-labeled for Jules
  assignees: ['@copilot'] // Assign to GitHub Copilot coding agent
});
```

### Commenting to AI Agents on PRs

From the issue detail view, you can send commands to any agent on related PRs:

```typescript
// From IssueDetail.tsx - works with @jules, @opencode, @copilot, etc.
const body = `${userComment.trim()} @jules`;
await createIssueComment(token, repo.owner.login, repo.name, prNumber, body);
```

Agents that work with this pattern:
- `@jules` — Google's Jules AI
- `@opencode` — OpenCode agent
- `@copilot` — GitHub Copilot
- `@codex` — OpenAI Codex
- `@cursor` — Cursor AI

## Project Structure

```
├── App.tsx                 # Main routing
├── components/
│   ├── Button.tsx
│   ├── Markdown.tsx
│   ├── RepoCard.tsx        # Repo card with issue previews
│   └── Toast.tsx
├── services/
│   ├── firebaseService.ts  # GitHub OAuth via Firebase
│   ├── githubService.ts    # GitHub API (issues, PRs, workflows)
│   └── cacheService.ts     # Local caching for fast UX
├── views/
│   ├── TokenGate.tsx       # Login page
│   ├── Dashboard.tsx       # Repository list
│   ├── RepoDetail.tsx      # Issues + New Issue modal
│   └── IssueDetail.tsx     # Issue view + @jules commenting
└── types.ts
```

## Tech Stack

- **SolidJS** + TypeScript (migrated from React 19)
- **Vite** with `vite-plugin-solid` for fast builds
- **Tailwind CSS** for styling
- **Firebase Auth** for GitHub OAuth
- **GitHub REST API** for repository operations
- **State Management**: `createMutable` from solid-js/store (no external state libraries)

## License

MIT

## Recent Updates

### SolidJS Migration ✨

This project has been migrated from React 19 to **SolidJS** with exclusive use of `createMutable` for state management. 

**Benefits:**
- ⚡ Faster reactivity with fine-grained updates
- 🎯 No virtual DOM overhead
- 📦 Smaller bundle size
- 🔧 Simpler state management with `createMutable`

**Migration Status:** Core functionality complete. See [SOLIDJS_MIGRATION_STATUS.md](./SOLIDJS_MIGRATION_STATUS.md) for details.

**Key Changes:**
- All components converted to SolidJS
- State management via `createMutable` (no signals, no external libraries)
- Dashboard fully functional with all CRUD operations
- Build process updated for SolidJS

