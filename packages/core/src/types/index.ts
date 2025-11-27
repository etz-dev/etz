/**
 * Core types for Etz git worktree management
 */

export interface EtzConfig {
  base_branch: string;
  worktrees_dir: string;
  repos: RepoConfig[];
}

export interface RepoConfig {
  name: string;
  base_path: string;
}

export interface WorktreeInfo {
  label: string;
  repos: RepoWorktreeInfo[];
}

export interface RepoWorktreeInfo {
  name: string;
  branch: string;
  path: string;
  clean: boolean;
  uncommitted: number;
  exists: boolean;
}

export interface GitStatus {
  clean: boolean;
  modified: number;
  staged: number;
  untracked: number;
  ahead: number;
  behind: number;
}

export interface SwitchOptions {
  label?: string; // Optional parent folder name
  branchMap?: Record<string, string>; // repo name -> branch name
  default?: string; // Fallback branch for any repo not explicitly set
  baseBranchMap?: Record<string, string>; // repo name -> base branch name (for creating new branches)
  dryRun?: boolean; // Preview what would be done
  repo?: string; // Only switch this specific repo
}

export interface SwitchResult {
  repoName: string;
  success: boolean;
  message: string;
  status: 'already_exists' | 'already_in_use' | 'dry_run' | 'created_new' | 'added_local' | 'added_remote' | 'error' | 'skipped';
}

export interface DoctorResult {
  success: boolean;
  checks: DoctorCheck[];
}

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface CleanOptions {
  label: string;
  repo?: string; // Only clean this specific repo
  force?: boolean; // Force delete even if not a git worktree
  dryRun?: boolean; // Preview what would be deleted
  deleteBranches?: boolean; // Also delete local git branches (not remote)
}

export interface CleanResult {
  repoName: string;
  success: boolean;
  message: string;
  status: 'not_found' | 'not_worktree' | 'dry_run' | 'deleted' | 'error';
}

export interface OpenOptions {
  label: string;
  repo: string;
  editor?: string; // Override editor/tool to use
}

export interface OpenResult {
  success: boolean;
  message: string;
}

export type Platform = 'ios' | 'android';

export interface BuildOptions {
  label: string;
  platform: Platform;
  repo: string; // 'project.ios' or 'project.android'
}

export interface BuildPreCondition {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  canAutoFix: boolean;
  fixAction?: string; // e.g., 'pod_install', 'build_infra'
}

export interface BuildPreCheckResult {
  platform: Platform;
  repo: string;
  ready: boolean;
  conditions: BuildPreCondition[];
}

export interface BuildProgress {
  label: string;
  stage: string;
  progress: number; // 0-100
  message: string;
  timestamp: number;
}

export interface BuildResult {
  success: boolean;
  platform: Platform;
  repo: string;
  duration?: number; // in seconds
  error?: string;
  output?: string;
}

// Error types
export class EtzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtzError';
  }
}

export class ConfigNotFoundError extends EtzError {
  constructor() {
    super('.etzconfig.yaml not found in current directory or home directory');
    this.name = 'ConfigNotFoundError';
  }
}

export class InvalidConfigError extends EtzError {
  constructor(message: string) {
    super(`Invalid configuration: ${message}`);
    this.name = 'InvalidConfigError';
  }
}

export class WorktreeNotFoundError extends EtzError {
  constructor(label: string) {
    super(`Worktree '${label}' not found`);
    this.name = 'WorktreeNotFoundError';
  }
}

export class GitOperationError extends EtzError {
  constructor(operation: string, details: string) {
    super(`Git operation '${operation}' failed: ${details}`);
    this.name = 'GitOperationError';
  }
}
