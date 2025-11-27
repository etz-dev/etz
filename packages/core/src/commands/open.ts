import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { getConfig } from '../config/parser';
import { OpenOptions, OpenResult } from '../types';

/**
 * Validate that a path component doesn't contain path traversal attempts
 */
function validatePathComponent(userInput: string, paramName: string): void {
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
 * Validate that the editor/tool command is safe
 */
function validateEditorCommand(tool: string): void {
  // Whitelist of common safe editor commands
  const allowedEditors = [
    'code',        // VS Code
    'code-insiders',
    'cursor',      // Cursor
    'subl',        // Sublime Text
    'atom',        // Atom
    'vim',         // Vim
    'nvim',        // Neovim
    'emacs',       // Emacs
    'nano',        // Nano
    'idea',        // IntelliJ IDEA
    'webstorm',    // WebStorm
    'pycharm',     // PyCharm
    'xcode',       // Xcode
  ];

  // Check if the tool is in the whitelist (exact match or starts with allowed command)
  const isAllowed = allowedEditors.some(
    (allowed) => tool === allowed || tool.startsWith(`${allowed} `)
  );

  if (!isAllowed) {
    // If not in whitelist, validate that it doesn't contain shell metacharacters
    if (/[;&|`$()<>]/.test(tool)) {
      throw new Error(`Invalid editor command: contains shell metacharacters`);
    }
  }
}

/**
 * Open a worktree in an editor or tool
 */
export async function open(options: OpenOptions): Promise<OpenResult> {
  const config = getConfig();

  // Validate inputs for path traversal
  try {
    validatePathComponent(options.label, 'label');
    validatePathComponent(options.repo, 'repo');
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Invalid input',
    };
  }

  // Construct the worktree path
  const worktreePath = path.join(config.worktrees_dir, options.label, options.repo);

  // Double-check that the resolved path is actually within worktrees_dir
  const normalizedWorktreePath = path.normalize(worktreePath);
  const normalizedWorktreesDir = path.normalize(config.worktrees_dir);
  if (!normalizedWorktreePath.startsWith(normalizedWorktreesDir + path.sep)) {
    return {
      success: false,
      message: 'Security error: path traversal detected',
    };
  }

  // Check if path exists
  if (!fs.existsSync(worktreePath)) {
    return {
      success: false,
      message: `Path does not exist: ${worktreePath}`,
    };
  }

  // Determine which tool to use
  let tool = options.editor || 'code'; // Default to VS Code

  // Check if repo has a specific tool configured
  const repoConfig = config.repos.find((r) => r.name === options.repo);
  if (repoConfig && 'tool' in repoConfig) {
    tool = (repoConfig as any).tool;
  }

  // Allow editor option to override
  if (options.editor) {
    tool = options.editor;
  }

  // Validate the editor command for security
  try {
    validateEditorCommand(tool);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Invalid editor command',
    };
  }

  try {
    // Check if tool is a path to a .app bundle (macOS)
    if (tool.endsWith('.app')) {
      // Use macOS 'open' command to launch .app bundles
      const child = spawn('open', ['-a', tool, worktreePath], {
        detached: true,
        stdio: 'ignore',
      });

      // Detach the child process so it continues to run independently
      child.unref();

      return {
        success: true,
        message: `Opening ${worktreePath} with ${tool}`,
      };
    } else {
      // Standard command-line tool
      const child = spawn(tool, [worktreePath], {
        detached: true,
        stdio: 'ignore',
      });

      // Detach the child process so it continues to run independently
      child.unref();

      return {
        success: true,
        message: `Opening ${worktreePath} in ${tool}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to open: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
