import { EtzError, ConfigNotFoundError, InvalidConfigError, WorktreeNotFoundError, GitOperationError } from '@etz/core';
import { error, warning, theme, box } from '../ui/theme.js';

/**
 * Handle and format CLI errors
 */
export function handleError(err: unknown): void {
  console.error('\n');

  if (err instanceof ConfigNotFoundError) {
    console.error(error('Configuration file not found'));
    console.error('\n' + theme.muted('Expected location: .etzconfig.yaml (current directory or home directory)'));
    console.error('\n' + theme.info('Run the setup wizard to create a configuration:'));
    console.error(theme.highlight('  etz init'));
    process.exit(1);
  }

  if (err instanceof InvalidConfigError) {
    console.error(error('Invalid configuration'));
    console.error('\n' + theme.muted(err.message));
    console.error('\n' + theme.info('Check your .etzconfig.yaml file for errors'));
    process.exit(1);
  }

  if (err instanceof WorktreeNotFoundError) {
    console.error(error('Worktree not found'));
    console.error('\n' + theme.muted(err.message));
    console.error('\n' + theme.info('List available worktrees:'));
    console.error(theme.highlight('  etz list'));
    process.exit(1);
  }

  if (err instanceof GitOperationError) {
    console.error(error('Git operation failed'));
    console.error('\n' + theme.muted(err.message));

    // Extract useful info from git errors
    if (err.message.includes('does not exist')) {
      console.error('\n' + theme.info('Make sure the branch exists or create it first'));
    } else if (err.message.includes('already exists')) {
      console.error('\n' + theme.info('Try using a different branch name or cleaning up existing worktrees'));
    }

    process.exit(1);
  }

  if (err instanceof EtzError) {
    console.error(error('Error: ' + err.message));
    process.exit(1);
  }

  // Generic error
  if (err instanceof Error) {
    console.error(error('An unexpected error occurred'));
    console.error('\n' + theme.muted(err.message));

    if (err.stack) {
      console.error('\n' + theme.dim(err.stack));
    }

    process.exit(1);
  }

  // Unknown error
  console.error(error('An unknown error occurred'));
  console.error(theme.muted(String(err)));
  process.exit(1);
}

/**
 * Display a warning message
 */
export function displayWarning(message: string, details?: string): void {
  console.log('\n' + warning(message));
  if (details) {
    console.log(theme.muted(details));
  }
}

/**
 * Display an info box
 */
export function displayInfo(message: string, title?: string): void {
  console.log(box(message, { title, borderColor: 'cyan' }));
}

/**
 * Display a success box
 */
export function displaySuccess(message: string, title?: string): void {
  console.log(box(message, { title, borderColor: 'green' }));
}

/**
 * Display an error box
 */
export function displayErrorBox(message: string, title?: string): void {
  console.log(box(message, { title: title || 'Error', borderColor: 'red' }));
}
