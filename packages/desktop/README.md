# Etz Desktop App

Desktop application for managing git worktrees across multiple repositories.

Part of the [Etz](../../README.md) project.

## Getting Started

### Prerequisites

- Node.js 18+
- The `etz` CLI tool installed and configured

### Development

```bash
# Start the development server
npm run dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Build Electron main/preload scripts
3. Launch the Electron app with hot reload

### Building

```bash
# Build for your platform
npm run build:mac    # macOS DMG
npm run build:win    # Windows installer
npm run build:linux  # Linux AppImage/deb
```

## Features

- View all worktrees and their status
- Create new worktrees
- Delete worktrees
- Open repos in editor
- Build repos

## Stack

- Electron + React + TypeScript
- Vite for building

## Notes

The app wraps the `etz` CLI tool, so it needs to be installed and in your PATH.

## Troubleshooting

### "etz command not found"
Make sure `etz` CLI is installed and in your PATH:
```bash
which etz
# Should output: /Users/yourusername/.local/bin/etz
```

If not found, install etz:
```bash
cd .. && make install
```

### App shows empty state but you have worktrees
The desktop app uses the `worktrees_dir` from your `~/.etzconfig.yaml`. Verify:
1. Config file exists at `~/.etzconfig.yaml`
2. The `worktrees_dir` path is correct
3. Run `etz list --json` in terminal to verify CLI returns data

### Development mode not loading
1. Check port 5173 is not already in use
2. Try running `npm run dev:vite` and `npm run dev:electron` separately
3. Check console for errors

## Installation

Download from [releases](https://github.com/etz-dev/etz/releases) or build from source:

```bash
# From monorepo root
npm install
npm run dev:desktop
```

## License

MIT - see [LICENSE](../../LICENSE)
