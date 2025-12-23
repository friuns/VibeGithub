import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  OAuthCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAf0CIHBZ-wEQJ8CCUUWo1Wl9P7typ_ZPI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gptcall-416910.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gptcall-416910",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gptcall-416910.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "99275526699",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:99275526699:web:3b623e1e2996108b52106e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const githubProvider = new GithubAuthProvider();

// Request additional GitHub scopes for repo access
githubProvider.addScope('repo');
githubProvider.addScope('read:user');

export interface GitHubAuthResult {
  user: User;
  accessToken: string;
}

export const signInWithGitHub = async (): Promise<GitHubAuthResult> => {
  try {
    // Try popup first
    const result = await signInWithPopup(auth, githubProvider);
    const credential = GithubAuthProvider.credentialFromResult(result) as OAuthCredential;
    
    if (!credential?.accessToken) {
      throw new Error('Failed to get GitHub access token');
    }

    return {
      user: result.user,
      accessToken: credential.accessToken,
    };
  } catch (error: unknown) {
    // If popup is blocked, fall back to redirect
    if (error instanceof Error && 
        (error.message.includes('popup-blocked') || 
         error.message.includes('popup_blocked') ||
         (error as { code?: string }).code === 'auth/popup-blocked')) {
      // Use redirect as fallback - this will navigate away from the page
      await signInWithRedirect(auth, githubProvider);
      // This line won't be reached as the page will redirect
      throw new Error('Redirecting to GitHub for authentication...');
    }
    throw error;
  }
};

// Call this on app load to handle redirect result
export const handleRedirectResult = async (): Promise<GitHubAuthResult | null> => {
  const result = await getRedirectResult(auth);
  
  if (!result) {
    return null;
  }
  
  const credential = GithubAuthProvider.credentialFromResult(result) as OAuthCredential;
  
  if (!credential?.accessToken) {
    throw new Error('Failed to get GitHub access token from redirect');
  }

  return {
    user: result.user,
    accessToken: credential.accessToken,
  };
};

export const signOutFromFirebase = async (): Promise<void> => {
  await signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export { auth };

