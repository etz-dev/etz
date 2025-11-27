import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config/parser';
import {
  fetchRepo,
  localBranchExists,
  remoteBranchExists,
  findWorktreeByBranch,
  createBranch,
  addWorktree,
  addWorktreeWithTracking,
  unsetUpstream,
} from '../git/operations';
import { SwitchOptions, SwitchResult } from '../types';

/**
 * Validate that a label doesn't contain path traversal attempts
 */
function validateLabel(label: string): void {
  // Check for path traversal patterns
  if (label.includes('..') || label.includes('/') || label.includes('\\')) {
    throw new Error('Invalid label: cannot contain path separators or traversal sequences');
  }

  // Check for absolute paths
  if (path.isAbsolute(label)) {
    throw new Error('Invalid label: cannot be an absolute path');
  }

  // Check for empty or whitespace-only
  if (!label || label.trim().length === 0) {
    throw new Error('Invalid label: cannot be empty');
  }
}

/**
 * Validate branch name (basic git ref validation)
 */
function validateBranchName(branch: string): void {
  // Git branch name rules
  if (!branch || branch.trim().length === 0) {
    throw new Error('Branch name cannot be empty');
  }

  // Disallow certain characters that could be used for command injection
  if (/[;&|`$()<>\\]/.test(branch)) {
    throw new Error('Invalid branch name: contains shell metacharacters');
  }

  // Disallow branch names starting with -
  if (branch.startsWith('-')) {
    throw new Error('Invalid branch name: cannot start with -');
  }
}

/**
 * Ensure a worktree exists for the given repository and branch
 */
async function ensureWorktree(
  repoName: string,
  baseRepoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch: string,
  dryRun: boolean
): Promise<SwitchResult> {
  // Check if worktree already exists
  if (fs.existsSync(worktreePath)) {
    return {
      repoName,
      success: true,
      message: `Worktree already exists at ${worktreePath}`,
      status: 'already_exists',
    };
  }

  // Check if branch is already checked out elsewhere
  const existingPath = await findWorktreeByBranch(baseRepoPath, branch);
  if (existingPath) {
    return {
      repoName,
      success: false,
      message: `Branch '${branch}' is already checked out at ${existingPath}`,
      status: 'already_in_use',
    };
  }

  // Dry run - just report what would happen
  if (dryRun) {
    return {
      repoName,
      success: true,
      message: `Would create worktree for branch '${branch}' at ${worktreePath}`,
      status: 'dry_run',
    };
  }

  try {
    // Fetch latest changes
    await fetchRepo(baseRepoPath);

    const branchExistsLocally = await localBranchExists(baseRepoPath, branch);
    const branchExistsRemotely = await remoteBranchExists(baseRepoPath, branch);

    if (!branchExistsLocally && !branchExistsRemotely) {
      // Branch doesn't exist anywhere - create from origin/<base_branch>
      await createBranch(baseRepoPath, branch, `origin/${baseBranch}`);
      await addWorktree(baseRepoPath, worktreePath, branch, false);
      await unsetUpstream(worktreePath);

      return {
        repoName,
        success: true,
        message: `Created new branch '${branch}' from origin/${baseBranch} and added worktree`,
        status: 'created_new',
      };
    } else if (branchExistsLocally) {
      // Branch exists locally - use it directly
      await addWorktree(baseRepoPath, worktreePath, branch, false);
      await unsetUpstream(worktreePath);

      return {
        repoName,
        success: true,
        message: `Added worktree for existing local branch '${branch}'`,
        status: 'added_local',
      };
    } else if (branchExistsRemotely) {
      // Branch exists remotely but not locally - track it
      await addWorktreeWithTracking(baseRepoPath, worktreePath, branch, `origin/${branch}`);

      return {
        repoName,
        success: true,
        message: `Added worktree and tracking remote branch 'origin/${branch}'`,
        status: 'added_remote',
      };
    }

    return {
      repoName,
      success: false,
      message: 'Unexpected state',
      status: 'error',
    };
  } catch (error) {
    return {
      repoName,
      success: false,
      message: `Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`,
      status: 'error',
    };
  }
}

/**
 * Switch to worktrees for specified branches
 */
export async function switchToWorktree(options: SwitchOptions): Promise<SwitchResult[]> {
  const config = getConfig();
  const results: SwitchResult[] = [];

  // Validate label if provided
  if (options.label) {
    try {
      validateLabel(options.label);
    } catch (error) {
      return [{
        repoName: '',
        success: false,
        message: error instanceof Error ? error.message : 'Invalid label',
        status: 'error',
      }];
    }
  }

  // Build branch map from options
  const branchMap: Record<string, string> = {};
  if (options.branchMap) {
    Object.assign(branchMap, options.branchMap);
  }

  // Process each repository
  for (const repo of config.repos) {
    // Skip if filtering by specific repo and this isn't it
    if (options.repo && repo.name !== options.repo) {
      continue;
    }

    // Determine branch for this repo
    const branch = branchMap[repo.name] || options.default;

    if (!branch) {
      results.push({
        repoName: repo.name,
        success: false,
        message: 'No branch specified',
        status: 'skipped',
      });
      continue;
    }

    // Validate branch name
    try {
      validateBranchName(branch);
    } catch (error) {
      results.push({
        repoName: repo.name,
        success: false,
        message: error instanceof Error ? error.message : 'Invalid branch name',
        status: 'error',
      });
      continue;
    }

    // Determine worktree path
    const labelFolder = options.label || branch;

    // Validate labelFolder (it may come from branch if no label provided)
    try {
      validateLabel(labelFolder);
    } catch (error) {
      results.push({
        repoName: repo.name,
        success: false,
        message: error instanceof Error ? error.message : 'Invalid label/branch for folder',
        status: 'error',
      });
      continue;
    }
    const worktreePath = path.join(config.worktrees_dir, labelFolder, repo.name);

    // Ensure parent directory exists
    const parentDir = path.dirname(worktreePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Determine base branch for this repo
    // Priority: baseBranchMap > config.base_branch > 'master'
    const baseBranch = options.baseBranchMap?.[repo.name] || config.base_branch || 'master';
    console.log(`[switch.ts] Repo ${repo.name}: using base branch '${baseBranch}' (from baseBranchMap: ${options.baseBranchMap?.[repo.name]}, config: ${config.base_branch})`);

    // Ensure worktree
    const result = await ensureWorktree(
      repo.name,
      repo.base_path,
      worktreePath,
      branch,
      baseBranch,
      options.dryRun || false
    );

    results.push(result);
  }

  return results;
}
