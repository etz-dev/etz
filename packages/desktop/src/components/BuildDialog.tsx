import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronRight,
  Play,
  Wrench,
  ExternalLink,
  X,
  ArrowDown,
} from 'lucide-react'

interface BuildPreCondition {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  canAutoFix: boolean
  fixAction?: string
}

interface BuildProgress {
  label: string
  stage: string
  progress: number
  message: string
  timestamp: number
}

interface BuildDialogProps {
  open: boolean
  onClose: () => void
  label: string
  platform: 'ios' | 'android'
  repo: string
  repoPath?: string
  onOpenTerminal?: (path: string) => void
  onOpen?: () => void
  theme?: 'light' | 'dark'
}

export function BuildDialog({ open, onClose, label, platform, repo, repoPath, onOpenTerminal, onOpen, theme = 'dark' }: BuildDialogProps) {
  const [checking, setChecking] = useState(false)
  const [conditions, setConditions] = useState<BuildPreCondition[]>([])
  const [ready, setReady] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null)
  const [buildOutput, setBuildOutput] = useState<string[]>([])
  const [showOutput, setShowOutput] = useState(false)
  const [buildComplete, setBuildComplete] = useState(false)
  const [buildSuccess, setBuildSuccess] = useState(false)
  const [fixingAction, setFixingAction] = useState<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null)

  // Check pre-conditions when dialog opens
  useEffect(() => {
    if (open) {
      // Reset all state when dialog opens
      setBuildOutput([])
      setBuildProgress(null)
      setBuildComplete(false)
      setBuildSuccess(false)
      setBuilding(false)
      setFixingAction(null)
      setShowOutput(false)
      setManuallyCollapsed(false)

      // Check if a build is already in progress
      // Returns true if a build was found, false otherwise
      const checkExistingBuild = async (): Promise<boolean> => {
        try {
          const buildInfo = await window.etz.getActiveBuildInfo(label)
          if (buildInfo) {
            // Determine if it's a main build (ios/android) or a fix action (pod_install/build_infra)
            const isMainBuild = buildInfo.type === 'build_ios' || buildInfo.type === 'build_android'
            const isFixAction = buildInfo.type === 'pod_install' || buildInfo.type === 'build_infra_ios'

            // Format the action name
            const actionName = buildInfo.type === 'pod_install' ? 'Pod Install' :
                               buildInfo.type === 'build_infra_ios' ? 'Build Infra iOS' :
                               buildInfo.type === 'build_ios' ? 'iOS Build' :
                               buildInfo.type === 'build_android' ? 'Android Build' :
                               buildInfo.type.replace(/_/g, ' ')

            // Fetch the buffered output from the backend
            const bufferedOutput = await window.etz.getBuildOutput(label, buildInfo.type)

            if (isMainBuild) {
              setBuilding(true)
              setShowOutput(true)
              // If we have buffered output, show it. Otherwise show reconnection message.
              if (bufferedOutput && bufferedOutput.length > 0) {
                setBuildOutput(bufferedOutput)
              } else {
                setBuildOutput([`${actionName} in progress... (reconnected, waiting for output)`])
              }
            } else if (isFixAction) {
              // It's a fix action - show progress but don't block the main build button
              setFixingAction(buildInfo.type)
              setShowOutput(true)
              // If we have buffered output, show it. Otherwise show reconnection message.
              if (bufferedOutput && bufferedOutput.length > 0) {
                setBuildOutput(bufferedOutput)
              } else {
                setBuildOutput([`${actionName} in progress... (reconnected, waiting for output)`])
              }
            }

            return true // Found an active build
          }
          return false // No active build
        } catch (error) {
          // Ignore error if API doesn't exist or fails
          return false
        }
      }

      // Check for existing build first, only run preconditions if no build is active
      const runChecks = async () => {
        const hasActiveBuild = await checkExistingBuild()

        // Only check pre-conditions if there's no active build
        if (!hasActiveBuild) {
          checkPreConditions()
        }
      }

      runChecks()

      // Subscribe to build progress
      window.etz.onBuildProgress((progress: BuildProgress) => {
        // Only process progress events for this worktree
        if (progress.label === label) {
          setBuildProgress(progress)
          setBuildOutput(prev => [...prev, `[${progress.stage}] ${progress.message}`])

          // Detect when fix actions complete
          if (progress.progress === 100 && (progress.stage === 'pod_install' || progress.stage === 'build_infra')) {
            // Re-check conditions after fix action completes
            setTimeout(() => {
              setFixingAction(null)
              checkPreConditions()
            }, 500)
          }
        }
      })

      return () => {
        window.etz.offBuildProgress()
      }
    } else {
      // Reset state when dialog closes
      setBuildOutput([])
      setBuildProgress(null)
      setBuildComplete(false)
      setBuildSuccess(false)
    }
  }, [open, label, platform, repo])

  // Auto-expand output only on errors (only if it was never manually collapsed)
  const [manuallyCollapsed, setManuallyCollapsed] = useState(false)

  useEffect(() => {
    // Only auto-expand if there's an error or build failed
    if (!manuallyCollapsed && !buildSuccess && buildComplete) {
      setShowOutput(true)
    }
  }, [buildSuccess, buildComplete, manuallyCollapsed])

  // Auto-follow output state
  const [autoFollow, setAutoFollow] = useState(true)

  // Auto-scroll to bottom when new output arrives (only if auto-follow is enabled)
  useEffect(() => {
    if (autoFollow && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [buildOutput, autoFollow])

  // Detect when user manually scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50

    // If user scrolls away from bottom, disable auto-follow
    // If user scrolls back to bottom, re-enable auto-follow
    setAutoFollow(isAtBottom)
  }

  const checkPreConditions = async () => {
    setChecking(true)
    setConditions([])
    setReady(false)

    try {
      const result = await window.etz.checkBuildPreConditions(label, platform, repo)
      setConditions(result.conditions)
      setReady(result.ready)
    } catch (error) {
      console.error('Failed to check pre-conditions:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleAutoFix = async (fixAction: string) => {
    setFixingAction(fixAction)
    setShowOutput(true)  // Show the output section

    // Set initial message based on action type
    const actionName = fixAction === 'pod_install' ? 'Pod Install' :
                       fixAction === 'build_infra_ios' ? 'Build Infra iOS' :
                       fixAction.replace(/_/g, ' ')

    setBuildOutput([`Starting ${actionName}...`])
    setBuildProgress({
      label,
      stage: fixAction as any,
      progress: 0,
      message: `Starting ${actionName}...`,
      timestamp: Date.now()
    })

    try {
      let result

      switch (fixAction) {
        case 'pod_install':
          result = await window.etz.runPodInstall(label)
          break
        case 'build_infra_ios':
          result = await window.etz.buildInfraIOS(label)
          break
        // Add more fix actions as needed
        default:
          console.warn('Unknown fix action:', fixAction)
          return
      }

      // Always re-check conditions after any action, whether it succeeded or failed
      await checkPreConditions()

      if (!result.success) {
        setErrorDialog({
          title: 'Auto-fix Failed',
          message: result.error || 'Unknown error occurred during auto-fix'
        })
      }
    } catch (error: any) {
      setErrorDialog({
        title: 'Auto-fix Failed',
        message: error.message || 'An unexpected error occurred'
      })
      // Still re-check conditions even on error
      await checkPreConditions()
    } finally {
      setFixingAction(null)
    }
  }

  const handleBuild = async () => {
    setBuilding(true)
    setBuildComplete(false)
    setBuildOutput([])
    setBuildProgress(null)

    try {
      let result

      if (platform === 'ios') {
        result = await window.etz.buildIOS(label)
      } else {
        result = await window.etz.buildAndroid(label)
      }

      setBuildSuccess(result.success)
      setBuildComplete(true)

      if (!result.success) {
        setBuildOutput(prev => [...prev, `\nBuild failed: ${result.error}`])
        setShowOutput(true)
      }
    } catch (error: any) {
      setBuildSuccess(false)
      setBuildComplete(true)
      setBuildOutput(prev => [...prev, `\nBuild error: ${error.message}`])
      setShowOutput(true)
    } finally {
      setBuilding(false)
    }
  }

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: 'pass' | 'fail' | 'warning') => {
    const variants: Record<string, string> = {
      pass: 'bg-green-500/10 text-green-500 border-green-500/20',
      fail: 'bg-red-500/10 text-red-500 border-red-500/20',
      warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    }

    return (
      <Badge variant="outline" className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  const getFixActionLabel = (fixAction: string) => {
    switch (fixAction) {
      case 'pod_install':
        return 'Run Pod Install'
      case 'build_infra_ios':
        return 'Build Infra'
      default:
        return 'Fix'
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Allow closing at any time - user can reconnect to build later
      if (!newOpen) {
        onClose()
      }
    }}>
      <DialogContent theme={theme} className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col p-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <DialogHeader className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm py-4 px-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-2">
              Build {repo} ({platform.toUpperCase()})
              <Badge variant="outline" className="ml-2">
                {label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {onOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpen}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 h-8 w-8 flex-shrink-0"
                  title="Open in editor"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              {repoPath && onOpenTerminal && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenTerminal(repoPath)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 h-8 w-8 flex-shrink-0"
                  title="Open terminal"
                >
                  <Terminal className="w-4 h-4" />
                </Button>
              )}
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 h-8 w-8 flex-shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto overflow-x-hidden px-6 py-4 flex-1">

        <div className="space-y-4">
          {/* Pre-conditions Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Pre-conditions</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={checkPreConditions}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Re-check'
                )}
              </Button>
            </div>

            {conditions.length === 0 && !checking && (
              <Card className="p-3 text-center text-sm text-muted-foreground">
                Click "Re-check" to verify build pre-conditions
              </Card>
            )}

            {/* Compact Table View */}
            {conditions.length > 0 && (
              <Card className="overflow-hidden">
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {conditions.map((condition) => (
                    <div
                      key={condition.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {getStatusIcon(condition.status)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{condition.name}</span>
                          {getStatusBadge(condition.status)}
                        </div>
                        {(condition.status === 'fail' || condition.status === 'warning') && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {condition.message}
                          </p>
                        )}
                      </div>

                      {condition.canAutoFix && condition.fixAction && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAutoFix(condition.fixAction!)}
                          disabled={fixingAction === condition.fixAction}
                          className="flex-shrink-0 h-7 text-xs"
                        >
                          {fixingAction === condition.fixAction ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Fixing
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3 h-3 mr-1" />
                              {getFixActionLabel(condition.fixAction)}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Ready to Build Indicator - More Compact */}
            {conditions.length > 0 && !building && !buildComplete && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${ready ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                {ready ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">Ready to build!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">Fix issues above before building</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Build Progress Section */}
          {(building || buildComplete || fixingAction || buildOutput.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold">
                {fixingAction ? 'Running Action' : 'Build Progress'}
              </h3>

              {buildProgress && (
                <Card className="p-3 transition-all duration-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate max-w-[70%]">
                        {buildProgress.stage.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        {buildProgress.progress}%
                      </span>
                    </div>

                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${buildProgress.progress}%` }}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground font-mono leading-relaxed overflow-hidden min-h-12">
                      <p className="break-all line-clamp-2">
                        {buildProgress.message}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {buildComplete && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${buildSuccess ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  {buildSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">Build completed successfully!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">Build failed</span>
                    </>
                  )}
                </div>
              )}

              {/* Build Output Terminal - Collapsed by Default */}
              <Card className="p-3">
                <button
                  onClick={() => {
                    const newShowOutput = !showOutput
                    setShowOutput(newShowOutput)
                    // Track if user manually collapsed it
                    if (!newShowOutput) {
                      setManuallyCollapsed(true)
                    }
                  }}
                  className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5" />
                    Build Output
                    {buildOutput.length > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {buildOutput.length} lines
                      </Badge>
                    )}
                  </span>
                  {showOutput ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {showOutput && (
                  <div className="relative">
                    <div
                      ref={outputRef}
                      onScroll={handleScroll}
                      className="mt-2 bg-black/95 rounded-md p-2.5 max-h-80 overflow-y-auto overflow-x-auto border border-green-500/20"
                    >
                      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                        {buildOutput.length > 0 ? buildOutput.join('\n') : '⚡ Waiting for output...'}
                      </pre>
                    </div>

                    {/* Jump to Bottom Button - appears when user has scrolled away */}
                    {!autoFollow && (
                      <button
                        onClick={() => {
                          if (outputRef.current) {
                            outputRef.current.scrollTop = outputRef.current.scrollHeight
                            setAutoFollow(true)
                          }
                        }}
                        className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        <ArrowDown className="w-3 h-3" />
                        Jump to Bottom
                      </button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>

            <Button
              onClick={handleBuild}
              disabled={!ready || building || fixingAction !== null}
            >
              {building ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Build
                </>
              )}
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Error Dialog */}
    {errorDialog && (
      <Dialog open={!!errorDialog} onOpenChange={() => setErrorDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="w-5 h-5" />
              {errorDialog.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4 max-h-96 overflow-y-auto overflow-x-auto">
              <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap break-all">
                {errorDialog.message}
              </pre>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setErrorDialog(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
  </>
  )
}
