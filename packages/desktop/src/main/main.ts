import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import {
  list,
  switchToWorktree,
  doctor,
  clean,
  open as openWorktree,
  checkBuildPreConditions,
  runPodInstall,
  buildInfraIOS,
  buildIOS,
  buildAndroid,
  isBuildInProgress,
  getActiveBuildInfo,
  getBuildOutput,
  killBuild,
  getBranches,
  detectRepoTypeWithFallback,
  type RepoType,
} from '@etz/core'

// Config Management Types and Constants
interface Repository {
  id: string
  name: string
  sourceType: 'local' | 'github'
  path?: string
  url?: string
  enabledByDefault: boolean
  baseBranch?: string
  postCreateScripts?: string[]
}

interface Script {
  id: string
  name: string
  type: 'pre-create' | 'post-create'
  scope: 'global' | 'per-repo'
  repoName?: string
  commands: string[]
  continueOnError: boolean
  enabled: boolean
}

interface EtzConfig {
  version: string
  setupComplete: boolean
  workspace: {
    baseDirectory: string
  }
  repositories: Repository[]
  scripts: Script[]
  github?: {
    token?: string
    organizations?: string[]
  }
  ui: {
    theme: 'light' | 'dark'
    layoutMode: '1-col' | '2-col' | 'auto'
    terminalPreference: string
    editorPreference: string
  }
}

const CONFIG_VERSION = '1.0.0'
const CONFIG_DIR = path.join(os.homedir(), '.etz')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

// Config Management Functions
function getDefaultConfig(): EtzConfig {
  return {
    version: CONFIG_VERSION,
    setupComplete: false,
    workspace: {
      baseDirectory: path.join(os.homedir(), 'worktrees'),
    },
    repositories: [],
    scripts: [],
    ui: {
      theme: 'light',
      layoutMode: 'auto',
      terminalPreference: 'default',
      editorPreference: 'vscode',
    },
  }
}

async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create config directory:', error)
    throw error
  }
}

async function isFirstTime(): Promise<boolean> {
  try {
    await fs.access(CONFIG_FILE)
    const config = await getConfig()
    return !config.setupComplete
  } catch (error) {
    return true
  }
}

async function getConfig(): Promise<EtzConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(data) as EtzConfig

    if (config.version !== CONFIG_VERSION) {
      return migrateConfig(config)
    }

    return config
  } catch (error) {
    console.log('Config file not found, returning defaults')
    return getDefaultConfig()
  }
}

async function saveConfig(config: EtzConfig): Promise<void> {
  try {
    await ensureConfigDir()
    config.version = CONFIG_VERSION
    const data = JSON.stringify(config, null, 2)
    await fs.writeFile(CONFIG_FILE, data, 'utf-8')
    console.log('Config saved successfully')
  } catch (error) {
    console.error('Failed to save config:', error)
    throw error
  }
}

async function resetConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_FILE)
    console.log('Config reset successfully')
  } catch (error) {
    console.log('Config file not found, nothing to reset')
  }
}

function migrateConfig(oldConfig: EtzConfig): EtzConfig {
  console.log(`Migrating config from version ${oldConfig.version} to ${CONFIG_VERSION}`)
  const newConfig = {
    ...getDefaultConfig(),
    ...oldConfig,
    version: CONFIG_VERSION,
  }
  return newConfig
}

function createWindow() {
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'build', 'icon.png')
    : path.join(process.resourcesPath, 'build', 'icon.png')

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  })

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  // Dev mode: Register global shortcut for resetting setup
  if (process.env.NODE_ENV === 'development') {
    const ret = globalShortcut.register('CommandOrControl+Shift+R', async () => {
      console.log('[Main] Reset shortcut triggered')
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        const response = await dialog.showMessageBox(focusedWindow, {
          type: 'question',
          buttons: ['Cancel', 'Reset'],
          defaultId: 1,
          title: 'Reset Setup Wizard',
          message: 'Reset setup wizard?',
          detail: 'This will delete ~/.etz/config.json and reload the app.'
        })

        if (response.response === 1) { // Reset button
          console.log('[Main] User confirmed reset')
          try {
            await resetConfig()
            console.log('[Main] Config reset complete, reloading...')
            focusedWindow.reload()
          } catch (error) {
            console.error('[Main] Failed to reset config:', error)
            await dialog.showMessageBox(focusedWindow, {
              type: 'error',
              title: 'Reset Failed',
              message: 'Failed to reset configuration',
              detail: error instanceof Error ? error.message : String(error)
            })
          }
        } else {
          console.log('[Main] User cancelled reset')
        }
      }
    })

    if (ret) {
      console.log('[Main] Reset shortcut registered successfully')
    } else {
      console.log('[Main] Failed to register reset shortcut')
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers using etz-core library
ipcMain.handle('etz:list', async () => {
  try {
    const worktrees = await list()
    return worktrees
  } catch (error) {
    console.error('Error listing worktrees:', error)
    return []
  }
})

ipcMain.handle('etz:detectRepoType', async (_, repoPath: string, repoName: string): Promise<RepoType> => {
  try {
    const repoType = await detectRepoTypeWithFallback(repoPath, repoName)
    return repoType
  } catch (error) {
    console.error(`Error detecting repo type for ${repoName}:`, error)
    return 'unknown'
  }
})

ipcMain.handle('etz:switch', async (_, label: string, repos: Record<string, string>, defaultBranch?: string, baseBranchOverrides?: Record<string, string>) => {
  try {
    console.log('[etz:switch] Received parameters:', {
      label,
      repos,
      defaultBranch,
      baseBranchOverrides
    })

    // Determine if we're using label as the branch name (default mode)
    // If defaultBranch is provided, use it. Otherwise, if repos is empty, use label.
    const effectiveDefaultBranch = defaultBranch || (Object.keys(repos).length === 0 ? label : undefined)

    // Build baseBranchMap from config
    const config = await getConfig()
    const baseBranchMap: Record<string, string> = {}
    for (const repo of config.repositories) {
      if (repo.baseBranch) {
        baseBranchMap[repo.name] = repo.baseBranch
      }
    }

    console.log('[etz:switch] Base branch map from config:', baseBranchMap)

    // Merge in any overrides (overrides take precedence)
    if (baseBranchOverrides) {
      for (const [repoName, baseBranch] of Object.entries(baseBranchOverrides)) {
        if (baseBranch && baseBranch.trim()) {
          baseBranchMap[repoName] = baseBranch.trim()
        }
      }
    }

    console.log('[etz:switch] Final base branch map after merging overrides:', baseBranchMap)

    const results = await switchToWorktree({
      label,
      branchMap: repos,
      default: effectiveDefaultBranch,
      baseBranchMap, // Pass base branches for each repo
    })

    // Format output for display with debug info
    const debugInfo = `\n\n[DEBUG] Base branch map: ${JSON.stringify(baseBranchMap)}`
    const output = results
      .map(r => `${r.success ? '✓' : '✗'} ${r.repoName}: ${r.message}`)
      .join('\n') + debugInfo

    const success = results.every(r => r.success)

    // If any result has an error, aggregate them
    const errors = results
      .filter(r => !r.success)
      .map(r => `${r.repoName}: ${r.message}`)
      .join(', ')

    return {
      success,
      output,
      results,
      error: errors || undefined
    }
  } catch (error: any) {
    console.error('Switch error:', error)
    const errorMessage = error?.message || String(error) || 'Unknown error occurred'
    return { success: false, error: errorMessage, output: '' }
  }
})

ipcMain.handle('etz:clean', async (_, label: string, deleteBranches?: boolean) => {
  try {
    const results = await clean({ label, force: true, deleteBranches })

    const output = results
      .map(r => `${r.success ? '✓' : '✗'} ${r.repoName || 'Folder'}: ${r.message}`)
      .join('\n')

    const success = results.every(r => r.success)
    return { success, output, results }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('etz:open', async (_, label: string, repo: string) => {
  try {
    // Get config to find repo's preferred editor
    const config = await getConfig()
    const repoConfig = config.repositories?.find((r: any) => r.name === repo)

    // Determine which editor to use
    let editorPath: string | undefined
    if (repoConfig?.preferredEditorPath) {
      // Use repository-specific editor path if set
      editorPath = repoConfig.preferredEditorPath
    } else if (repoConfig?.preferredEditor && repoConfig.preferredEditor !== 'default') {
      // Map legacy editor IDs to commands or paths
      const editorCommands: Record<string, string> = {
        'vscode': 'code',
        'cursor': 'cursor',
        'sublime': 'subl',
        'webstorm': 'webstorm',
        'xcode': '/Applications/Xcode.app',
        'intellij': '/Applications/IntelliJ IDEA.app',
        'android-studio': '/Applications/Android Studio.app',
        'pycharm': '/Applications/PyCharm.app',
        'phpstorm': '/Applications/PhpStorm.app',
        'goland': '/Applications/GoLand.app',
        'rider': '/Applications/Rider.app',
        'clion': '/Applications/CLion.app',
        'rubymine': '/Applications/RubyMine.app'
      }
      editorPath = editorCommands[repoConfig.preferredEditor]
    }

    const result = await openWorktree({
      label,
      repo,
      editor: editorPath
    })
    return result
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('etz:doctor', async () => {
  try {
    const result = await doctor()

    // Format output for display
    const output = result.checks
      .map(check => {
        const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '⚠'
        return `${icon} ${check.name}: ${check.message}`
      })
      .join('\n')

    return {
      success: result.success,
      output,
      checks: result.checks,
    }
  } catch (error: any) {
    return { success: false, error: error.message, output: '', checks: [] }
  }
})

// These onboarding handlers are no longer needed since etz is now bundled
// but we'll keep them for backwards compatibility
ipcMain.handle('etz:checkInstalled', async () => {
  // Always return true since etz-core is now bundled
  return { installed: true }
})

ipcMain.handle('etz:installViaPip', async () => {
  // Not needed anymore
  return { success: true, output: 'Etz core is already bundled with the app' }
})

// Build-related IPC handlers
ipcMain.handle('etz:checkBuildPreConditions', async (_, label: string, platform: 'ios' | 'android', repo: string) => {
  try {
    const result = await checkBuildPreConditions({ label, platform, repo })
    return result
  } catch (error: any) {
    return {
      platform,
      repo,
      ready: false,
      conditions: [{
        id: 'error',
        name: 'Error',
        status: 'fail' as const,
        message: error.message,
        canAutoFix: false,
      }],
    }
  }
})

ipcMain.handle('etz:runPodInstall', async (_, label: string) => {
  try {
    // Create a window reference for sending progress updates
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows[0]

    const result = await runPodInstall(label, (progress) => {
      mainWindow?.webContents.send('build:progress', progress)
    })

    return result
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
})

ipcMain.handle('etz:buildInfraIOS', async (_, label: string) => {
  try {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows[0]

    const result = await buildInfraIOS(label, (progress) => {
      mainWindow?.webContents.send('build:progress', progress)
    })

    return result
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
})

ipcMain.handle('etz:buildIOS', async (_, label: string) => {
  try {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows[0]

    const result = await buildIOS(label, (progress) => {
      mainWindow?.webContents.send('build:progress', progress)
    })

    return result
  } catch (error: any) {
    return {
      success: false,
      platform: 'ios' as const,
      repo: 'ios',
      error: error.message,
    }
  }
})

ipcMain.handle('etz:buildAndroid', async (_, label: string) => {
  try {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows[0]

    const result = await buildAndroid(label, (progress) => {
      mainWindow?.webContents.send('build:progress', progress)
    })

    return result
  } catch (error: any) {
    return {
      success: false,
      platform: 'android' as const,
      repo: 'android',
      error: error.message,
    }
  }
})

// Build status check handlers
ipcMain.handle('etz:isBuildInProgress', async (_, label: string, type?: string) => {
  return isBuildInProgress(label, type)
})

ipcMain.handle('etz:getActiveBuildInfo', async (_, label: string) => {
  return getActiveBuildInfo(label)
})

ipcMain.handle('etz:getBuildOutput', async (_, label: string, type?: string) => {
  return getBuildOutput(label, type)
})

ipcMain.handle('etz:killBuild', async (_, label: string, type: string) => {
  return killBuild(label, type)
})

ipcMain.handle('etz:openTerminal', async (_, path: string, terminal: 'default' | 'iterm' | 'warp' | 'alacritty') => {
  const { spawn } = require('child_process')

  let command: string
  let args: string[]

  switch (terminal) {
    case 'iterm':
      command = 'open'
      args = ['-a', 'iTerm', path]
      break
    case 'warp':
      command = 'open'
      args = ['-a', 'Warp', path]
      break
    case 'alacritty':
      command = 'alacritty'
      args = ['--working-directory', path]
      break
    case 'default':
    default:
      command = 'open'
      args = ['-a', 'Terminal', path]
      break
  }

  try {
    spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    }).unref()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('etz:getBranches', async (_, repoName?: string) => {
  try {
    const branches = await getBranches(repoName)
    return branches
  } catch (error: any) {
    console.error('Error getting branches:', error)
    return []
  }
})

ipcMain.handle('etz:getInstalledApps', async () => {
  const { execSync } = require('child_process')
  const fs = require('fs')
  const path = require('path')

  interface AppInfo {
    id: string
    name: string
    path: string
    version?: string
  }

  const installedApps = {
    terminals: [] as AppInfo[],
    editors: [] as AppInfo[]
  }

  // Always include default terminal
  installedApps.terminals.push({ id: 'default', name: 'Default Terminal', path: '' })

  // Check for terminals
  const terminals = [
    { id: 'iterm', name: 'iTerm', path: '/Applications/iTerm.app' },
    { id: 'warp', name: 'Warp', path: '/Applications/Warp.app' },
    { id: 'alacritty', name: 'Alacritty', path: '/Applications/Alacritty.app' }
  ]

  for (const terminal of terminals) {
    try {
      if (fs.existsSync(terminal.path)) {
        installedApps.terminals.push({ id: terminal.id, name: terminal.name, path: terminal.path })
      }
    } catch (error) {
      // App not found, skip
    }
  }

  // Check for editors
  const editors = [
    { id: 'vscode', name: 'VS Code', path: '/Applications/Visual Studio Code.app' },
    { id: 'cursor', name: 'Cursor', path: '/Applications/Cursor.app' },
    { id: 'sublime', name: 'Sublime Text', path: '/Applications/Sublime Text.app' },
    { id: 'webstorm', name: 'WebStorm', path: '/Applications/WebStorm.app' },
    { id: 'intellij', name: 'IntelliJ IDEA', path: '/Applications/IntelliJ IDEA.app' },
    { id: 'android-studio', name: 'Android Studio', path: '/Applications/Android Studio.app' },
    { id: 'pycharm', name: 'PyCharm', path: '/Applications/PyCharm.app' },
    { id: 'phpstorm', name: 'PhpStorm', path: '/Applications/PhpStorm.app' },
    { id: 'goland', name: 'GoLand', path: '/Applications/GoLand.app' },
    { id: 'rider', name: 'Rider', path: '/Applications/Rider.app' },
    { id: 'clion', name: 'CLion', path: '/Applications/CLion.app' },
    { id: 'rubymine', name: 'RubyMine', path: '/Applications/RubyMine.app' }
  ]

  for (const editor of editors) {
    try {
      if (fs.existsSync(editor.path)) {
        installedApps.editors.push({ id: editor.id, name: editor.name, path: editor.path })
      }
    } catch (error) {
      // App not found, skip
    }
  }

  // Check for Xcode installations (including multiple versions)
  try {
    // Check default Xcode location
    if (fs.existsSync('/Applications/Xcode.app')) {
      try {
        const infoPlistPath = '/Applications/Xcode.app/Contents/Info.plist'
        const version = execSync(`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${infoPlistPath}"`, { encoding: 'utf8' }).trim()
        installedApps.editors.push({
          id: 'xcode',
          name: `Xcode ${version}`,
          path: '/Applications/Xcode.app',
          version
        })
      } catch (error) {
        // Fallback if version can't be read
        installedApps.editors.push({
          id: 'xcode',
          name: 'Xcode',
          path: '/Applications/Xcode.app'
        })
      }
    }

    // Check for other Xcode installations (e.g., Xcode 16.app, Xcode 26.app, etc.)
    const applicationsDir = '/Applications'
    const files = fs.readdirSync(applicationsDir)

    for (const file of files) {
      // Match patterns like "Xcode 16.app", "Xcode-16.app", "Xcode_16.app", etc.
      if (file.match(/^Xcode[\s\-_]\d+.*\.app$/i) && file !== 'Xcode.app') {
        const fullPath = path.join(applicationsDir, file)
        try {
          const infoPlistPath = path.join(fullPath, 'Contents/Info.plist')
          if (fs.existsSync(infoPlistPath)) {
            try {
              const version = execSync(`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${infoPlistPath}"`, { encoding: 'utf8' }).trim()
              const displayName = file.replace('.app', '')
              installedApps.editors.push({
                id: `xcode-${version}`,
                name: `${displayName} (${version})`,
                path: fullPath,
                version
              })
            } catch (error) {
              // Fallback if version can't be read
              const displayName = file.replace('.app', '')
              installedApps.editors.push({
                id: `xcode-${file}`,
                name: displayName,
                path: fullPath
              })
            }
          }
        } catch (error) {
          // Skip if can't read this Xcode
        }
      }
    }
  } catch (error) {
    console.error('Error detecting Xcode installations:', error)
  }

  return installedApps
})

// Config Management IPC Handlers
ipcMain.handle('etz:config:get', async () => {
  try {
    return await getConfig()
  } catch (error: any) {
    console.error('Error getting config:', error)
    return getDefaultConfig()
  }
})

ipcMain.handle('etz:config:save', async (_, config: EtzConfig) => {
  try {
    await saveConfig(config)
    return { success: true }
  } catch (error: any) {
    console.error('Error saving config:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('etz:config:isFirstTime', async () => {
  try {
    return await isFirstTime()
  } catch (error: any) {
    console.error('Error checking first time:', error)
    return true
  }
})

ipcMain.handle('etz:config:reset', async () => {
  try {
    await resetConfig()
    return { success: true }
  } catch (error: any) {
    console.error('Error resetting config:', error)
    return { success: false, error: error.message }
  }
})

// Directory selector for setup wizard
ipcMain.handle('etz:selectDirectory', async () => {
  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Directory',
    buttonLabel: 'Select',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})
