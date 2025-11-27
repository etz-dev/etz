import chalk from 'chalk';

/**
 * Color theme for the CLI
 */
export const theme = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  muted: chalk.gray,

  // Semantic colors
  primary: chalk.blue,
  secondary: chalk.magenta,
  highlight: chalk.cyan.bold,

  // Text styles
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,

  // Status indicators with emojis
  successIcon: '✅',
  errorIcon: '❌',
  warningIcon: '⚠️',
  infoIcon: 'ℹ️',
  pendingIcon: '⏳',
  runningIcon: '🔄',
  cleanIcon: '✨',
  dirtyIcon: '📝',
  newIcon: '🌱',
  buildIcon: '🔨',
  rocketIcon: '🚀',
  folderIcon: '📁',
  branchIcon: '🌿',
  checkIcon: '✓',
  crossIcon: '✗',
};

/**
 * Format success message
 */
export function success(message: string): string {
  return `${theme.successIcon} ${theme.success(message)}`;
}

/**
 * Format error message
 */
export function error(message: string): string {
  return `${theme.errorIcon} ${theme.error(message)}`;
}

/**
 * Format warning message
 */
export function warning(message: string): string {
  return `${theme.warningIcon} ${theme.warning(message)}`;
}

/**
 * Format info message
 */
export function info(message: string): string {
  return `${theme.infoIcon} ${theme.info(message)}`;
}

/**
 * Format header
 */
export function header(message: string): string {
  return theme.bold(theme.primary(message));
}

/**
 * Format subheader
 */
export function subheader(message: string): string {
  return theme.bold(theme.secondary(message));
}

/**
 * Format label
 */
export function label(text: string): string {
  return theme.dim(text);
}

/**
 * Format value
 */
export function value(text: string): string {
  return theme.highlight(text);
}

/**
 * Format section header
 */
export function section(title: string): string {
  return `\n${theme.bold(theme.primary(`▶ ${title}`))}\n`;
}

/**
 * Create a boxed message
 */
export function box(message: string, options?: {
  title?: string;
  borderColor?: 'green' | 'red' | 'yellow' | 'blue' | 'magenta' | 'cyan';
  padding?: number;
}): string {
  const boxen = require('boxen');
  return boxen(message, {
    padding: options?.padding ?? 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: options?.borderColor ?? 'cyan',
    title: options?.title,
    titleAlignment: 'center',
  });
}
