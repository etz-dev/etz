# Etz Core

TypeScript library for managing git worktrees across multiple repositories.

Part of the [Etz](../../README.md) project. Used by the CLI and desktop app.

## Installation

```bash
npm install @etz/core
```

## Usage

```typescript
import { EtzCore } from '@etz/core';

// Initialize with configuration
const etz = new EtzCore({
  configPath: '~/.etzconfig.yaml'
});

// List all worktrees
const worktrees = await etz.listWorktrees();

// Create a new worktree
await etz.createWorktree({
  label: 'feature-branch',
  branches: {
    frontend: 'feat-ui',
    backend: 'feat-api'
  }
});

// Delete a worktree
await etz.deleteWorktree('feature-branch', {
  deleteBranches: true
});
```

## API Documentation

### Configuration

The library reads configuration from `~/.etzconfig.yaml` or a custom path:

```yaml
base_branch: main
worktrees_dir: ~/Developer/worktrees
repos:
  - name: frontend
    base_path: ~/Developer/repos/frontend
  - name: backend
    base_path: ~/Developer/repos/backend
```

### Main Classes

#### `EtzCore`

The main entry point for the library.

**Methods:**
- `listWorktrees()` - Get all worktrees with status
- `createWorktree(options)` - Create a new worktree
- `deleteWorktree(label, options)` - Delete a worktree
- `getWorktreeStatus(label)` - Get status for a specific worktree
- `runDoctor()` - Run health checks

#### `GitOperations`

Low-level git operations.

**Methods:**
- `createWorktree(repoPath, branch, worktreePath)` - Create a git worktree
- `deleteWorktree(repoPath, worktreePath)` - Remove a git worktree
- `getStatus(repoPath)` - Get git status
- `listBranches(repoPath)` - List all branches

### Types

```typescript
interface WorktreeInfo {
  label: string;
  path: string;
  repos: RepoInfo[];
}

interface RepoInfo {
  name: string;
  branch: string;
  status: GitStatus;
  path: string;
}

interface GitStatus {
  clean: boolean;
  modified: number;
  added: number;
  deleted: number;
  ahead: number;
  behind: number;
}
```

## Development

```bash
# Build the library
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## License

MIT - see [LICENSE](../../LICENSE)
