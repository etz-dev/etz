/**
 * @etz/core - Core TypeScript library for Etz git worktree management
 */

// Export all types
export * from './types';

// Export config functions
export { getConfig, parseConfig, findConfigPath } from './config/parser';

// Export git operations
export * from './git/operations';

// Export commands
export { list, getWorktree } from './commands/list';
export { switchToWorktree } from './commands/switch';
export { doctor } from './commands/doctor';
export { clean } from './commands/clean';
export { open } from './commands/open';
export { getBranches } from './commands/branches';
export {
  checkBuildPreConditions,
  runPodInstall,
  buildInfraIOS,
  buildIOS,
  buildAndroid,
  isBuildInProgress,
  getActiveBuildInfo,
  getBuildOutput,
  killBuild,
} from './commands/build';

// Export repo type detection utilities
export {
  detectRepoType,
  detectRepoTypeByName,
  detectRepoTypeWithFallback,
  type RepoType,
} from './utils/detectRepoType';
