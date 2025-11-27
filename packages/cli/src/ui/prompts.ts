import inquirer from 'inquirer';
import type { EtzConfig } from '@etz/core';

/**
 * Prompt for worktree label
 */
export async function promptForLabel(defaultLabel?: string): Promise<string> {
  const { label } = await inquirer.prompt<{ label: string }>([
    {
      type: 'input',
      name: 'label',
      message: 'Enter worktree label:',
      default: defaultLabel,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Label cannot be empty';
        }
        if (input.includes('..') || input.includes('/') || input.includes('\\')) {
          return 'Label cannot contain path separators or ".."';
        }
        return true;
      },
    },
  ]);

  return label.trim();
}

/**
 * Prompt for branch selection
 */
export async function promptForBranch(
  repoName: string,
  branches: string[],
  defaultBranch?: string
): Promise<string> {
  const { branch } = await inquirer.prompt<{ branch: string }>([
    {
      type: 'list',
      name: 'branch',
      message: `Select branch for ${repoName}:`,
      choices: branches,
      default: defaultBranch,
      pageSize: 15,
    },
  ]);

  return branch;
}

/**
 * Prompt for branch input with autocomplete
 */
export async function promptForBranchInput(
  repoName: string,
  defaultBranch?: string
): Promise<string> {
  const { branch } = await inquirer.prompt<{ branch: string }>([
    {
      type: 'input',
      name: 'branch',
      message: `Enter branch name for ${repoName}:`,
      default: defaultBranch,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Branch name cannot be empty';
        }
        return true;
      },
    },
  ]);

  return branch.trim();
}

/**
 * Prompt for confirmation
 */
export async function promptForConfirmation(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);

  return confirmed;
}

/**
 * Prompt for repo selection
 */
export async function promptForRepo(
  config: EtzConfig,
  message: string = 'Select a repository:'
): Promise<string> {
  const { repo } = await inquirer.prompt<{ repo: string }>([
    {
      type: 'list',
      name: 'repo',
      message,
      choices: config.repos.map(r => r.name),
      pageSize: 10,
    },
  ]);

  return repo;
}

/**
 * Prompt for multiple repo selection
 */
export async function promptForRepos(
  config: EtzConfig,
  message: string = 'Select repositories:'
): Promise<string[]> {
  const { repos } = await inquirer.prompt<{ repos: string[] }>([
    {
      type: 'checkbox',
      name: 'repos',
      message,
      choices: config.repos.map(r => ({ name: r.name, checked: true })),
      pageSize: 10,
      validate: (input: string[]) => {
        if (input.length === 0) {
          return 'You must select at least one repository';
        }
        return true;
      },
    },
  ]);

  return repos;
}

/**
 * Prompt for editor selection
 */
export async function promptForEditor(defaultEditor?: string): Promise<string> {
  const editors = ['code', 'cursor', 'vim', 'nvim', 'idea', 'webstorm', 'xcode'];

  const { editor } = await inquirer.prompt<{ editor: string }>([
    {
      type: 'list',
      name: 'editor',
      message: 'Select an editor:',
      choices: editors,
      default: defaultEditor || 'code',
      pageSize: 10,
    },
  ]);

  return editor;
}

/**
 * Prompt for build platform
 */
export async function promptForPlatform(): Promise<'ios' | 'android'> {
  const { platform } = await inquirer.prompt<{ platform: 'ios' | 'android' }>([
    {
      type: 'list',
      name: 'platform',
      message: 'Select build platform:',
      choices: ['ios', 'android'],
    },
  ]);

  return platform;
}
