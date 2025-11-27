import { useState, useEffect } from 'react'
import './App.css'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  RefreshCw,
  Settings,
  Terminal,
  Trash2,
  GitBranch,
  Hammer,
  CheckCircle2,
  AlertCircle,
  TreePine,
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  Sun,
  Moon,
  FolderOpen,
  Menu,
  LayoutDashboard,
  Play,
  X,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SettingsDialog } from '@/components/SettingsDialog'
import { BuildPanel } from '@/components/BuildPanel'
import { CreateWorktreeDialog } from '@/components/CreateWorktreeDialog'
import { SetupWizard, SetupConfig } from '@/components/SetupWizard'

interface Repo {
  name: string
  branch: string
  clean: boolean
  uncommitted: number
  path?: string
  exists: boolean
}

interface Worktree {
  label: string
  repos: Repo[]
}

type ViewMode = 'list' | 'grid'
type StatusFilter = 'all' | 'clean' | 'modified'
type LayoutMode = '1-col' | '2-col' | 'auto'
type TerminalApp = 'default' | 'iterm' | 'warp' | 'alacritty'
type EditorApp = 'vscode' | 'cursor' | 'sublime' | 'webstorm'

export default function App() {
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedWorktree, setExpandedWorktree] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showNewWorktreeDialog, setShowNewWorktreeDialog] = useState(false)
  const [isCreatingWorktree, setIsCreatingWorktree] = useState(false)
  const [creatingWorktreeLabel, setCreatingWorktreeLabel] = useState<string | null>(null)
  const [deletingWorktrees, setDeletingWorktrees] = useState<Set<string>>(new Set())
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('auto')
  const [terminalPreference, setTerminalPreference] = useState<TerminalApp>('default')
  const [editorPreference, setEditorPreference] = useState<EditorApp>('vscode')
  const [worktreeToDelete, setWorktreeToDelete] = useState<string | null>(null)
  const [deleteLocalBranches, setDeleteLocalBranches] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'settings'>('dashboard')

  // Build dialog state
  const [buildDialogOpen, setBuildDialogOpen] = useState(false)
  const [buildDialogData, setBuildDialogData] = useState<{
    label: string
    platform: 'ios' | 'android'
    repo: string
    repoPath?: string
  } | null>(null)

  // Active builds state - maps label to build info
  const [activeBuilds, setActiveBuilds] = useState<Map<string, { type: string; duration: number }>>(new Map())

  // Setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)

  // Config state - repositories loaded from config
  const [configuredRepos, setConfiguredRepos] = useState<Array<{ name: string }>>([])

  // Repo type cache - maps "worktreeLabel:repoName" to detected type
  const [repoTypes, setRepoTypes] = useState<Map<string, 'ios' | 'android' | 'infra' | 'unknown'>>(new Map())

  // Load config - used both on mount and when config changes
  const loadConfig = async () => {
    try {
      const config = await window.etz.config.get()
      setConfiguredRepos(config.repositories.map(repo => ({ name: repo.name })))

      // Load UI preferences from config
      if (config.ui) {
        setTheme(config.ui.theme)
        setLayoutMode(config.ui.layoutMode)
        setTerminalPreference(config.ui.terminalPreference as TerminalApp)
        setEditorPreference(config.ui.editorPreference as EditorApp)
      }
    } catch (error) {
      console.error('Error loading config:', error)
      setConfiguredRepos([])
    }
  }

  // Handle theme change and save to config
  const handleThemeChange = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)

    try {
      const config = await window.etz.config.get()
      config.ui.theme = newTheme
      await window.etz.config.save(config)
    } catch (error) {
      console.error('Error saving theme preference:', error)
    }
  }

  // Check if first time on mount
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const isFirst = await window.etz.config.isFirstTime()
        setShowSetupWizard(isFirst)
        setSetupComplete(!isFirst)

        // Load config if not first time
        if (!isFirst) {
          await loadConfig()
        }
      } catch (error) {
        console.error('Error checking first time:', error)
        // If error, assume not first time to avoid blocking the app
        setSetupComplete(true)
        await loadConfig()
      }
    }

    checkFirstTime()
  }, [])

  useEffect(() => {
    if (setupComplete) {
      loadWorktrees()
    }
  }, [setupComplete])

  useEffect(() => {
    // Poll for active builds every 2 seconds
    const pollInterval = setInterval(async () => {
      if (worktrees.length === 0) return // Don't poll if no worktrees yet

      const newActiveBuilds = new Map<string, { type: string; duration: number }>()

      // Check each worktree for active builds
      for (const worktree of worktrees) {
        try {
          const buildInfo = await window.etz.getActiveBuildInfo(worktree.label)
          if (buildInfo) {
            newActiveBuilds.set(worktree.label, buildInfo)
          }
        } catch (error) {
          // Ignore errors for individual worktrees
        }
      }

      setActiveBuilds(newActiveBuilds)
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [worktrees])

  useEffect(() => {
    // Apply dark mode class to document element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Dev mode keyboard shortcut (Cmd+Shift+R) is now handled in main process
  // See desktop-app/src/main/main.ts for the globalShortcut registration

  const loadWorktrees = async () => {
    try {
      const data = await window.etz.list()
      // Filter out any worktrees that are currently being created
      // This prevents showing incomplete worktrees when other operations trigger a refresh
      const filteredData = creatingWorktreeLabel
        ? data.filter(wt => wt.label !== creatingWorktreeLabel)
        : data
      // Sort worktrees alphabetically by label
      const sortedData = filteredData.sort((a, b) => a.label.localeCompare(b.label))
      setWorktrees(sortedData)

      // Detect repo types for all repos in all worktrees
      const newRepoTypes = new Map<string, 'ios' | 'android' | 'infra' | 'unknown'>()

      for (const worktree of sortedData) {
        for (const repo of worktree.repos) {
          if (repo.path && repo.exists) {
            const cacheKey = `${worktree.label}:${repo.name}`
            // Check if we already have this cached
            if (!repoTypes.has(cacheKey)) {
              try {
                const detectedType = await window.etz.detectRepoType(repo.path, repo.name)
                newRepoTypes.set(cacheKey, detectedType)
              } catch (error) {
                console.error(`Failed to detect type for ${repo.name}:`, error)
                newRepoTypes.set(cacheKey, 'unknown')
              }
            } else {
              // Keep existing cache
              newRepoTypes.set(cacheKey, repoTypes.get(cacheKey)!)
            }
          }
        }
      }

      setRepoTypes(newRepoTypes)
    } catch (error) {
      console.error('Failed to load worktrees:', error)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadWorktrees()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  const handleClean = (label: string) => {
    setWorktreeToDelete(label)
    setDeleteLocalBranches(false) // Reset checkbox when opening dialog
  }

  const confirmClean = async () => {
    if (!worktreeToDelete) return
    const label = worktreeToDelete
    setWorktreeToDelete(null)

    // Add to deleting set
    setDeletingWorktrees(prev => new Set(prev).add(label))

    try {
      const result = await window.etz.clean(label, deleteLocalBranches)
      console.log('Clean result:', result)

      if (result.success) {
        await loadWorktrees()
      } else {
        const errorMsg = result.error || result.output || 'Unknown error'
        console.error('Failed to clean worktree:', errorMsg)
        alert(`Failed to clean worktree: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Failed to clean worktree:', error)
      alert(`Failed to clean worktree: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      // Remove from deleting set
      setDeletingWorktrees(prev => {
        const next = new Set(prev)
        next.delete(label)
        return next
      })
    }
  }

  const handleOpenTerminal = async (label: string, repo: string) => {
    const worktree = worktrees.find(wt => wt.label === label)
    const repoData = worktree?.repos.find(r => r.name === repo)

    if (repoData?.path) {
      try {
        await window.etz.openTerminal(repoData.path, terminalPreference)
      } catch (error) {
        console.error('Failed to open terminal:', error)
      }
    }
  }

  const handleOpenEditor = async (label: string, repo: string) => {
    try {
      await window.etz.open(label, repo)
    } catch (error) {
      console.error('Failed to open editor:', error)
    }
  }

  const handleBuild = (label: string, platform: 'ios' | 'android', repo: string, repoPath?: string) => {
    setBuildDialogData({ label, platform, repo, repoPath })
    setBuildDialogOpen(true)
  }

  const handleSetupComplete = async (setupConfig: SetupConfig) => {
    try {
      const config = await window.etz.config.get()

      // Update config with setup data
      config.workspace.baseDirectory = setupConfig.workspaceDirectory
      config.repositories = setupConfig.repositories.map(repo => ({
        id: `repo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: repo.name,
        sourceType: 'local' as const,
        path: repo.path,
        enabledByDefault: true,
        baseBranch: repo.baseBranch, // Include base branch from setup
      }))
      config.setupComplete = true

      // Save config
      const result = await window.etz.config.save(config)

      if (result.success) {
        setSetupComplete(true)
        setShowSetupWizard(false)
        // Load config to populate configuredRepos
        await loadConfig()
      } else {
        console.error('Failed to save config:', result.error)
        alert('Failed to save configuration. Please try again.')
      }
    } catch (error) {
      console.error('Error completing setup:', error)
      alert('An error occurred during setup. Please try again.')
    }
  }

  // Handler for when settings are changed
  const handleConfigChange = async () => {
    await loadConfig()
  }

  // Filter worktrees
  const filteredWorktrees = worktrees.filter(wt => {
    const matchesSearch = wt.label.toLowerCase().includes(searchQuery.toLowerCase())

    if (statusFilter === 'all') return matchesSearch
    if (statusFilter === 'clean') return matchesSearch && wt.repos.every(r => r.clean)
    if (statusFilter === 'modified') return matchesSearch && wt.repos.some(r => !r.clean)

    return matchesSearch
  })

  const stats = {
    total: worktrees.length,
    filtered: filteredWorktrees.length,
    clean: filteredWorktrees.filter(wt => wt.repos.every(r => r.clean)).length,
    modified: filteredWorktrees.filter(wt => wt.repos.some(r => !r.clean)).length,
  }

  return (
    <>
      {/* Setup Wizard - shown on first launch */}
      {showSetupWizard && (
        <SetupWizard
          open={showSetupWizard}
          onComplete={handleSetupComplete}
          theme={theme}
        />
      )}

      {/* Main App - shown after setup is complete */}
      {setupComplete && (
        <div className={`h-screen flex overflow-hidden ${theme === 'dark' ? 'dark bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'}`}>
          {/* Sidebar */}
      <aside
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'
          } transition-all duration-300 ease-in-out border-r ${theme === 'dark'
            ? 'bg-slate-900/95 border-slate-800/50 backdrop-blur-xl'
            : 'bg-white/95 border-slate-200 backdrop-blur-xl shadow-sm'
          } flex flex-col`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Sidebar Header */}
        <div className={`pt-12 px-4 pb-4 border-b ${theme === 'dark' ? 'border-slate-800/50' : 'border-slate-200/60'}`} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 blur-xl opacity-20 rounded-full"></div>
                  <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-xl shadow-2xl shadow-emerald-500/20">
                    <TreePine className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <h1 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Etz
                  </h1>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`${sidebarCollapsed ? 'mx-auto' : ''} ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage('dashboard')}
            className={`w-full justify-start gap-3 mb-2 ${currentPage === 'dashboard'
              ? theme === 'dark'
                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800'
              : theme === 'dark'
                ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            title={sidebarCollapsed ? 'Dashboard' : undefined}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Button>
        </nav>

        {/* Bottom Section - Settings */}
        <div className={`p-3 border-t ${theme === 'dark' ? 'border-slate-800/50' : 'border-slate-200/60'}`} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage('settings')}
            className={`w-full justify-start gap-3 ${currentPage === 'settings'
              ? theme === 'dark'
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-slate-100'
                : 'bg-slate-100 text-slate-900 hover:bg-slate-200 hover:text-slate-950'
              : theme === 'dark'
                ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            title={sidebarCollapsed ? 'Settings' : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentPage === 'dashboard' ? (
          <>
            {/* Header */}
            <header className={`border-b sticky top-0 z-40 backdrop-blur-xl ${theme === 'dark' ? 'border-slate-800/50 bg-slate-900/50' : 'border-slate-200 bg-white/80 shadow-sm'}`} style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
              <div className="px-8 pt-8 pb-6">
                <div className="flex items-center justify-between flex-wrap gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent' : 'text-slate-900'}`}>
                      Worktrees
                    </h2>
                    <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Manage your git worktrees across multiple repositories</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className={theme === 'dark' ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600 text-slate-300' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>

                    <Button
                      onClick={() => setShowNewWorktreeDialog(true)}
                      disabled={isCreatingWorktree}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 border-0"
                    >
                      {isCreatingWorktree ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          New Worktree
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleThemeChange}
                      className={theme === 'dark' ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-8 py-8 overflow-auto">
              {/* Stats + Controls Bar */}
              <div className="flex flex-col gap-4 mb-6">
                {/* Top row: Stats */}
                <div className="flex items-center gap-4 flex-wrap">
                  <StatsBadge
                    icon={TreePine}
                    label="Worktrees"
                    value={stats.filtered}
                    total={stats.total}
                    theme={theme}
                  />
                  <StatsBadge
                    icon={CheckCircle2}
                    label="Clean"
                    value={stats.clean}
                    color="text-green-400"
                    theme={theme}
                  />
                  <StatsBadge
                    icon={AlertCircle}
                    label="Modified"
                    value={stats.modified}
                    color="text-amber-400"
                    theme={theme}
                  />
                </div>

                {/* Bottom row: Search + Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <Input
                      placeholder="Search worktrees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={theme === 'dark' ? 'pl-10 w-full bg-slate-800/50 border-slate-700 text-slate-300 placeholder:text-slate-500' : 'pl-10 w-full bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'}
                    />
                  </div>

                  {/* Filter */}
                  <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger className={theme === 'dark' ? 'w-32 bg-slate-800/50 border-slate-700 text-slate-300' : 'w-32 bg-white border-slate-300 text-slate-900'}>
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="clean">Clean</SelectItem>
                      <SelectItem value="modified">Modified</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Toggle */}
                  <div className={`flex items-center gap-1 rounded-lg p-1 border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewMode('list')}
                      className={`h-8 w-8 ${viewMode === 'list' ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-900')}`}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewMode('grid')}
                      className={`h-8 w-8 ${viewMode === 'grid' ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-900')}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Worktree Display */}
              {filteredWorktrees.length === 0 ? (
                <Card className={theme === 'dark' ? 'bg-slate-900/50 border-slate-800/50 p-12 text-center' : 'bg-white border-slate-200 shadow-sm p-12 text-center'}>
                  <TreePine className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}`} />
                  <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>No worktrees found</h3>
                  <p className={`mb-6 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Create your first worktree to get started'}
                  </p>
                  {!searchQuery && statusFilter === 'all' && (
                    <Button
                      onClick={() => setShowNewWorktreeDialog(true)}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Worktree
                    </Button>
                  )}
                </Card>
              ) : viewMode === 'list' ? (
                <CompactListView
                  worktrees={filteredWorktrees}
                  expandedWorktree={expandedWorktree}
                  setExpandedWorktree={setExpandedWorktree}
                  onClean={handleClean}
                  onOpenTerminal={handleOpenTerminal}
                  onOpenEditor={handleOpenEditor}
                  onBuild={handleBuild}
                  theme={theme}
                  deletingWorktrees={deletingWorktrees}
                  creatingWorktreeLabel={creatingWorktreeLabel}
                  terminalPreference={terminalPreference}
                  activeBuilds={activeBuilds}
                  repoTypes={repoTypes}
                />
              ) : (
                <GridView
                  worktrees={filteredWorktrees}
                  onClean={handleClean}
                  onOpenTerminal={handleOpenTerminal}
                  onOpenEditor={handleOpenEditor}
                  onBuild={handleBuild}
                  theme={theme}
                  deletingWorktrees={deletingWorktrees}
                  creatingWorktreeLabel={creatingWorktreeLabel}
                  repoTypes={repoTypes}
                />
              )}
            </main>
          </>
        ) : (
          /* Settings Page */
          <div className="flex-1 overflow-auto">
            <header className={`border-b sticky top-0 z-40 backdrop-blur-xl ${theme === 'dark' ? 'border-slate-800/50 bg-slate-900/50' : 'border-slate-200 bg-white/80 shadow-sm'}`} style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
              <div className="px-8 pt-8 pb-6">
                <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                  <h2 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent' : 'text-slate-900'}`}>
                    Settings
                  </h2>
                  <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Configure your preferences and application settings</p>
                </div>
              </div>
            </header>
            <main className="px-8 py-8">
              <SettingsDialog
                open={true}
                onOpenChange={() => { }} // Keep settings page open
                theme={theme}
                onThemeChange={handleThemeChange}
                layoutMode={layoutMode}
                onLayoutChange={() => {
                  const modes: LayoutMode[] = ['1-col', '2-col', 'auto']
                  const currentIndex = modes.indexOf(layoutMode)
                  setLayoutMode(modes[(currentIndex + 1) % modes.length])
                }}
                terminalPreference={terminalPreference}
                onTerminalChange={setTerminalPreference}
                editorPreference={editorPreference}
                onEditorChange={setEditorPreference}
                embedded={true}
                onConfigChange={handleConfigChange}
              />
            </main>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateWorktreeDialog
        open={showNewWorktreeDialog}
        onClose={() => setShowNewWorktreeDialog(false)}
        onSuccess={loadWorktrees}
        theme={theme}
        onCreatingChange={(creating, label) => {
          setIsCreatingWorktree(creating)
          setCreatingWorktreeLabel(creating ? label : null)
        }}
        existingWorktrees={worktrees.map(w => w.label)}
        repos={configuredRepos}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!worktreeToDelete} onOpenChange={(open) => !open && setWorktreeToDelete(null)}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Delete Worktree</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p>
              Are you sure you want to delete the worktree <span className="font-bold text-emerald-500">{worktreeToDelete}</span>?
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              This action cannot be undone. It will remove the worktree directory and all its contents.
            </p>

            {/* Check for uncommitted changes */}
            {worktreeToDelete && worktrees.find(wt => wt.label === worktreeToDelete)?.repos.some(r => !r.clean) && (
              <div className={`p-3 rounded-md border ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Warning: Uncommitted Changes
                </div>
                <p className="text-sm opacity-90">
                  This worktree has uncommitted changes. Deleting will permanently lose these changes.
                </p>
              </div>
            )}

            {/* Build in progress warning */}
            {worktreeToDelete && activeBuilds.has(worktreeToDelete) && (
              <div className={`p-3 rounded-md border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Warning: Build in Progress
                </div>
                <p className="text-sm opacity-90">
                  Deleting this worktree will stop the active build immediately.
                </p>
              </div>
            )}

            {/* Delete local branches checkbox */}
            <div className={`flex items-start gap-3 p-3 rounded-md border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Checkbox
                id="delete-branches"
                checked={deleteLocalBranches}
                onChange={(e) => setDeleteLocalBranches(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="delete-branches"
                  className={`text-sm font-medium cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}
                >
                  Also force delete local branches
                </Label>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  This will force delete (git branch -D) the local git branches for all repositories in this worktree, even if unmerged. Remote branches are not affected.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setWorktreeToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmClean}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Worktree
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {buildDialogOpen && buildDialogData && (
        <BuildPanel
          open={buildDialogOpen}
          onClose={() => {
            setBuildDialogOpen(false)
            setBuildDialogData(null)
          }}
          label={buildDialogData.label}
          platform={buildDialogData.platform}
          repo={buildDialogData.repo}
          repoPath={buildDialogData.repoPath}
          onOpenTerminal={(path: string) => window.etz.openTerminal(path, terminalPreference)}
          onOpen={() => handleOpenEditor(buildDialogData.label, buildDialogData.repo)}
          theme={theme}
        />
      )}
        </div>
      )}
    </>
  )
}

function StatsBadge({
  icon: Icon,
  label,
  value,
  total,
  color = "text-slate-300",
  theme = 'dark'
}: {
  icon: any
  label: string
  value: number
  total?: number
  color?: string
  theme?: 'light' | 'dark'
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{label}:</span>
      <span className={`text-sm font-semibold ${color}`}>
        {value}{total && `/${total}`}
      </span>
    </div>
  )
}

interface CompactListViewProps {
  worktrees: Worktree[]
  expandedWorktree: string | null
  setExpandedWorktree: (label: string | null) => void
  onClean: (label: string) => void
  onOpenTerminal: (label: string, repo: string) => void
  onOpenEditor: (label: string, repo: string) => void
  onBuild: (label: string, platform: 'ios' | 'android', repo: string, repoPath?: string) => void
  theme: 'light' | 'dark'
  deletingWorktrees: Set<string>
  creatingWorktreeLabel: string | null
  terminalPreference: TerminalApp
  activeBuilds: Map<string, { type: string; duration: number }>
  repoTypes: Map<string, 'ios' | 'android' | 'infra' | 'unknown'>
}

function CompactListView({
  worktrees,
  expandedWorktree,
  setExpandedWorktree,
  onClean,
  onOpenTerminal,
  onOpenEditor,
  onBuild,
  theme,
  deletingWorktrees,
  creatingWorktreeLabel,
  activeBuilds,
  terminalPreference,
  repoTypes,
}: CompactListViewProps) {
  return (
    <Card className={theme === 'dark' ? 'bg-slate-900/50 border-slate-800/50 overflow-hidden' : 'bg-white border-slate-200 shadow-sm overflow-hidden'}>
      {/* Table Header */}
      <div className={`grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-medium ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800/50 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        <div className="col-span-6">Worktree</div>
        <div className="col-span-3">Status</div>
        <div className="col-span-2">Repositories</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* Worktree Rows */}
      <div className={theme === 'dark' ? 'divide-y divide-slate-800/30' : 'divide-y divide-slate-100'}>
        {(() => {
          // Create a combined list with optimistic loading row inserted alphabetically
          const allRows = [...worktrees]

          if (creatingWorktreeLabel) {
            // Only add optimistic row if worktree doesn't already exist
            const worktreeExists = allRows.some(w => w.label === creatingWorktreeLabel)

            if (!worktreeExists) {
              // Find the correct alphabetical position
              const insertIndex = allRows.findIndex(w => w.label.localeCompare(creatingWorktreeLabel) > 0)
              const optimisticRow = {
                label: creatingWorktreeLabel,
                isOptimistic: true
              }

              if (insertIndex === -1) {
                // Add at the end if it's alphabetically last
                allRows.push(optimisticRow as any)
              } else {
                // Insert at the correct position
                allRows.splice(insertIndex, 0, optimisticRow as any)
              }
            }
          }

          return allRows.map((item: any) => {
            if (item.isOptimistic) {
              // Render optimistic loading row
              return (
                <div
                  key={`optimistic-${item.label}`}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 opacity-60 ${theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'
                    }`}
                >
                  {/* Worktree Name - matches regular row structure */}
                  <div className="col-span-6 flex items-center gap-3">
                    <div className={`h-6 w-6 flex items-center justify-center ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    </div>
                    <TreePine className="w-4 h-4 text-emerald-500 opacity-50" />
                    <span className={`text-sm font-mono font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                      {item.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full bg-slate-400 animate-pulse`}></div>
                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                      Creating...
                    </span>
                  </div>

                  {/* Repositories */}
                  <div className="col-span-2 flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full bg-slate-400 animate-pulse`}></div>
                    <div className={`h-2 w-2 rounded-full bg-slate-400 animate-pulse delay-75`}></div>
                    <div className={`h-2 w-2 rounded-full bg-slate-400 animate-pulse delay-150`}></div>
                  </div>

                  {/* Actions - Disabled */}
                  <div className="col-span-1 flex justify-end gap-2 opacity-30">
                    <Button size="sm" variant="ghost" disabled>
                      <Terminal className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            } else {
              // Render normal worktree row
              return (
                <WorktreeRow
                  key={item.label}
                  worktree={item}
                  isExpanded={expandedWorktree === item.label}
                  onToggle={() => setExpandedWorktree(
                    expandedWorktree === item.label ? null : item.label
                  )}
                  onClean={onClean}
                  onOpenTerminal={onOpenTerminal}
                  onOpenEditor={onOpenEditor}
                  onBuild={onBuild}
                  theme={theme}
                  isDeleting={deletingWorktrees.has(item.label)}
                  isCreating={creatingWorktreeLabel === item.label}
                  terminalPreference={terminalPreference}
                  buildInfo={activeBuilds.get(item.label)}
                  repoTypes={repoTypes}
                />
              )
            }
          })
        })()}
      </div>
    </Card>
  )
}

interface WorktreeRowProps {
  worktree: Worktree
  isExpanded: boolean
  onToggle: () => void
  onClean: (label: string) => void
  onOpenTerminal: (label: string, repo: string) => void
  onOpenEditor: (label: string, repo: string) => void
  onBuild: (label: string, platform: 'ios' | 'android', repo: string, repoPath?: string) => void
  theme: 'light' | 'dark'
  isDeleting: boolean
  isCreating: boolean
  terminalPreference: TerminalApp
  buildInfo?: { type: string; duration: number }
  repoTypes: Map<string, 'ios' | 'android' | 'infra' | 'unknown'>
}

function WorktreeRow({
  worktree,
  isExpanded,
  onToggle,
  onClean,
  onOpenTerminal,
  onOpenEditor,
  onBuild,
  theme,
  isDeleting,
  isCreating,
  terminalPreference,
  buildInfo,
  repoTypes,
}: WorktreeRowProps) {
  const existingRepos = worktree.repos.filter(r => r.exists)
  const cleanCount = existingRepos.filter(r => r.clean).length
  const totalUncommitted = existingRepos.reduce((sum, r) => sum + r.uncommitted, 0)
  const missingCount = worktree.repos.filter(r => !r.exists).length

  return (
    <div>
      {/* Main Row */}
      <div
        className={`grid grid-cols-12 gap-4 px-6 py-4 transition-all duration-200 group cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-800/40 hover:shadow-lg hover:shadow-slate-900/20' : 'hover:bg-slate-50 hover:shadow-md'}`}
        onClick={onToggle}
      >
        <div className="col-span-6 flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={theme === 'dark' ? 'h-6 w-6 text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'h-6 w-6 text-slate-400 hover:text-slate-700 hover:bg-slate-100'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          <TreePine className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span
            className={`text-sm font-mono font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}
            title={worktree.label}
          >
            {worktree.label}
            {isDeleting && <span className={`ml-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>(Deleting...)</span>}
          </span>
        </div>

        <div className="col-span-3 flex items-center gap-2">
          {buildInfo && (buildInfo.type === 'build_ios' || buildInfo.type === 'build_android' || buildInfo.type === 'pod_install' || buildInfo.type === 'build_infra_ios') ? (
            <Badge variant={null} className={`text-xs font-medium ${theme === 'dark' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse' : 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse'}`}>
              <Hammer className="w-3 h-3 mr-1" />
              {buildInfo.type.replace(/_/g, ' ')}
            </Badge>
          ) : isDeleting ? (
            <Badge variant={null} className={`text-xs font-medium ${theme === 'dark' ? 'bg-slate-700/50 text-slate-400 border-slate-600/30' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Deleting...
            </Badge>
          ) : isCreating ? (
            <Badge variant={null} className={`text-xs font-medium ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' : 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'}`}>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Creating...
            </Badge>
          ) : missingCount > 0 ? (
            <Badge variant={null} className={`text-xs font-medium ${theme === 'dark' ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30' : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'}`}>
              <AlertCircle className="w-3 h-3 mr-1" />
              {missingCount} {missingCount === 1 ? 'repo' : 'repos'} missing
            </Badge>
          ) : cleanCount === existingRepos.length ? (
            <Badge className={`text-xs font-medium ${theme === 'dark' ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30' : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'}`}>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              All Clean
            </Badge>
          ) : (
            <Badge variant={null} className={`text-xs font-medium ${theme === 'dark' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'}`}>
              <AlertCircle className="w-3 h-3 mr-1" />
              {totalUncommitted} {totalUncommitted === 1 ? 'change' : 'changes'}
            </Badge>
          )}
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <div className="flex items-center gap-1">
            {worktree.repos.map((repo) => (
              <div
                key={repo.name}
                className={`w-2 h-2 rounded-full ${!repo.exists ? 'bg-red-500' : repo.clean ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                title={`${repo.name}: ${!repo.exists ? 'missing' : repo.clean ? 'clean' : `${repo.uncommitted} uncommitted`}`}
              />
            ))}
          </div>
          <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {cleanCount}/{worktree.repos.length} clean
          </span>
        </div>

        <div className="col-span-1 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={async (e) => {
              e.stopPropagation();
              // Get parent directory from first repo's path
              const firstRepo = worktree.repos.find(r => r.path);
              if (firstRepo?.path) {
                const parentDir = firstRepo.path.substring(0, firstRepo.path.lastIndexOf('/'));
                try {
                  await window.etz.openTerminal(parentDir, terminalPreference);
                } catch (error) {
                  console.error('Failed to open terminal:', error);
                }
              }
            }}
            className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-700' : 'h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            title="Open terminal in worktree folder"
          >
            <Terminal className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onClean(worktree.label);
            }}
            disabled={isDeleting}
            className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-slate-100'}
            title="Clean worktree"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={theme === 'dark' ? 'px-6 pt-3 pb-4 bg-slate-800/20' : 'px-6 pt-3 pb-4 bg-slate-50'}>
          {/* Worktree folder path */}
          {worktree.repos.find(r => r.path) && (
            <div className={`flex items-center gap-2 text-xs ml-9 mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
              <FolderOpen className="w-3 h-3 flex-shrink-0" />
              <code className="font-mono truncate" title={worktree.repos.find(r => r.path)?.path?.substring(0, worktree.repos.find(r => r.path)?.path?.lastIndexOf('/'))}>
                {worktree.repos.find(r => r.path)?.path?.substring(0, worktree.repos.find(r => r.path)?.path?.lastIndexOf('/')).replace(/^\/Users\/[^/]+/, '~')}
              </code>
            </div>
          )}
          <div className="ml-9 space-y-2">
            {worktree.repos.map((repo) => {
              // Check if this specific repo is building
              // Use auto-detected repo types from cache
              const cacheKey = `${worktree.label}:${repo.name}`
              const detectedType = repoTypes.get(cacheKey) || 'unknown'
              const isIosRepo = detectedType === 'ios'
              const isAndroidRepo = detectedType === 'android'
              const isInfraRepo = detectedType === 'infra'

              const isRepoBuilding = buildInfo && (
                (buildInfo.type === 'build_ios' && isIosRepo) ||
                (buildInfo.type === 'build_android' && isAndroidRepo) ||
                (buildInfo.type === 'pod_install' && isIosRepo) ||
                (buildInfo.type === 'build_infra_ios' && isInfraRepo)
              )

              return (
                <div
                  key={repo.name}
                  className={`py-3 px-4 rounded-lg border transition-all duration-300 ${isRepoBuilding
                    ? theme === 'dark'
                      ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/10'
                      : 'bg-blue-50 border-blue-300 shadow-md'
                    : theme === 'dark'
                      ? 'bg-slate-800/30 border-slate-700/50'
                      : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Status indicator */}
                      {isRepoBuilding ? (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500 flex-shrink-0" />
                      ) : (
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!repo.exists ? 'bg-red-500' : repo.clean ? 'bg-green-500' : 'bg-amber-500'}`} />
                      )}

                      <span className={`text-sm font-medium flex-shrink-0 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>{repo.name}</span>

                      {/* Build status badge */}
                      {isRepoBuilding && (
                        <Badge variant={null} className={`text-xs font-medium animate-pulse flex-shrink-0 ${theme === 'dark' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                          <Hammer className="w-3 h-3 mr-1" />
                          {buildInfo.type === 'pod_install' ? 'Pod Install' :
                            buildInfo.type === 'build_infra_ios' ? 'Building Infra' :
                              buildInfo.type === 'build_ios' ? 'Building iOS' :
                                buildInfo.type === 'build_android' ? 'Building Android' :
                                  'Building'}
                        </Badge>
                      )}

                      {repo.exists ? (
                        <>
                          <div className={`flex items-center gap-1.5 text-xs min-w-0 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            <GitBranch className="w-3 h-3 flex-shrink-0" />
                            <code
                              className={`font-mono truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}
                              title={repo.branch}
                            >
                              {repo.branch}
                            </code>
                          </div>
                          {!repo.clean && !isRepoBuilding && (
                            <span
                              className={`text-xs flex-shrink-0 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}
                              title={`${repo.uncommitted} uncommitted ${repo.uncommitted === 1 ? 'change' : 'changes'}`}
                            >
                              {repo.uncommitted}
                            </span>
                          )}
                        </>
                      ) : (
                        <Badge variant={null} className={`text-xs flex-shrink-0 ${theme === 'dark' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-100 text-red-800 border-red-300'}`}>
                          Missing
                        </Badge>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      {repo.exists && (
                        <>
                          {(isIosRepo || isAndroidRepo) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onBuild(
                                worktree.label,
                                isIosRepo ? 'ios' : 'android',
                                repo.name,
                                repo.path
                              )}
                              className={`h-7 w-7 ${isRepoBuilding
                                ? theme === 'dark'
                                  ? 'text-blue-400 hover:text-blue-300 hover:bg-slate-700'
                                  : 'text-blue-600 hover:text-blue-700 hover:bg-slate-100'
                                : theme === 'dark'
                                  ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                              title={isRepoBuilding ? "View build" : "Build"}
                            >
                              <Hammer className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenEditor(worktree.label, repo.name)}
                            className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-700' : 'h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                            title="Open in editor"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenTerminal(worktree.label, repo.name)}
                            className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-700' : 'h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                            title="Open terminal"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Build progress bar - only show when this repo is building */}
                  {isRepoBuilding && buildInfo && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                          {buildInfo.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {Math.floor((buildInfo.duration / 60000))}:{String(Math.floor((buildInfo.duration % 60000) / 1000)).padStart(2, '0')}
                        </span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse"
                          style={{
                            width: '100%',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                          }}
                        />
                      </div>
                      <div className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        Build in progress...
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface GridViewProps {
  worktrees: Worktree[]
  onClean: (label: string) => void
  onOpenTerminal: (label: string, repo: string) => void
  onOpenEditor: (label: string, repo: string) => void
  onBuild: (label: string, platform: 'ios' | 'android', repo: string, repoPath?: string) => void
  theme: 'light' | 'dark'
  deletingWorktrees: Set<string>
  creatingWorktreeLabel: string | null
  repoTypes: Map<string, 'ios' | 'android' | 'infra' | 'unknown'>
}

function GridView({ worktrees, onClean, onOpenTerminal, onOpenEditor, onBuild, theme, deletingWorktrees, creatingWorktreeLabel, repoTypes }: GridViewProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
      {(() => {
        // Create a combined list with optimistic loading card inserted alphabetically
        const allItems = [...worktrees]

        if (creatingWorktreeLabel) {
          // Find the correct alphabetical position
          const insertIndex = allItems.findIndex(w => w.label.localeCompare(creatingWorktreeLabel) > 0)
          const optimisticItem = {
            label: creatingWorktreeLabel,
            isOptimistic: true
          }

          if (insertIndex === -1) {
            allItems.push(optimisticItem as any)
          } else {
            allItems.splice(insertIndex, 0, optimisticItem as any)
          }
        }

        return allItems.map((item: any) => {
          if (item.isOptimistic) {
            return (
              <Card
                key={`optimistic-${item.label}`}
                className={`p-6 opacity-60 ${theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700/50'
                  : 'bg-slate-50 border-slate-200'
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                    <div>
                      <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                        <TreePine className="w-4 h-4" />
                        {item.label}
                      </h3>
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                        Creating worktree...
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className={`h-8 rounded animate-pulse ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-200'
                    }`}></div>
                  <div className={`h-8 rounded animate-pulse delay-75 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-200'
                    }`}></div>
                  <div className={`h-8 rounded animate-pulse delay-150 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-200'
                    }`}></div>
                </div>

                <div className="flex gap-2 opacity-30">
                  <Button size="sm" variant="ghost" disabled className="flex-1">
                    <Terminal className="w-4 h-4 mr-2" />
                    Terminal
                  </Button>
                  <Button size="sm" variant="ghost" disabled>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )
          } else {
            return (
              <MiniWorktreeCard
                key={item.label}
                worktree={item}
                onClean={onClean}
                onOpenTerminal={onOpenTerminal}
                onOpenEditor={onOpenEditor}
                onBuild={onBuild}
                theme={theme}
                isDeleting={deletingWorktrees.has(item.label)}
                repoTypes={repoTypes}
              />
            )
          }
        })
      })()}
    </div>
  )
}

interface MiniWorktreeCardProps {
  worktree: Worktree
  onClean: (label: string) => void
  onOpenTerminal: (label: string, repo: string) => void
  onOpenEditor: (label: string, repo: string) => void
  onBuild: (label: string, platform: 'ios' | 'android', repo: string, repoPath?: string) => void
  theme: 'light' | 'dark'
  isDeleting: boolean
  repoTypes: Map<string, 'ios' | 'android' | 'infra' | 'unknown'>
}

function MiniWorktreeCard({ worktree, onClean, onOpenTerminal, onOpenEditor, onBuild, theme, isDeleting, repoTypes }: MiniWorktreeCardProps) {
  const cleanCount = worktree.repos.filter(r => r.clean).length
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className={`transition-all p-5 group ${isDeleting ? 'opacity-50' : ''} ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <TreePine className="w-4 h-4 text-emerald-500" />
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
            {worktree.label}
            {isDeleting && <span className={`ml-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>(Deleting...)</span>}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onClean(worktree.label)}
          disabled={isDeleting}
          className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-slate-600 hover:text-red-600 hover:bg-slate-100'}`}
          title="Clean worktree"
        >
          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <div className="space-y-2 mb-4">
        {worktree.repos.map((repo) => (
          <div key={repo.name}>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${!repo.exists ? 'bg-red-500' : repo.clean ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{repo.name}</span>
              </div>
              {!repo.exists ? (
                <span className={`text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>missing</span>
              ) : !repo.clean && (
                <span className={`text-xs ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>{repo.uncommitted}</span>
              )}
            </div>
            {isExpanded && (
              <div className="ml-3.5 mt-1 flex items-center gap-2">
                <GitBranch className={`w-3 h-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                <code className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{repo.branch}</code>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={`flex items-center justify-between pt-4 border-t ${theme === 'dark' ? 'border-slate-800/50' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className={theme === 'dark' ? 'h-6 w-6 text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'h-6 w-6 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
          <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            {cleanCount}/{worktree.repos.length} clean
          </span>
        </div>
        <div className="flex gap-1">
          {worktree.repos.some(r => {
            const cacheKey = `${worktree.label}:${r.name}`
            const detectedType = repoTypes.get(cacheKey) || 'unknown'
            return detectedType === 'ios' || detectedType === 'android'
          }) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const buildableRepo = worktree.repos.find(r => {
                  const cacheKey = `${worktree.label}:${r.name}`
                  const detectedType = repoTypes.get(cacheKey) || 'unknown'
                  return detectedType === 'ios' || detectedType === 'android'
                })
                if (buildableRepo) {
                  const cacheKey = `${worktree.label}:${buildableRepo.name}`
                  const detectedType = repoTypes.get(cacheKey) || 'unknown'
                  onBuild(
                    worktree.label,
                    detectedType === 'ios' ? 'ios' : 'android',
                    buildableRepo.name,
                    buildableRepo.path
                  )
                }
              }}
              className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
              title="Build"
            >
              <Hammer className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenTerminal(worktree.label, worktree.repos[0].name)}
            className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            title="Open terminal"
          >
            <Terminal className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenEditor(worktree.label, worktree.repos[0].name)}
            className={theme === 'dark' ? 'h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            title="Open in editor"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
