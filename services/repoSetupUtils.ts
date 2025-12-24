import { setRepositorySecret, copySetupWorkflowAndRun } from './githubService';

interface RepositorySetupOptions {
  setOAuthToken?: boolean;
  copyWorkflows?: boolean;
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
  const { setOAuthToken = false, copyWorkflows = false } = options;

  try {
    // Set OAUTH_TOKEN secret if requested
    if (setOAuthToken) {
      await setRepositorySecret(token, owner, repo, 'OAUTH_TOKEN', token);
    }

    // Copy workflows from VibeGithub if requested
    if (copyWorkflows) {
      // Assuming VibeGithub is the reference repository
      const sourceOwner = owner; // Use the same owner for now
      const sourceRepo = 'VibeGithub';
      
      await copySetupWorkflowAndRun(token, sourceOwner, sourceRepo, owner, repo);
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
 * Setup repository workflows by copying from VibeGithub
 */
export const setupRepositoryWorkflows = async (
  token: string,
  owner: string,
  repo: string
): Promise<void> => {
  // Use the same owner and VibeGithub as source
  const sourceOwner = owner;
  const sourceRepo = 'VibeGithub';
  
  await copySetupWorkflowAndRun(token, sourceOwner, sourceRepo, owner, repo);
};

