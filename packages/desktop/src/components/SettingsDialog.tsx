import { useState, useEffect } from 'react'
import { WorkspaceSettings } from './WorkspaceSettings'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Activity,
  Settings as SettingsIcon,
  Plug,
  Code,
  Sun,
  Moon,
  Layout,
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  X,
  GitBranch,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: 'light' | 'dark'
  onThemeChange: () => void
  layoutMode: '1-col' | '2-col' | 'auto'
  onLayoutChange: () => void
  terminalPreference: 'default' | 'iterm' | 'warp' | 'alacritty'
  onTerminalChange: (terminal: 'default' | 'iterm' | 'warp' | 'alacritty') => void
  editorPreference: 'vscode' | 'cursor' | 'sublime' | 'webstorm'
  onEditorChange: (editor: 'vscode' | 'cursor' | 'sublime' | 'webstorm') => void
  branchSourceRepo?: string
  onBranchSourceRepoChange?: (repo: string) => void
  availableRepos?: string[]
  embedded?: boolean
  onConfigChange?: () => void
}

interface DoctorCheckResult {
  name: string
  status: 'pass' | 'fail' | 'pending'
  message?: string
}

export function SettingsDialog({
  open,
  onOpenChange,
  theme,
  onThemeChange,
  layoutMode,
  onLayoutChange,
  terminalPreference,
  onTerminalChange,
  editorPreference,
  onEditorChange,
  branchSourceRepo,
  onBranchSourceRepoChange,
  availableRepos,
  embedded = false,
  onConfigChange,
}: SettingsDialogProps) {
  const [doctorRunning, setDoctorRunning] = useState(false)
  const [doctorResults, setDoctorResults] = useState<DoctorCheckResult[]>([])
  const [installedTerminals, setInstalledTerminals] = useState<string[]>(['default'])
  const [installedEditors, setInstalledEditors] = useState<string[]>(['vscode'])

  useEffect(() => {
    // Fetch installed applications when dialog opens
    const fetchInstalledApps = async () => {
      try {
        const apps = await window.etz.getInstalledApps()
        setInstalledTerminals(apps.terminals)
        setInstalledEditors(apps.editors)

        // If current selection is not installed, fallback to first available
        if (!apps.terminals.includes(terminalPreference) && apps.terminals.length > 0) {
          onTerminalChange(apps.terminals[0] as 'default' | 'iterm' | 'warp' | 'alacritty')
        }
        if (!apps.editors.includes(editorPreference) && apps.editors.length > 0) {
          onEditorChange(apps.editors[0] as 'vscode' | 'cursor' | 'sublime' | 'webstorm')
        }
      } catch (error) {
        console.error('Failed to fetch installed apps:', error)
      }
    }

    if (open || embedded) {
      fetchInstalledApps()
    }
  }, [open, embedded])

  const runDoctor = async () => {
    setDoctorRunning(true)
    setDoctorResults([
      { name: 'Configuration File', status: 'pending' },
      { name: 'Repository Paths', status: 'pending' },
    ])

    try {
      // Call the etz doctor command through Electron IPC
      const result = await window.etz.doctor()

      if (!result.success) {
        // If the command failed, show error
        setDoctorResults([
          {
            name: 'Etz Doctor',
            status: 'fail',
            message: result.error || 'Failed to run diagnostics'
          },
        ])
        return
      }

      // Parse the output
      const output = result.output || ''
      const checks: DoctorCheckResult[] = []

      // Check for .etzconfig.yaml
      if (output.includes('✅ .etzconfig.yaml found')) {
        checks.push({
          name: 'Configuration File',
          status: 'pass',
          message: '.etzconfig.yaml found and valid'
        })
      } else if (output.includes('❌') && output.includes('.etzconfig.yaml')) {
        checks.push({
          name: 'Configuration File',
          status: 'fail',
          message: '.etzconfig.yaml not found or invalid'
        })
      }

      // Parse repository checks
      const repoLines = output.split('\n').filter(line =>
        line.includes('✅') && line.includes('→')
      )

      if (repoLines.length > 0) {
        checks.push({
          name: 'Repository Paths',
          status: 'pass',
          message: `${repoLines.length} repositories verified and accessible`
        })

        // Add individual repo checks
        repoLines.forEach(line => {
          const match = line.match(/✅\s+(\S+)\s+→\s+(.+)/)
          if (match) {
            checks.push({
              name: match[1],
              status: 'pass',
              message: match[2]
            })
          }
        })
      }

      // Check for failed repositories
      const failedRepoLines = output.split('\n').filter(line =>
        line.includes('❌') && line.includes('→')
      )

      failedRepoLines.forEach(line => {
        const match = line.match(/❌\s+(\S+)\s+→\s+(.+)/)
        if (match) {
          checks.push({
            name: match[1],
            status: 'fail',
            message: match[2]
          })
        }
      })

      // Check completion message
      if (output.includes('🧪 Etz doctor check complete')) {
        checks.push({
          name: 'Diagnostics Complete',
          status: 'pass',
          message: 'All checks completed successfully'
        })
      }

      setDoctorResults(checks.length > 0 ? checks : [
        { name: 'Diagnostics', status: 'pass', message: 'Check completed' }
      ])
    } catch (error: any) {
      // Handle errors
      setDoctorResults([
        {
          name: 'Error',
          status: 'fail',
          message: error.message || 'Failed to run diagnostics',
        }
      ])
    } finally {
      setDoctorRunning(false)
    }
  }

  const getLayoutLabel = () => {
    if (layoutMode === '1-col') return 'Single Column'
    if (layoutMode === '2-col') return 'Two Columns'
    return 'Auto'
  }

  const settingsContent = (
    <Tabs defaultValue="workspace" className={embedded ? '' : 'mt-4'}>
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="workspace" className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Workspace
        </TabsTrigger>
        <TabsTrigger value="health" className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          System Health
        </TabsTrigger>
        <TabsTrigger value="preferences" className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" />
          Preferences
        </TabsTrigger>
        <TabsTrigger value="integrations" className="flex items-center gap-2">
          <Plug className="w-4 h-4" />
          Integrations
        </TabsTrigger>
        <TabsTrigger value="advanced" className="flex items-center gap-2">
          <Code className="w-4 h-4" />
          Advanced
        </TabsTrigger>
      </TabsList>

      {/* Workspace Tab */}
      <TabsContent value="workspace" className="space-y-6 mt-6">
        <WorkspaceSettings theme={theme} onConfigChange={onConfigChange} />
      </TabsContent>

      {/* System Health Tab */}
      <TabsContent value="health" className="space-y-4 mt-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">
            Environment Diagnostics
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Run diagnostics to ensure your development environment is properly configured.
          </p>

          <Button
            onClick={runDoctor}
            disabled={doctorRunning}
            className="mb-4"
          >
            {doctorRunning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {doctorRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>

          {doctorResults.length > 0 && (
            <Card className="p-4 space-y-3 bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/50">
              {doctorResults.map((check, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30"
                >
                  {check.status === 'pending' && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />
                  )}
                  {check.status === 'pass' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  {check.status === 'fail' && (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {check.name}
                    </p>
                    {check.message && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {check.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h4 className="font-semibold mb-3 text-slate-900 dark:text-white">
            Required Tools
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Ensure the following tools are installed for optimal functionality:
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/30">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-slate-900 dark:text-slate-300">Node.js (bundled with Electron)</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/30">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-slate-900 dark:text-slate-300">Git (for worktree management)</span>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Preferences Tab */}
      <TabsContent value="preferences" className="space-y-6 mt-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Appearance
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Theme
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Current: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onThemeChange}
                className="ml-4"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Layout
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Current: {getLayoutLabel()}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onLayoutChange}
                className="ml-4"
              >
                <Layout className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Notifications
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <div>
                  <Label className="text-base font-medium text-slate-900 dark:text-white">
                    Desktop Notifications
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Show notifications for repo status changes
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Enable
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Integrations Tab */}
      <TabsContent value="integrations" className="space-y-6 mt-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Editor Integration
          </h3>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Default Editor
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Choose which editor to open
                </p>
              </div>
            </div>
            <Select value={editorPreference} onValueChange={onEditorChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {installedEditors.includes('vscode') && (
                  <SelectItem value="vscode">VS Code</SelectItem>
                )}
                {installedEditors.includes('cursor') && (
                  <SelectItem value="cursor">Cursor</SelectItem>
                )}
                {installedEditors.includes('sublime') && (
                  <SelectItem value="sublime">Sublime Text</SelectItem>
                )}
                {installedEditors.includes('webstorm') && (
                  <SelectItem value="webstorm">WebStorm</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Terminal Preference
          </h3>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Default Terminal
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Choose which terminal to open
                </p>
              </div>
            </div>
            <Select value={terminalPreference} onValueChange={onTerminalChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {installedTerminals.includes('default') && (
                  <SelectItem value="default">System Default</SelectItem>
                )}
                {installedTerminals.includes('iterm') && (
                  <SelectItem value="iterm">iTerm2</SelectItem>
                )}
                {installedTerminals.includes('warp') && (
                  <SelectItem value="warp">Warp</SelectItem>
                )}
                {installedTerminals.includes('alacritty') && (
                  <SelectItem value="alacritty">Alacritty</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Worktree Creation
          </h3>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Branch Source Repository
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Which repo to use for branch discovery when creating worktrees
                </p>
              </div>
            </div>
            <Select value={branchSourceRepo} onValueChange={onBranchSourceRepoChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRepos && availableRepos.length > 0 ? (
                  availableRepos.map(repo => (
                    <SelectItem key={repo} value={repo}>{repo}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No repos available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      {/* Advanced Tab */}
      <TabsContent value="advanced" className="space-y-6 mt-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Debug Options
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Debug Logging
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Enable verbose logging for troubleshooting
                </p>
              </div>
              <Button variant="outline" size="sm">
                Enable
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/30">
              <div>
                <Label className="text-base font-medium text-slate-900 dark:text-white">
                  Auto-Refresh Interval
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  How often to refresh repository status (seconds)
                </p>
              </div>
              <input
                type="number"
                defaultValue={30}
                min={10}
                max={300}
                className="w-20 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Data Management
          </h3>

          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              Export Settings
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Import Settings
            </Button>
            <Button variant="destructive" className="w-full justify-start">
              Reset to Defaults
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )

  if (embedded) {
    return settingsContent
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent theme={theme} className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 data-[state=open]:text-slate-500 dark:ring-offset-slate-950 dark:focus:ring-slate-300 dark:data-[state=open]:bg-slate-800 dark:data-[state=open]:text-slate-400">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        {settingsContent}
      </DialogContent>
    </Dialog>
  )
}
