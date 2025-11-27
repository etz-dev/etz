// Global TypeScript declarations for window.etz
declare global {
  interface Window {
    etz: {
      list: () => Promise<any[]>
      detectRepoType: (repoPath: string, repoName: string) => Promise<'ios' | 'android' | 'infra' | 'unknown'>
      switch: (label: string, repos: Record<string, string>, defaultBranch?: string, baseBranchOverrides?: Record<string, string>) => Promise<any>
      clean: (label: string, deleteBranches?: boolean) => Promise<any>
      open: (label: string, repo: string) => Promise<any>
      doctor: () => Promise<{ success: boolean; output: string; stderr?: string; error?: string }>
      checkInstalled: () => Promise<{ installed: boolean }>
      installViaPip: () => Promise<{ success: boolean; output?: string; stderr?: string; error?: string }>

      // Build functions
      checkBuildPreConditions: (label: string, platform: 'ios' | 'android', repo: string) => Promise<any>
      runPodInstall: (label: string) => Promise<{ success: boolean; output: string; error?: string }>
      buildInfraIOS: (label: string) => Promise<{ success: boolean; output: string; error?: string }>
      buildIOS: (label: string) => Promise<any>
      buildAndroid: (label: string) => Promise<any>
      onBuildProgress: (callback: (progress: any) => void) => void
      offBuildProgress: () => void

      // Build status functions
      isBuildInProgress: (label: string, type?: string) => Promise<boolean>
      getActiveBuildInfo: (label: string) => Promise<{ type: string; duration: number } | null>
      killBuild: (label: string, type: string) => Promise<boolean>

      // Terminal function
      openTerminal: (path: string, terminal: 'default' | 'iterm' | 'warp' | 'alacritty') => Promise<{ success: boolean; error?: string }>

      // Get installed applications
      getInstalledApps: () => Promise<{ terminals: string[]; editors: string[] }>

      // Get branches
      getBranches: (repoName?: string) => Promise<string[]>

      // Setup wizard - directory selector
      selectDirectory: () => Promise<string | null>

      // Config management
      config: {
        get: () => Promise<EtzConfig>
        save: (config: EtzConfig) => Promise<{ success: boolean; error?: string }>
        isFirstTime: () => Promise<boolean>
        reset: () => Promise<{ success: boolean; error?: string }>
      }
    }
  }

  // Config types
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
}

export { }
