# GitGenius Hub

A modern GitHub repository manager with AI assistance, built with React, TypeScript, and Firebase Authentication.

## Features

- 🔐 GitHub OAuth login via Firebase
- 📁 Browse and manage your repositories
- 🐛 View and create issues
- 🔀 Manage pull requests
- 🚀 Monitor GitHub Actions workflows
- 🎨 Beautiful, responsive UI

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Firebase project
- A GitHub account

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd VibeGithub
npm install
```

### 2. Firebase Setup

#### Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** and follow the setup wizard
3. Once created, go to **Project Settings** > **General**
4. Scroll down to **Your apps** and click the web icon (`</>`)
5. Register your app and copy the Firebase config

#### Update Firebase Config

Edit `services/firebaseService.ts` and replace the config with your own:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. GitHub OAuth Setup

#### Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**
3. Fill in the details:
   - **Application name**: GitGenius Hub (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
   
   > ⚠️ Replace `YOUR_PROJECT_ID` with your actual Firebase project ID
   
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy the **Client Secret**

#### Enable GitHub in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) > Your Project
2. Navigate to **Authentication** > **Sign-in method**
3. Click **Add new provider** > **GitHub**
4. Toggle **Enable**
5. Paste your GitHub **Client ID** and **Client Secret**
6. Copy the **Authorization callback URL** shown (should match what you set in GitHub)
7. Click **Save**

#### Add Authorized Domains (for Production)

1. In Firebase Console, go to **Authentication** > **Settings**
2. Under **Authorized domains**, add your production domain (e.g., `your-app.netlify.app`)

### 4. Run the App

```bash
npm run dev
```

The app will be available at `http://localhost:3000` (or another port if 3000 is in use).

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Project Structure

```
├── App.tsx                 # Main app component with routing
├── components/             # Reusable UI components
│   ├── Button.tsx
│   ├── Markdown.tsx
│   ├── RepoCard.tsx
│   └── Toast.tsx
├── services/
│   ├── firebaseService.ts  # Firebase auth configuration
│   ├── githubService.ts    # GitHub API calls
│   └── cacheService.ts     # Local caching
├── views/
│   ├── TokenGate.tsx       # Login page
│   ├── Dashboard.tsx       # Repository list
│   ├── RepoDetail.tsx      # Single repo view
│   └── IssueDetail.tsx     # Issue/PR details
└── types.ts                # TypeScript interfaces
```

## Deployment

### Netlify

1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add your Netlify domain to Firebase authorized domains

### Environment Variables

For production, consider using environment variables for sensitive config:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## Troubleshooting

### "popup-closed-by-user" Error

This occurs when the OAuth popup is closed before completing. Just try signing in again.

### "auth/unauthorized-domain" Error

Add your domain to Firebase's authorized domains:
1. Firebase Console > Authentication > Settings > Authorized domains
2. Add your domain (e.g., `localhost`, `your-app.netlify.app`)

### GitHub Scopes

The app requests these GitHub OAuth scopes:
- `repo` - Full access to repositories
- `read:user` - Read user profile data

## License

MIT

