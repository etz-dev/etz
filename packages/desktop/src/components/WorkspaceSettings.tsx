import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderOpen, GitBranch, Plus, Trash2, Code2 } from 'lucide-react'

interface WorkspaceSettingsProps {
  theme: 'light' | 'dark'
  onConfigChange?: () => void
}

interface AppInfo {
  id: string
  name: string
  path: string
  version?: string
}

export function WorkspaceSettings({ theme, onConfigChange }: WorkspaceSettingsProps) {
  const [workspaceDirectory, setWorkspaceDirectory] = useState('')
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [newRepoPath, setNewRepoPath] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [availableEditors, setAvailableEditors] = useState<AppInfo[]>([])

  interface Repository {
    id: string
    name: string
    sourceType: 'local' | 'github'
    path?: string
    url?: string
    enabledByDefault: boolean
    baseBranch?: string
    preferredEditor?: string  // Can be 'default' or an app ID like 'xcode-16.0'
    preferredEditorPath?: string  // Full path to the editor app
  }

  useEffect(() => {
    loadConfig()
    loadAvailableEditors()
  }, [])

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      const config = await window.etz.config.get()
      setWorkspaceDirectory(config.workspace.baseDirectory)
      setRepositories(config.repositories)
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailableEditors = async () => {
    try {
      const apps = await window.etz.getInstalledApps()
      setAvailableEditors(apps.editors || [])
    } catch (error) {
      console.error('Failed to load available editors:', error)
    }
  }

  const handleSelectWorkspaceDirectory = async () => {
    try {
      const result = await window.etz.selectDirectory()
      if (result) {
        setWorkspaceDirectory(result)
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const handleSelectRepoPath = async () => {
    try {
      const result = await window.etz.selectDirectory()
      if (result) {
        setNewRepoPath(result)
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const handleAddRepository = () => {
    if (newRepoPath.trim()) {
      const pathSegments = newRepoPath.trim().split('/')
      const name = pathSegments[pathSegments.length - 1]

      // Auto-detect iOS repos and set Xcode as default
      const isIOS = name.toLowerCase().includes('ios') || name.toLowerCase().includes('.ios')

      const newRepo: Repository = {
        id: `repo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        sourceType: 'local',
        path: newRepoPath.trim(),
        enabledByDefault: true,
        baseBranch: 'master', // Default base branch
        preferredEditor: isIOS ? 'xcode' : 'default',
      }

      setRepositories([...repositories, newRepo])
      setNewRepoPath('')
    }
  }

  const handleUpdateBaseBranch = (id: string, baseBranch: string) => {
    setRepositories(repositories.map(repo =>
      repo.id === id ? { ...repo, baseBranch } : repo
    ))
  }

  const handleUpdatePreferredEditor = (id: string, editorId: string) => {
    const editor = availableEditors.find(e => e.id === editorId)
    setRepositories(repositories.map(repo =>
      repo.id === id ? {
        ...repo,
        preferredEditor: editorId,
        preferredEditorPath: editor?.path
      } : repo
    ))
  }

  const handleCancel = () => {
    // Reload config to reset changes
    loadConfig()
  }

  const handleRemoveRepository = (id: string) => {
    setRepositories(repositories.filter(repo => repo.id !== id))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const config = await window.etz.config.get()

      config.workspace.baseDirectory = workspaceDirectory
      config.repositories = repositories

      const result = await window.etz.config.save(config)

      if (result.success) {
        alert('Settings saved successfully!')
        onConfigChange?.()
      } else {
        alert(`Failed to save settings: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert(`Error saving settings: ${error}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading configuration...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Workspace Directory Section - Compact */}
      <Card className={`p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="space-y-2">
          <Label className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
            Workspace Directory
          </Label>
          <div className="flex gap-2">
            <Input
              value={workspaceDirectory}
              onChange={(e) => setWorkspaceDirectory(e.target.value)}
              placeholder="/path/to/workspace"
              className={`text-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectWorkspaceDirectory}
              className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300'}
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
            Where all worktrees will be created
          </p>
        </div>
      </Card>

      {/* Repositories Section - Compact */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
            Repositories ({repositories.length})
          </Label>
        </div>

        {/* Add Repository Form - Inline */}
        <div className="flex gap-2">
          <Input
            value={newRepoPath}
            onChange={(e) => setNewRepoPath(e.target.value)}
            placeholder="Add repository path..."
            className={`text-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 placeholder:text-slate-400'}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectRepoPath}
            className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300'}
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleAddRepository}
            disabled={!newRepoPath.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Repository List - Compact Cards */}
        <div className="space-y-2">
          {repositories.length > 0 ? (
            <>
              {repositories.map((repo) => (
                <Card
                  key={repo.id}
                  className={`p-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  <div className="space-y-2">
                    {/* Header with name and delete button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GitBranch className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                            {repo.name}
                          </div>
                          <div className={`text-xs truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                            {repo.path}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRepository(repo.id)}
                        className={`flex-shrink-0 h-7 w-7 p-0 text-red-500 hover:text-red-600 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Two column layout for settings */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          Base Branch
                        </Label>
                        <Input
                          value={repo.baseBranch || 'master'}
                          onChange={(e) => handleUpdateBaseBranch(repo.id, e.target.value)}
                          placeholder="master"
                          className={`h-8 text-xs ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          Preferred Editor
                        </Label>
                        <Select
                          value={repo.preferredEditor || 'default'}
                          onValueChange={(value) => handleUpdatePreferredEditor(repo.id, value)}
                        >
                          <SelectTrigger className={`h-8 text-xs ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}>
                            <SelectItem value="default" className={theme === 'dark' ? 'text-slate-200 focus:bg-slate-800' : 'text-slate-900 focus:bg-slate-100'}>
                              Use Global Setting
                            </SelectItem>
                            {availableEditors.map((editor) => (
                              <SelectItem
                                key={editor.id}
                                value={editor.id}
                                className={theme === 'dark' ? 'text-slate-200 focus:bg-slate-800' : 'text-slate-900 focus:bg-slate-100'}
                              >
                                {editor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          ) : (
            <Card className={`p-6 text-center ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <GitBranch className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                No repositories configured. Add at least one repository to use Etz.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={`flex justify-end gap-2 pt-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isSaving}
          className={theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : ''}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || repositories.length === 0 || !workspaceDirectory.trim()}
          className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
