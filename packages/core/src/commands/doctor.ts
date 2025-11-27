import * as fs from 'fs';
import * as path from 'path';
import { getConfig, findConfigPath } from '../config/parser';
import { isGitRepo } from '../git/operations';
import { DoctorResult, DoctorCheck } from '../types';

/**
 * Run diagnostic checks to ensure Etz is properly configured
 */
export async function doctor(): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  let overallSuccess = true;

  // Check 1: Config file exists
  try {
    const configPath = findConfigPath();
    checks.push({
      name: 'Config file exists',
      status: 'pass',
      message: `.etzconfig.yaml found at ${configPath}`,
    });
  } catch (error) {
    overallSuccess = false;
    checks.push({
      name: 'Config file exists',
      status: 'fail',
      message: '.etzconfig.yaml not found in current directory or home directory',
    });
    return { success: false, checks };
  }

  // Check 2: Config is parseable
  let config;
  try {
    config = getConfig();
    checks.push({
      name: 'Config is valid',
      status: 'pass',
      message: 'Configuration file is valid and parseable',
    });
  } catch (error) {
    overallSuccess = false;
    checks.push({
      name: 'Config is valid',
      status: 'fail',
      message: `Failed to parse config: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { success: false, checks };
  }

  // Check 3: Worktrees directory exists or can be created
  const worktreesDir = config.worktrees_dir;
  if (fs.existsSync(worktreesDir)) {
    checks.push({
      name: 'Worktrees directory',
      status: 'pass',
      message: `Worktrees directory exists at ${worktreesDir}`,
    });
  } else {
    checks.push({
      name: 'Worktrees directory',
      status: 'warning',
      message: `Worktrees directory doesn't exist yet: ${worktreesDir} (will be created when needed)`,
    });
  }

  // Check 4: Repos exist
  if (config.repos.length === 0) {
    checks.push({
      name: 'Repository configuration',
      status: 'warning',
      message: 'No repositories defined in configuration',
    });
  } else {
    for (const repo of config.repos) {
      const repoPath = repo.base_path;

      if (!fs.existsSync(repoPath)) {
        overallSuccess = false;
        checks.push({
          name: `Repository: ${repo.name}`,
          status: 'fail',
          message: `Repository path does not exist: ${repoPath}`,
        });
      } else if (!(await isGitRepo(repoPath))) {
        overallSuccess = false;
        checks.push({
          name: `Repository: ${repo.name}`,
          status: 'fail',
          message: `Path exists but is not a git repository: ${repoPath}`,
        });
      } else {
        checks.push({
          name: `Repository: ${repo.name}`,
          status: 'pass',
          message: `Found at ${repoPath}`,
        });
      }
    }
  }

  return {
    success: overallSuccess,
    checks,
  };
}
