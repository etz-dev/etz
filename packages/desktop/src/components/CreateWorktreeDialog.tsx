import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { TreePine, GitBranch, AlertCircle, Loader2, Plus, RotateCcw, Check, Settings2, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Label } from './ui/label'

interface CreateWorktreeDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  theme: 'light' | 'dark'
  onCreatingChange: (creating: boolean, label: string) => void
  existingWorktrees: string[]
  repos: Array<{ name: string }>
}

const USE_DEFAULT = '__USE_DEFAULT__' // Special marker for "use worktree name"

export function CreateWorktreeDialog({
  open,
  onClose,
  onSuccess,
  theme,
  onCreatingChange,
  existingWorktrees,
  repos,
}: CreateWorktreeDialogProps) {
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // Initialize branchMap with USE_DEFAULT for all repos immediately
  const [branchMap, setBranchMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {}
    repos.forEach(repo => {
      initialMap[repo.name] = USE_DEFAULT
    })
    return initialMap
  })

  const [availableBranches, setAvailableBranches] = useState<Record<string, string[]>>({})
  const [loadingBranches, setLoadingBranches] = useState(true)
  const hasFetchedRef = useRef(false)
  const [baseBranchOverrides, setBaseBranchOverrides] = useState<Record<string, string>>({})
  const [showBaseBranchFor, setShowBaseBranchFor] = useState<Record<string, boolean>>({})

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setLabel('')
      setCreating(false)
      const resetMap: Record<string, string> = {}
      repos.forEach(repo => {
        resetMap[repo.name] = USE_DEFAULT
      })
      setBranchMap(resetMap)
      setAvailableBranches({})
      setLoadingBranches(true)
      hasFetchedRef.current = false // Reset the fetch flag
      setBaseBranchOverrides({})
      setShowBaseBranchFor({})
    }
  }, [open, repos])

  // Fetch branches when dialog opens (only once per dialog open)
  useEffect(() => {
    if (open && repos.length > 0 && !hasFetchedRef.current) {
      console.log('[CreateWorktreeDialog] useEffect triggered - fetching branches')
      hasFetchedRef.current = true
      fetchBranchesForAllRepos()
    }
  }, [open, repos])

  const fetchBranchesForAllRepos = async () => {
    console.log('[fetchBranchesForAllRepos] Starting fetch, setting loadingBranches=true')
    setLoadingBranches(true)
    const branchesMap: Record<string, string[]> = {}

    try {
      // Fetch branches for each repo in parallel
      await Promise.all(
        repos.map(async (repo) => {
          try {
            console.log(`[fetchBranchesForAllRepos] Fetching branches for ${repo.name}`)
            const branches = await window.etz.getBranches(repo.name)
            branchesMap[repo.name] = branches || []
            console.log(`[fetchBranchesForAllRepos] Got ${branches?.length || 0} branches for ${repo.name}`)
          } catch (error) {
            console.error(`Failed to fetch branches for ${repo.name}:`, error)
            branchesMap[repo.name] = []
          }
        })
      )

      // Update both state values in one batch
      console.log('[fetchBranchesForAllRepos] All fetches complete, setting availableBranches and loadingBranches=false')
      setAvailableBranches(branchesMap)
      setLoadingBranches(false)
    } catch (error) {
      console.error('Failed to fetch branches:', error)
      setLoadingBranches(false)
    }
  }

  const labelExists = existingWorktrees.includes(label.trim())
  const canCreate = label.trim() && !labelExists

  // Get the effective branch name for a repo (resolves USE_DEFAULT to actual label)
  const getEffectiveBranch = (repoName: string): string => {
    const selected = branchMap[repoName]
    return selected === USE_DEFAULT ? label.trim() : selected || label.trim()
  }

  // Check if repo is using default (worktree name)
  const isUsingDefault = (repoName: string): boolean => {
    return branchMap[repoName] === USE_DEFAULT
  }

  // Set all repos to use worktree name
  const resetAllToDefault = () => {
    const newMap: Record<string, string> = {}
    repos.forEach(repo => {
      newMap[repo.name] = USE_DEFAULT
    })
    setBranchMap(newMap)
  }

  // Check if any repo has a custom branch selected
  const hasCustomBranches = Object.values(branchMap).some(val => val !== USE_DEFAULT)

  const handleCreate = async () => {
    if (!canCreate) return

    setCreating(true)
    onCreatingChange(true, label.trim())
    onClose()

    try {
      // Build the branch map to send to backend
      // Only include repos with custom branches (not USE_DEFAULT)
      const customBranchMap: Record<string, string> = {}
      repos.forEach(repo => {
        const selected = branchMap[repo.name]
        if (selected && selected !== USE_DEFAULT) {
          customBranchMap[repo.name] = selected
        }
      })

      // Filter out empty base branch overrides
      const filteredOverrides: Record<string, string> = {}
      Object.entries(baseBranchOverrides).forEach(([repo, branch]) => {
        if (branch && branch.trim()) {
          filteredOverrides[repo] = branch.trim()
        }
      })

      console.log('[CreateWorktreeDialog] Calling window.etz.switch with:', {
        label: label.trim(),
        customBranchMap,
        defaultBranch: label.trim(),
        baseBranchOverrides: Object.keys(filteredOverrides).length > 0 ? filteredOverrides : undefined
      })

      // Pass label as defaultBranch so repos not in customBranchMap will use it
      const result = await window.etz.switch(
        label.trim(),
        customBranchMap,
        label.trim(),
        Object.keys(filteredOverrides).length > 0 ? filteredOverrides : undefined
      )
      if (result.success) {
        await onSuccess()
        // Only clear the creating state after onSuccess completes
        setCreating(false)
        onCreatingChange(false, label.trim())
      } else {
        const errorMsg = result.error || result.output || 'Unknown error occurred'
        alert(`Error creating worktree:\n\n${errorMsg}`)
        setCreating(false)
        onCreatingChange(false, label.trim())
      }
    } catch (error: any) {
      alert(`Error: ${error?.message || String(error) || 'Unknown error'}`)
      setCreating(false)
      onCreatingChange(false, label.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate && !creating) {
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !creating && onClose()}>
      <DialogContent
        className={`max-w-lg max-h-[85vh] flex flex-col ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
            <TreePine className="w-5 h-5 text-emerald-500" />
            Create New Worktree
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          {/* Worktree Name Input */}
          <div className="space-y-2">
            <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Worktree Name
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., feature-auth, bugfix-notifications"
              className={`${
                labelExists && label.trim()
                  ? theme === 'dark'
                    ? 'border-red-500 bg-slate-800 text-white focus:ring-red-500'
                    : 'border-red-500 focus:ring-red-500'
                  : theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  : 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
              autoFocus
              disabled={creating}
            />
            {labelExists && label.trim() ? (
              <p className={`text-sm flex items-center gap-1.5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5" />
                A worktree with this name already exists
              </p>
            ) : (
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                This name will be used as the default branch name for all repositories
              </p>
            )}
          </div>

          {/* Branch Selection Section - Always visible */}
          <div className="space-y-3">
            <div className="flex items-center justify-between h-7">
              <p className={`text-xs font-medium uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Will create branches:
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAllToDefault}
                className={`h-7 text-xs gap-1.5 transition-opacity ${
                  hasCustomBranches && !loadingBranches
                    ? 'opacity-100'
                    : 'opacity-0 pointer-events-none'
                } ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-700'}`}
              >
                <RotateCcw className="w-3 h-3" />
                Use worktree name for all
              </Button>
            </div>

            <div className="space-y-2">
              {repos.map((repo) => {
                const branches = availableBranches[repo.name] || []
                const effectiveBranch = getEffectiveBranch(repo.name)
                const isDefault = isUsingDefault(repo.name)

                return (
                  <div
                    key={repo.name}
                    className={`p-3 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800/50 border border-slate-800/50'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {repo.name}
                      </span>

                      <div className="flex items-center gap-2">
                        <GitBranch className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />

                      <div className="relative w-[200px] min-w-0">
                        {/* Always render Select, but hide it when loading */}
                        <div className={loadingBranches ? 'invisible' : 'visible'}>
                          <Select
                            value={branchMap[repo.name] || USE_DEFAULT}
                            onValueChange={(value) => {
                              setBranchMap(prev => ({
                                ...prev,
                                [repo.name]: value
                              }))
                            }}
                            disabled={creating || loadingBranches}
                          >
                            <SelectTrigger
                              className={`w-full h-8 text-sm font-mono flex items-center ${
                                theme === 'dark'
                                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                                  : 'bg-white border-slate-300 text-slate-900'
                              } ${isDefault ? 'font-semibold' : ''}`}
                            >
                              <SelectValue>
                                <span className={`inline-block truncate text-left align-middle ${isDefault ? 'text-emerald-500' : ''}`}>
                                  {effectiveBranch}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent
                              className={theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}
                              position="popper"
                              sideOffset={4}
                            >
                              {/* Default option - use worktree name */}
                              <SelectItem
                                value={USE_DEFAULT}
                                className={theme === 'dark' ? 'text-slate-200 focus:bg-slate-800' : 'text-slate-900 focus:bg-slate-100'}
                              >
                                <span className="flex items-center gap-2 font-semibold text-emerald-500">
                                  ✓ Use worktree name
                                  {label.trim() && (
                                    <span className="text-xs opacity-60">({label.trim()})</span>
                                  )}
                                </span>
                              </SelectItem>

                              {/* Available branches */}
                              {branches.length > 0 && (
                                <>
                                  <div className={`px-2 py-1.5 text-xs font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Existing branches
                                  </div>
                                  {branches.map(branch => (
                                    <SelectItem
                                      key={branch}
                                      value={branch}
                                      className={theme === 'dark' ? 'text-slate-300 focus:bg-slate-800 font-mono' : 'text-slate-700 focus:bg-slate-100 font-mono'}
                                    >
                                      {branch}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Loading overlay - positioned absolutely on top */}
                        {loadingBranches && (
                          <div className={`absolute inset-0 flex items-center px-3 rounded-md border text-sm ${
                            theme === 'dark'
                              ? 'bg-slate-900 border-slate-700 text-slate-400'
                              : 'bg-white border-slate-300 text-slate-500'
                          }`}>
                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                            Loading...
                          </div>
                        )}
                      </div>

                        {/* Settings button to toggle base branch override */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBaseBranchFor(prev => ({
                            ...prev,
                            [repo.name]: !prev[repo.name]
                          }))}
                          className={`h-8 w-8 p-0 ${
                            theme === 'dark'
                              ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300'
                              : 'hover:bg-slate-200 text-slate-600 hover:text-slate-700'
                          } ${showBaseBranchFor[repo.name] || baseBranchOverrides[repo.name] ? 'text-emerald-500' : ''}`}
                          title="Override base branch"
                        >
                          {showBaseBranchFor[repo.name] ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Settings2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Inline base branch override input */}
                    {showBaseBranchFor[repo.name] && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                        <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          Base Branch Override (optional)
                        </Label>
                        <Input
                          value={baseBranchOverrides[repo.name] || ''}
                          onChange={(e) => setBaseBranchOverrides(prev => ({
                            ...prev,
                            [repo.name]: e.target.value
                          }))}
                          placeholder="Leave empty for default"
                          className={`text-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 placeholder:text-slate-400'}`}
                        />
                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                          Override the base branch for creating new branches
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="h-5">
              {label.trim() && (
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  If a branch doesn't exist, it will be created from the configured base branch
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`flex justify-end gap-3 pt-4 border-t flex-shrink-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={creating}
            className={theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : ''}
          >
            Cancel
          </Button>

          <Button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Worktree
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
