import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  FolderOpen,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Settings,
} from 'lucide-react'

interface SetupWizardProps {
  open: boolean
  onComplete: (config: SetupConfig) => void
  theme: 'light' | 'dark'
}

export interface SetupConfig {
  workspaceDirectory: string
  repositories: Array<{
    name: string
    path: string
    baseBranch: string
  }>
}

type Step = 'welcome' | 'workspace' | 'repositories' | 'base-branches' | 'complete'

export function SetupWizard({ open, onComplete, theme }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [workspaceDirectory, setWorkspaceDirectory] = useState('')
  const [repositories, setRepositories] = useState<Array<{ name: string; path: string; baseBranch: string }>>([])
  const [repoPath, setRepoPath] = useState('')
  const [repoBranches, setRepoBranches] = useState<Record<string, string>>({})

  const handleSelectDirectory = async () => {
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
        setRepoPath(result)
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const handleAddRepository = () => {
    if (repoPath.trim()) {
      // Extract repository name from path (last segment)
      const pathSegments = repoPath.trim().split('/')
      const name = pathSegments[pathSegments.length - 1]

      setRepositories([...repositories, { name, path: repoPath.trim(), baseBranch: 'master' }])
      setRepoPath('')
    }
  }

  const handleUpdateBaseBranch = (repoName: string, baseBranch: string) => {
    setRepositories(repositories.map(repo =>
      repo.name === repoName ? { ...repo, baseBranch } : repo
    ))
  }

  const handleRemoveRepository = (index: number) => {
    setRepositories(repositories.filter((_, i) => i !== index))
  }

  const handleComplete = () => {
    onComplete({
      workspaceDirectory,
      repositories,
    })
  }

  const canProceedFromWorkspace = workspaceDirectory.trim().length > 0
  const canComplete = repositories.length > 0

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className={`max-w-2xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {currentStep === 'welcome' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className={`text-2xl ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                    Welcome to Etz!
                  </DialogTitle>
                  <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                    Let's get you set up in just a few steps
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <Card className={`p-6 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  What is Etz?
                </h3>
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Etz is a powerful git worktree manager that helps you work on multiple branches simultaneously across multiple repositories.
                  Perfect for teams working with microservices, monorepos, or multi-repo projects.
                </p>
              </Card>

              <Card className={`p-6 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  What we'll set up:
                </h3>
                <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  <li className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-emerald-500" />
                    <span>Workspace directory - where your worktrees will live</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-500" />
                    <span>Repositories - the git repos you want to manage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-500" />
                    <span>Base branches - default branches for creating new worktrees</span>
                  </li>
                </ul>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep('workspace')}
                className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {currentStep === 'workspace' && (
          <>
            <DialogHeader>
              <DialogTitle className={theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}>
                Choose Worktrees Base Directory
              </DialogTitle>
              <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                This is where all your worktrees will be created
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">
              <div className="space-y-3">
                <Label className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                  Worktrees Base Directory
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={workspaceDirectory}
                    onChange={(e) => setWorkspaceDirectory(e.target.value)}
                    placeholder="/path/to/workspace"
                    className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}
                  />
                  <Button
                    variant="outline"
                    onClick={handleSelectDirectory}
                    className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300'}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  Example: /Users/yourname/worktrees
                </p>
              </div>

              <Card className={`p-4 ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>
                  💡 Tip: Choose a location with plenty of disk space. Each worktree will create a separate working directory.
                </p>
              </Card>
            </div>

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep('welcome')}
                className={theme === 'dark' ? 'hover:bg-slate-800' : ''}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('repositories')}
                disabled={!canProceedFromWorkspace}
                className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white disabled:opacity-50"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {currentStep === 'repositories' && (
          <>
            <DialogHeader>
              <DialogTitle className={theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}>
                Add Your Repositories
              </DialogTitle>
              <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Add the git repositories you want to manage with Etz
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 flex flex-col gap-6 max-h-[500px]">
              {/* Add Repository Form - Fixed at top */}
              <Card className={`p-4 flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Local Repository Path
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={repoPath}
                        onChange={(e) => setRepoPath(e.target.value)}
                        placeholder="/path/to/repo"
                        className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}
                      />
                      <Button
                        variant="outline"
                        onClick={handleSelectRepoPath}
                        className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300'}
                      >
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddRepository}
                    disabled={!repoPath.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Add Repository
                  </Button>
                </div>
              </Card>

              {/* Repository List - Scrollable */}
              {repositories.length > 0 ? (
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="space-y-2 pr-2">
                    <Label className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Added Repositories ({repositories.length})
                    </Label>
                    {repositories.map((repo, index) => (
                      <Card
                        key={index}
                        className={`p-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                              {repo.name}
                            </div>
                            <div className={`text-xs truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                              {repo.path}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRepository(index)}
                            className={`flex-shrink-0 text-red-500 hover:text-red-600 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card className={`p-6 text-center flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                  <GitBranch className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                    No repositories added yet. Add at least one to continue.
                  </p>
                </Card>
              )}
            </div>

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep('workspace')}
                className={theme === 'dark' ? 'hover:bg-slate-800' : ''}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('base-branches')}
                disabled={!canComplete}
                className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white disabled:opacity-50"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {currentStep === 'base-branches' && (
          <>
            <DialogHeader>
              <DialogTitle className={theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}>
                Configure Base Branches
              </DialogTitle>
              <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Set the default base branch for each repository. This will be used when creating new branches.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4 max-h-[500px] overflow-y-auto">
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                When you create a new worktree with a branch that doesn't exist, it will be created from these base branches.
              </p>

              {repositories.map((repo, index) => (
                <Card
                  key={index}
                  className={`p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="space-y-3">
                    <div>
                      <Label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                        {repo.name}
                      </Label>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        {repo.path}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        Base Branch
                      </Label>
                      <div className="flex items-center gap-2">
                        <GitBranch className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                        <Input
                          value={repo.baseBranch}
                          onChange={(e) => handleUpdateBaseBranch(repo.name, e.target.value)}
                          placeholder="master or main"
                          className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        Common values: master, main, develop
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep('repositories')}
                className={theme === 'dark' ? 'hover:bg-slate-800' : ''}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('complete')}
                className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {currentStep === 'complete' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className={`text-2xl ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                    You're All Set!
                  </DialogTitle>
                  <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                    Review your configuration
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <Card className={`p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`font-semibold mb-2 text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  Worktrees Base Directory
                </h3>
                <code className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {workspaceDirectory}
                </code>
              </Card>

              <Card className={`p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`font-semibold mb-3 text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  Repositories ({repositories.length})
                </h3>
                <div className="space-y-3">
                  {repositories.map((repo, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3 h-3 text-emerald-500" />
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          {repo.name}
                        </span>
                      </div>
                      <p className={`text-xs ml-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        Base branch: <span className="font-mono text-emerald-500">{repo.baseBranch}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className={`flex items-start gap-3 p-4 rounded-lg border ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                <Settings className={`w-5 h-5 flex-shrink-0 mt-0.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                <div>
                  <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>
                    Need to make changes later?
                  </p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-blue-400/80' : 'text-blue-700'}`}>
                    You can always edit your workspace directory and repositories in the Settings page.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep('repositories')}
                className={theme === 'dark' ? 'hover:bg-slate-800' : ''}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleComplete}
                className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Setup
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
