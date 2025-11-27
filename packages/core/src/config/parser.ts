import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as os from 'os';
import {
  EtzConfig,
  ConfigNotFoundError,
  InvalidConfigError,
} from '../types';

/**
 * Find the .etzconfig.yaml file
 * Looks in current directory first, then home directory
 */
export function findConfigPath(): string {
  const cwd = process.cwd();
  const homeDir = os.homedir();

  // Check current directory
  const cwdConfig = path.join(cwd, '.etzconfig.yaml');
  if (fs.existsSync(cwdConfig)) {
    return cwdConfig;
  }

  // Check home directory
  const homeConfig = path.join(homeDir, '.etzconfig.yaml');
  if (fs.existsSync(homeConfig)) {
    return homeConfig;
  }

  throw new ConfigNotFoundError();
}

/**
 * Parse and validate the configuration file
 */
export function parseConfig(configPath?: string): EtzConfig {
  const configFile = configPath || findConfigPath();

  try {
    const fileContents = fs.readFileSync(configFile, 'utf8');
    // Use safeLoad to prevent arbitrary code execution from YAML files
    const config = yaml.load(fileContents, { schema: yaml.FAILSAFE_SCHEMA }) as any;

    // Validate required fields
    if (!config.base_branch) {
      throw new InvalidConfigError('Missing required field: base_branch');
    }

    if (!config.worktrees_dir) {
      throw new InvalidConfigError('Missing required field: worktrees_dir');
    }

    if (!Array.isArray(config.repos) || config.repos.length === 0) {
      throw new InvalidConfigError('Missing or empty repos array');
    }

    // Validate each repo
    for (const repo of config.repos) {
      if (!repo.name) {
        throw new InvalidConfigError('Repo missing required field: name');
      }
      if (!repo.base_path) {
        throw new InvalidConfigError(`Repo '${repo.name}' missing required field: base_path`);
      }
    }

    // Expand ~ in paths
    const expandPath = (p: string): string => {
      if (p.startsWith('~/')) {
        return path.join(os.homedir(), p.slice(2));
      }
      return p;
    };

    const parsedConfig: EtzConfig = {
      base_branch: config.base_branch,
      worktrees_dir: expandPath(config.worktrees_dir),
      repos: config.repos.map((repo: any) => ({
        name: repo.name,
        base_path: expandPath(repo.base_path),
      })),
    };

    return parsedConfig;
  } catch (error) {
    if (error instanceof InvalidConfigError || error instanceof ConfigNotFoundError) {
      throw error;
    }
    throw new InvalidConfigError(`Failed to parse config: ${error}`);
  }
}

/**
 * Get config with caching
 */
let cachedConfig: EtzConfig | null = null;

export function getConfig(configPath?: string): EtzConfig {
  if (!cachedConfig || configPath) {
    cachedConfig = parseConfig(configPath);
  }
  return cachedConfig;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
