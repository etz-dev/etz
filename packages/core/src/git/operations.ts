import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { GitStatus, GitOperationError } from '../types';

/**
 * Get an enriched PATH with common binary locations
 * This ensures git hooks can find tools like git-lfs
 */
function getEnrichedPath(): string {
  const currentPath = process.env.PATH || '';
  const additionalPaths = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
  ];

  // Filter out paths that are already in PATH
  const pathArray = currentPath.split(':');
  const newPaths = additionalPaths.filter(p => !pathArray.includes(p));

  return [...pathArray, ...newPaths].join(':');
}

/**
 * Create a git instance for a repository
 */
export function createGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath, {
    config: [],
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: false,
  }).env({
    ...process.env,
    PATH: getEnrichedPath(),
  });
}

/**
 * Check if a path is a git repository
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const git = createGit(repoPath);
    await git.revparse(['--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git status for a repository
 */
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  try {
    const git = createGit(repoPath);
    const status: StatusResult = await git.status();

    return {
      clean: status.isClean(),
      modified: status.modified.length,
      staged: status.staged.length,
      untracked: status.not_added.length,
      ahead: status.ahead,
      behind: status.behind,
    };
  } catch (error) {
    throw new GitOperationError('status', String(error));
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const git = createGit(repoPath);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  } catch (error) {
    throw new GitOperationError('get-branch', String(error));
  }
}

/**
 * Check if a branch exists (local or remote)
 */
export async function branchExists(repoPath: string, branchName: string): Promise<boolean> {
  try {
    const git = createGit(repoPath);
    const branches = await git.branch(['-a']);

    // Check local branches
    if (branches.all.includes(branchName)) {
      return true;
    }

    // Check remote branches (format: remotes/origin/branch-name)
    const remoteBranch = `remotes/origin/${branchName}`;
    return branches.all.some(b => b === remoteBranch);
  } catch {
    return false;
  }
}

/**
 * Get all branches (local and remote)
 */
export async function getBranches(repoPath: string): Promise<string[]> {
  try {
    const git = createGit(repoPath);
    const branches = await git.branch(['-a']);

    // Filter and normalize branches
    const branchSet = new Set<string>();

    branches.all.forEach(branch => {
      // Skip HEAD ref
      if (branch.includes('HEAD')) return;

      // Remove remotes/origin/ prefix
      const normalized = branch.replace(/^remotes\/origin\//, '');
      branchSet.add(normalized);
    });

    return Array.from(branchSet).sort();
  } catch (error) {
    throw new GitOperationError('get-branches', String(error));
  }
}

/**
 * List all worktrees for a repository
 */
export async function listWorktrees(repoPath: string): Promise<Array<{ path: string; branch: string; bare: boolean }>> {
  try {
    const git = createGit(repoPath);
    const output = await git.raw(['worktree', 'list', '--porcelain']);

    const worktrees: Array<{ path: string; branch: string; bare: boolean }> = [];
    const lines = output.split('\n');

    let currentWorktree: any = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentWorktree.path = line.substring(9);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line.startsWith('bare')) {
        currentWorktree.bare = true;
      } else if (line === '') {
        if (currentWorktree.path) {
          worktrees.push({
            path: currentWorktree.path,
            branch: currentWorktree.branch || '',
            bare: currentWorktree.bare || false,
          });
        }
        currentWorktree = {};
      }
    }

    return worktrees;
  } catch (error) {
    throw new GitOperationError('list-worktrees', String(error));
  }
}

/**
 * Add a new worktree
 */
export async function addWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  createBranch: boolean = false
): Promise<void> {
  try {
    const git = createGit(repoPath);
    const args = ['worktree', 'add'];

    if (createBranch) {
      args.push('-b', branchName);
    }

    args.push(worktreePath);

    if (!createBranch) {
      args.push(branchName);
    }

    await git.raw(args);
  } catch (error) {
    throw new GitOperationError('add-worktree', String(error));
  }
}

/**
 * Remove a worktree
 */
export async function removeWorktree(repoPath: string, worktreePath: string, force: boolean = false): Promise<void> {
  try {
    const git = createGit(repoPath);
    const args = ['worktree', 'remove'];

    if (force) {
      args.push('--force');
    }

    args.push(worktreePath);

    await git.raw(args);
  } catch (error) {
    throw new GitOperationError('remove-worktree', String(error));
  }
}

/**
 * Prune worktrees (clean up stale references)
 */
export async function pruneWorktrees(repoPath: string): Promise<void> {
  try {
    const git = createGit(repoPath);
    await git.raw(['worktree', 'prune']);
  } catch (error) {
    throw new GitOperationError('prune-worktrees', String(error));
  }
}

/**
 * Fetch latest changes from remote
 */
export async function fetchRepo(repoPath: string): Promise<void> {
  try {
    const git = createGit(repoPath);
    await git.fetch();
  } catch (error) {
    throw new GitOperationError('fetch', String(error));
  }
}

/**
 * Get uncommitted changes count
 */
export async function getUncommittedCount(repoPath: string): Promise<number> {
  try {
    const status = await getGitStatus(repoPath);
    return status.modified + status.staged + status.untracked;
  } catch {
    return 0;
  }
}

/**
 * Check if worktree directory exists and is valid
 */
export function worktreeExists(worktreePath: string): boolean {
  return fs.existsSync(worktreePath) && fs.existsSync(path.join(worktreePath, '.git'));
}

/**
 * Check if a local branch exists
 */
export async function localBranchExists(repoPath: string, branchName: string): Promise<boolean> {
  try {
    const git = createGit(repoPath);
    await git.raw(['show-ref', '--verify', `refs/heads/${branchName}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a remote branch exists
 */
export async function remoteBranchExists(repoPath: string, branchName: string): Promise<boolean> {
  try {
    const git = createGit(repoPath);
    const result = await git.raw(['ls-remote', '--heads', 'origin', branchName]);
    return result.includes(branchName);
  } catch {
    return false;
  }
}

/**
 * Find which worktree (if any) is using a specific branch
 */
export async function findWorktreeByBranch(repoPath: string, branchName: string): Promise<string | null> {
  try {
    const worktrees = await listWorktrees(repoPath);
    const normalizedBranch = branchName.startsWith('refs/heads/') ? branchName : `refs/heads/${branchName}`;

    for (const worktree of worktrees) {
      const worktreeBranch = worktree.branch.startsWith('refs/heads/')
        ? worktree.branch
        : `refs/heads/${worktree.branch}`;

      if (worktreeBranch === normalizedBranch) {
        return worktree.path;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create a new local branch from a specific starting point
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  startPoint: string
): Promise<void> {
  try {
    const git = createGit(repoPath);
    await git.raw(['branch', branchName, startPoint]);
  } catch (error) {
    throw new GitOperationError('create-branch', String(error));
  }
}

/**
 * Unset the upstream tracking branch
 */
export async function unsetUpstream(repoPath: string): Promise<void> {
  try {
    const git = createGit(repoPath);
    await git.raw(['branch', '--unset-upstream']);
  } catch (error) {
    // Ignore errors - this is not critical
  }
}

/**
 * Add worktree with tracking to remote branch
 */
export async function addWorktreeWithTracking(
  repoPath: string,
  worktreePath: string,
  localBranchName: string,
  remoteBranch: string
): Promise<void> {
  try {
    const git = createGit(repoPath);
    await git.raw(['worktree', 'add', '--track', '-b', localBranchName, worktreePath, remoteBranch]);
  } catch (error) {
    throw new GitOperationError('add-worktree-tracking', String(error));
  }
}

/**
 * Delete a local branch
 */
export async function deleteLocalBranch(repoPath: string, branchName: string, force: boolean = false): Promise<void> {
  try {
    const git = createGit(repoPath);
    const args = ['branch'];

    if (force) {
      args.push('-D'); // Force delete
    } else {
      args.push('-d'); // Safe delete (only if merged)
    }

    args.push(branchName);

    await git.raw(args);
  } catch (error) {
    throw new GitOperationError('delete-branch', String(error));
  }
}
