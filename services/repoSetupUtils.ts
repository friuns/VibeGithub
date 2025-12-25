import { setRepositorySecret, copySetupWorkflowAndRun } from './githubService';

interface RepositorySetupOptions {
  setOAuthToken?: boolean;
  setNetlifyTokens?: boolean;
  copyWorkflows?: boolean;
  appDescription?: string;
}

/**
 * Complete the repository setup by setting secrets and copying workflows
 */
export const completeRepositorySetup = async (
  token: string,
  owner: string,
  repo: string,
  options: RepositorySetupOptions
): Promise<void> => {
  const { setOAuthToken = false, setNetlifyTokens = false, copyWorkflows = false, appDescription } = options;

  try {
    // Set OAUTH_TOKEN secret if requested
    if (setOAuthToken) {
      await setRepositorySecret(token, owner, repo, 'OAUTH_TOKEN', token);
    }

    // Set Netlify tokens if requested
    if (setNetlifyTokens) {
      await setRepositorySecret(token, owner, repo, 'NETLIFY_AUTH_TOKEN', 'nfp_7mrwfjfXpwtAA2yRS9Cdj52S5GLWuB8v6393');
      await setRepositorySecret(token, owner, repo, 'NETLIFY_SITE_ID', 'ef61ba0a-53d3-45ed-8965-4fcd861654ba');
    }

    // Copy workflows from VibeGithub if requested
    if (copyWorkflows) {
      // Assuming VibeGithub is the reference repository
      const sourceOwner = owner; // Use the same owner for now
      const sourceRepo = 'VibeGithub';

      await copySetupWorkflowAndRun(token, sourceOwner, sourceRepo, owner, repo, appDescription);
    }
  } catch (error) {
    // Log error but don't fail the entire creation
    console.error('Repository setup encountered an error:', error);
    throw error;
  }
};

/**
 * Automatically set the OAUTH_TOKEN secret for a repository
 */
export const autoSetOAuthToken = async (
  token: string,
  owner: string,
  repo: string
): Promise<void> => {
  await setRepositorySecret(token, owner, repo, 'OAUTH_TOKEN', token);
};

/**
 * Automatically set all required tokens for a repository (OAUTH_TOKEN, NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID)
 */
export const autoSetAllTokens = async (
  token: string,
  owner: string,
  repo: string
): Promise<void> => {
  // Set OAUTH_TOKEN
  await setRepositorySecret(token, owner, repo, 'OAUTH_TOKEN', token);

  // Set hardcoded Netlify tokens
  await setRepositorySecret(token, owner, repo, 'NETLIFY_AUTH_TOKEN', 'nfp_7mrwfjfXpwtAA2yRS9Cdj52S5GLWuB8v6393');
  await setRepositorySecret(token, owner, repo, 'NETLIFY_SITE_ID', 'ef61ba0a-53d3-45ed-8965-4fcd861654ba');
};

/**
 * Setup repository workflows by copying from VibeGithub
 */
export const setupRepositoryWorkflows = async (
  token: string,
  owner: string,
  repo: string,
  appDescription?: string
): Promise<void> => {
  // Use the same owner and VibeGithub as source
  const sourceOwner = owner;
  const sourceRepo = 'VibeGithub';
  
  await copySetupWorkflowAndRun(token, sourceOwner, sourceRepo, owner, repo, appDescription);
};

