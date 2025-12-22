import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  OAuthCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAf0CIHBZ-wEQJ8CCUUWo1Wl9P7typ_ZPI",
  authDomain: "gptcall-416910.firebaseapp.com",
  projectId: "gptcall-416910",
  storageBucket: "gptcall-416910.appspot.com",
  messagingSenderId: "99275526699",
  appId: "1:99275526699:web:3b623e1e2996108b52106e"
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
  const result = await signInWithPopup(auth, githubProvider);
  const credential = GithubAuthProvider.credentialFromResult(result) as OAuthCredential;
  
  if (!credential?.accessToken) {
    throw new Error('Failed to get GitHub access token');
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

