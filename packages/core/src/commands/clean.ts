import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getConfig } from '../config/parser';
import { removeWorktree, worktreeExists, getCurrentBranch, deleteLocalBranch } from '../git/operations';
import { CleanOptions, CleanResult } from '../types';
import { killAllBuildsForLabel } from './build';

/**
 * Check if a directory contains an iOS project
 */
function isIOSProject(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  try {
    const entries = fs.readdirSync(dirPath);
    return entries.some(entry =>
      entry.endsWith('.xcodeproj') || entry.endsWith('.xcworkspace')
    );
  } catch {
    return false;
  }
}

/**
 * Get the project name from an iOS project directory
 */
function getIOSProjectName(dirPath: string): string | null {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  try {
    const entries = fs.readdirSync(dirPath);
    const projectFile = entries.find(entry =>
      entry.endsWith('.xcodeproj') || entry.endsWith('.xcworkspace')
    );

    if (projectFile) {
      // Remove the extension to get the project name
      return projectFile.replace(/\.(xcodeproj|xcworkspace)$/, '');
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Clean DerivedData for an iOS project
 * Returns the path that was deleted, or null if nothing was deleted
 */
function cleanIOSDerivedData(worktreePath: string, dryRun: boolean): string | null {
  const projectName = getIOSProjectName(worktreePath);
  if (!projectName) {
    return null;
  }

  // DerivedData is typically stored in ~/Library/Developer/Xcode/DerivedData/
  const derivedDataDir = path.join(
    os.homedir(),
    'Library',
    'Developer',
    'Xcode',
    'DerivedData'
  );

  if (!fs.existsSync(derivedDataDir)) {
    return null;
  }

  try {
    // Find directories that start with the project name followed by a dash
    // e.g., "MyProject-abcdefghijklmnop"
    const entries = fs.readdirSync(derivedDataDir);
    const projectDerivedData = entries.find(entry => {
      const fullPath = path.join(derivedDataDir, entry);
      return entry.startsWith(`${projectName}-`) &&
        fs.statSync(fullPath).isDirectory();
    });

    if (projectDerivedData) {
      const derivedDataPath = path.join(derivedDataDir, projectDerivedData);

      if (!dryRun) {
        fs.rmSync(derivedDataPath, { recursive: true, force: true });
      }

      return derivedDataPath;
    }
  } catch (error) {
    // Silently fail if we can't access DerivedData
    return null;
  }

  return null;
}

/**
 * Remove a worktree and its directory
 */
async function cleanWorktree(
  repoName: string,
  baseRepoPath: string,
  worktreePath: string,
  force: boolean,
  dryRun: boolean,
  deleteBranches: boolean
): Promise<CleanResult> {
  // Check if path exists
  if (!fs.existsSync(worktreePath)) {
    return {
      repoName,
      success: true,
      message: `Path not found (already deleted): ${worktreePath}`,
      status: 'not_found',
    };
  }

  // Check if it's a git worktree
  const isWorktree = worktreeExists(worktreePath);

  if (!isWorktree && !force) {
    return {
      repoName,
      success: false,
      message: 'Not a Git worktree (use force to delete)',
      status: 'not_worktree',
    };
  }

  if (dryRun) {
    let message = `Would delete: ${worktreePath}`;

    // Check if this is an iOS project and if DerivedData would be deleted
    if (isIOSProject(worktreePath)) {
      const derivedDataPath = cleanIOSDerivedData(worktreePath, true);
      if (derivedDataPath) {
        message += `\nWould also delete DerivedData: ${derivedDataPath}`;
      }
    }

    return {
      repoName,
      success: true,
      message,
      status: 'dry_run',
    };
  }

  try {
    // Get the branch name before removing the worktree (if we need to delete branches)
    let branchName: string | null = null;
    if (deleteBranches && isWorktree) {
      try {
        branchName = await getCurrentBranch(worktreePath);
      } catch (error) {
        // Ignore errors getting branch name - we'll continue with deletion
      }
    }

    // Remove git worktree if it exists
    if (isWorktree) {
      try {
        await removeWorktree(baseRepoPath, worktreePath, true);
      } catch (error) {
        if (!force) {
          return {
            repoName,
            success: false,
            message: `Failed to remove Git worktree: ${error instanceof Error ? error.message : String(error)}`,
            status: 'error',
          };
        }
        // If force is enabled, continue to folder deletion even if git worktree removal fails
      }
    }

    // Check if this is an iOS project and clean DerivedData
    let derivedDataDeleted: string | null = null;
    if (isIOSProject(worktreePath)) {
      derivedDataDeleted = cleanIOSDerivedData(worktreePath, dryRun);
    }

    // Delete the directory
    if (fs.existsSync(worktreePath)) {
      fs.rmSync(worktreePath, { recursive: true, force: true });

      let message = `Successfully deleted: ${worktreePath}`;
      if (derivedDataDeleted) {
        message += `\nAlso deleted DerivedData: ${derivedDataDeleted}`;
      }

      // Delete local branch if requested and we got a branch name
      if (deleteBranches && branchName) {
        try {
          await deleteLocalBranch(baseRepoPath, branchName, true);
          message += `\nAlso deleted local branch: ${branchName}`;
        } catch (error) {
          // Branch deletion is non-critical, just mention it failed
          message += `\nFailed to delete local branch '${branchName}': ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      return {
        repoName,
        success: true,
        message,
        status: 'deleted',
      };
    } else {
      return {
        repoName,
        success: true,
        message: 'Worktree removed (folder already deleted)',
        status: 'deleted',
      };
    }
  } catch (error) {
    return {
      repoName,
      success: false,
      message: `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
      status: 'error',
    };
  }
}

/**
 * Validate that a path doesn't contain path traversal attempts
 */
function validateNoPathTraversal(userInput: string, paramName: string): void {
  // Check for path traversal patterns
  if (userInput.includes('..') || userInput.includes('/') || userInput.includes('\\')) {
    throw new Error(`Invalid ${paramName}: cannot contain path separators or traversal sequences`);
  }

  // Check for absolute paths
  if (path.isAbsolute(userInput)) {
    throw new Error(`Invalid ${paramName}: cannot be an absolute path`);
  }

  // Check for empty or whitespace-only
  if (!userInput || userInput.trim().length === 0) {
    throw new Error(`Invalid ${paramName}: cannot be empty`);
  }
}

/**
 * Clean worktrees for a given label
 */
export async function clean(options: CleanOptions): Promise<CleanResult[]> {
  const config = getConfig();
  const results: CleanResult[] = [];

  // Validate label for path traversal
  try {
    validateNoPathTraversal(options.label, 'label');
  } catch (error) {
    return [
      {
        repoName: '',
        success: false,
        message: error instanceof Error ? error.message : 'Invalid label',
        status: 'error',
      },
    ];
  }

  // Kill any active builds for this label before cleaning
  const killedBuilds = killAllBuildsForLabel(options.label);
  if (killedBuilds > 0) {
    // We don't need to return this info, but it's good to know the action was taken
    // The UI will have already warned the user
  }

  const labelFolder = path.join(config.worktrees_dir, options.label);

  // Double-check that the resolved path is actually within worktrees_dir
  const normalizedLabelFolder = path.normalize(labelFolder);
  const normalizedWorktreesDir = path.normalize(config.worktrees_dir);
  if (!normalizedLabelFolder.startsWith(normalizedWorktreesDir + path.sep)) {
    return [
      {
        repoName: '',
        success: false,
        message: 'Security error: path traversal detected',
        status: 'error',
      },
    ];
  }

  // Check if label folder exists
  if (!fs.existsSync(labelFolder)) {
    return [
      {
        repoName: '',
        success: false,
        message: `No worktree directory found at ${labelFolder}`,
        status: 'not_found',
      },
    ];
  }

  // Determine which repos to clean
  let reposToClean = config.repos;
  if (options.repo) {
    reposToClean = config.repos.filter((r) => r.name === options.repo);
  }

  // Clean each repo
  for (const repo of reposToClean) {
    const worktreePath = path.join(labelFolder, repo.name);
    const result = await cleanWorktree(
      repo.name,
      repo.base_path,
      worktreePath,
      options.force || false,
      options.dryRun || false,
      options.deleteBranches || false
    );
    results.push(result);
  }

  // Try to remove parent label folder if empty (only if not dry run)
  if (!options.dryRun && fs.existsSync(labelFolder)) {
    try {
      const entries = fs.readdirSync(labelFolder);
      // Filter out hidden files like .DS_Store
      const visibleEntries = entries.filter(entry => !entry.startsWith('.'));
      if (visibleEntries.length === 0) {
        // Force remove the folder and all its contents (including hidden files)
        fs.rmSync(labelFolder, { recursive: true, force: true });
        results.push({
          repoName: '',
          success: true,
          message: `Deleted empty label folder: ${labelFolder}`,
          status: 'deleted',
        });
      }
    } catch (error) {
      // Ignore errors when removing parent folder
    }
  }

  return results;
}
