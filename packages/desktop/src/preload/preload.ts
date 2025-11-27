import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('etz', {
  list: () => ipcRenderer.invoke('etz:list'),
  detectRepoType: (repoPath: string, repoName: string) =>
    ipcRenderer.invoke('etz:detectRepoType', repoPath, repoName),
  switch: (label: string, repos: Record<string, string>, defaultBranch?: string, baseBranchOverrides?: Record<string, string>) =>
    ipcRenderer.invoke('etz:switch', label, repos, defaultBranch, baseBranchOverrides),
  clean: (label: string) => ipcRenderer.invoke('etz:clean', label),
  open: (label: string, repo: string) => ipcRenderer.invoke('etz:open', label, repo),
  doctor: () => ipcRenderer.invoke('etz:doctor'),
  checkInstalled: () => ipcRenderer.invoke('etz:checkInstalled'),
  installViaPip: () => ipcRenderer.invoke('etz:installViaPip'),

  // Build functions
  checkBuildPreConditions: (label: string, platform: 'ios' | 'android', repo: string) =>
    ipcRenderer.invoke('etz:checkBuildPreConditions', label, platform, repo),
  runPodInstall: (label: string) =>
    ipcRenderer.invoke('etz:runPodInstall', label),
  buildInfraIOS: (label: string) =>
    ipcRenderer.invoke('etz:buildInfraIOS', label),
  buildIOS: (label: string) =>
    ipcRenderer.invoke('etz:buildIOS', label),
  buildAndroid: (label: string) =>
    ipcRenderer.invoke('etz:buildAndroid', label),

  // Listen for build progress events
  onBuildProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('build:progress', (_event, progress) => callback(progress))
  },
  offBuildProgress: () => {
    ipcRenderer.removeAllListeners('build:progress')
  },

  // Build status functions
  isBuildInProgress: (label: string, type?: string) =>
    ipcRenderer.invoke('etz:isBuildInProgress', label, type),
  getActiveBuildInfo: (label: string) =>
    ipcRenderer.invoke('etz:getActiveBuildInfo', label),
  getBuildOutput: (label: string, type?: string) =>
    ipcRenderer.invoke('etz:getBuildOutput', label, type),
  killBuild: (label: string, type: string) =>
    ipcRenderer.invoke('etz:killBuild', label, type),

  // Terminal function
  openTerminal: (path: string, terminal: 'default' | 'iterm' | 'warp' | 'alacritty') =>
    ipcRenderer.invoke('etz:openTerminal', path, terminal),

  // Get installed applications
  getInstalledApps: () =>
    ipcRenderer.invoke('etz:getInstalledApps'),

  // Get branches
  getBranches: (repoName?: string) =>
    ipcRenderer.invoke('etz:getBranches', repoName),

  // Setup wizard - directory selector
  selectDirectory: () =>
    ipcRenderer.invoke('etz:selectDirectory'),

  // Config management
  config: {
    get: () => ipcRenderer.invoke('etz:config:get'),
    save: (config: any) => ipcRenderer.invoke('etz:config:save', config),
    isFirstTime: () => ipcRenderer.invoke('etz:config:isFirstTime'),
    reset: () => ipcRenderer.invoke('etz:config:reset'),
  },
})
