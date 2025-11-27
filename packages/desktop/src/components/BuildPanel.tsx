import { useState, useEffect, useRef } from 'react'
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

interface BuildPanelProps {
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

export function BuildPanel({ open, onClose, label, platform, repo, repoPath, onOpenTerminal, onOpen, theme = 'dark' }: BuildPanelProps) {
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
    const [manuallyCollapsed, setManuallyCollapsed] = useState(false)
    const [autoFollow, setAutoFollow] = useState(true)

    // Check pre-conditions when panel opens
    useEffect(() => {
        if (open) {
            // Reset all state when panel opens
            setBuildOutput([])
            setBuildProgress(null)
            setBuildComplete(false)
            setBuildSuccess(false)
            setBuilding(false)
            setFixingAction(null)
            setShowOutput(false)
            setManuallyCollapsed(false)

            // Check if a build is already in progress
            const checkExistingBuild = async (): Promise<boolean> => {
                try {
                    const buildInfo = await window.etz.getActiveBuildInfo(label)
                    if (buildInfo) {
                        const isMainBuild = buildInfo.type === 'build_ios' || buildInfo.type === 'build_android'
                        const isFixAction = buildInfo.type === 'pod_install' || buildInfo.type === 'build_infra_ios'

                        const actionName = buildInfo.type === 'pod_install' ? 'Pod Install' :
                            buildInfo.type === 'build_infra_ios' ? 'Build Infra iOS' :
                                buildInfo.type === 'build_ios' ? 'iOS Build' :
                                    buildInfo.type === 'build_android' ? 'Android Build' :
                                        buildInfo.type.replace(/_/g, ' ')

                        const bufferedOutput = await window.etz.getBuildOutput(label, buildInfo.type)

                        if (isMainBuild) {
                            setBuilding(true)
                            setShowOutput(true)
                            if (bufferedOutput && bufferedOutput.length > 0) {
                                setBuildOutput(bufferedOutput)
                            } else {
                                setBuildOutput([`${actionName} in progress... (reconnected, waiting for output)`])
                            }
                        } else if (isFixAction) {
                            setFixingAction(buildInfo.type)
                            setShowOutput(true)
                            if (bufferedOutput && bufferedOutput.length > 0) {
                                setBuildOutput(bufferedOutput)
                            } else {
                                setBuildOutput([`${actionName} in progress... (reconnected, waiting for output)`])
                            }
                        }

                        return true
                    }
                    return false
                } catch (error) {
                    return false
                }
            }

            const runChecks = async () => {
                const hasActiveBuild = await checkExistingBuild()
                if (!hasActiveBuild) {
                    checkPreConditions()
                }
            }

            runChecks()

            // Subscribe to build progress
            window.etz.onBuildProgress((progress: BuildProgress) => {
                if (progress.label === label) {
                    // Ensure progress only increases (never decreases) for smoother UX
                    setBuildProgress(prev => {
                        if (!prev || progress.stage !== prev.stage) {
                            // New stage, accept the progress
                            return progress
                        }
                        // Same stage, only update if progress increased
                        if (progress.progress >= prev.progress) {
                            return progress
                        }
                        // Keep previous progress if new value is lower
                        return prev
                    })
                    setBuildOutput(prev => [...prev, `[${progress.stage}] ${progress.message}`])

                    if (progress.progress === 100 && (progress.stage === 'pod_install' || progress.stage === 'build_infra')) {
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
            setBuildOutput([])
            setBuildProgress(null)
            setBuildComplete(false)
            setBuildSuccess(false)
        }
    }, [open, label, platform, repo])

    // Auto-expand output on errors
    useEffect(() => {
        if (!manuallyCollapsed && !buildSuccess && buildComplete) {
            setShowOutput(true)
        }
    }, [buildSuccess, buildComplete, manuallyCollapsed])

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoFollow && outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [buildOutput, autoFollow])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50
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
        setShowOutput(true)

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
                default:
                    console.warn('Unknown fix action:', fixAction)
                    return
            }

            await checkPreConditions()

            if (!result.success) {
                setBuildOutput(prev => [...prev, `\n❌ Auto-fix failed: ${result.error || 'Unknown error occurred'}`])
                setShowOutput(true)
            }
        } catch (error: any) {
            setBuildOutput(prev => [...prev, `\n❌ Auto-fix error: ${error.message || 'An unexpected error occurred'}`])
            setShowOutput(true)
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
            {/* Slide-out Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-[500px] transform transition-transform duration-300 ease-in-out z-50 ${open ? 'translate-x-0' : 'translate-x-full'
                    } ${theme === 'dark' ? 'bg-slate-900 border-l border-slate-800' : 'bg-white border-l border-slate-200'} shadow-2xl flex flex-col`}
            >
                {/* Header */}
                <div className={`sticky top-0 z-10 backdrop-blur-sm py-4 px-6 border-b flex-shrink-0 ${theme === 'dark' ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className={`text-lg font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                Build {repo}
                            </h2>
                            <Badge variant="outline" className="flex-shrink-0">
                                {platform.toUpperCase()}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {onOpen && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onOpen}
                                    className={`h-8 w-8 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
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
                                    className={`h-8 w-8 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                    title="Open terminal"
                                >
                                    <Terminal className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className={`h-8 w-8 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        Worktree: {label}
                    </p>
                </div>

                {/* Content */}
                <div className="overflow-y-auto overflow-x-hidden px-6 py-4 flex-1">
                    <div className="space-y-4">
                        {/* Pre-conditions Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Pre-conditions</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={checkPreConditions}
                                    disabled={checking}
                                    className={theme === 'dark' ? 'border-slate-700 text-slate-300' : ''}
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
                                <Card className={`p-3 text-center text-sm ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'text-slate-600'}`}>
                                    Click "Re-check" to verify build pre-conditions
                                </Card>
                            )}

                            {conditions.length > 0 && (
                                <Card className={`overflow-hidden ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : ''}`}>
                                    <div className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-200'}`}>
                                        {conditions.map((condition) => (
                                            <div
                                                key={condition.id}
                                                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex-shrink-0">
                                                    {getStatusIcon(condition.status)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{condition.name}</span>
                                                        {getStatusBadge(condition.status)}
                                                    </div>
                                                    {(condition.status === 'fail' || condition.status === 'warning') && (
                                                        <p className={`text-xs mt-0.5 truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
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

                            {conditions.length > 0 && !building && !buildComplete && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${ready ? (theme === 'dark' ? 'bg-green-500/10 text-green-400' : 'bg-green-500/10 text-green-600') : (theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-500/10 text-red-600')}`}>
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
                                <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    {fixingAction ? 'Running Action' : 'Build Progress'}
                                </h3>

                                {buildProgress && (
                                    <Card className={`p-3 transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : ''}`}>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-sm font-medium truncate max-w-[70%] ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                                                    {buildProgress.stage.replace(/_/g, ' ').toUpperCase()}
                                                </span>
                                                <span className={`text-sm flex-shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    {buildProgress.progress}%
                                                </span>
                                            </div>

                                            <div className={`w-full rounded-full h-1.5 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                                <div
                                                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${buildProgress.progress}%` }}
                                                />
                                            </div>

                                            <div className={`text-xs font-mono leading-relaxed overflow-hidden min-h-12 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                <p className="break-all line-clamp-2">
                                                    {buildProgress.message}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {buildComplete && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${buildSuccess ? (theme === 'dark' ? 'bg-green-500/10 text-green-400' : 'bg-green-500/10 text-green-600') : (theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-500/10 text-red-600')}`}>
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

                                {/* Build Output Terminal */}
                                <Card className={`p-3 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : ''}`}>
                                    <button
                                        onClick={() => {
                                            const newShowOutput = !showOutput
                                            setShowOutput(newShowOutput)
                                            if (!newShowOutput) {
                                                setManuallyCollapsed(true)
                                            }
                                        }}
                                        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                                    >
                                        <span className={`text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
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
                    </div>
                </div>

                {/* Footer Actions */}
                <div className={`sticky bottom-0 flex-shrink-0 px-6 py-4 border-t ${theme === 'dark' ? 'bg-slate-900/95 border-slate-800 backdrop-blur-sm' : 'bg-white/95 border-slate-200 backdrop-blur-sm'}`}>
                    <div className="flex justify-between gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className={theme === 'dark' ? 'border-slate-700 text-slate-300' : ''}
                        >
                            Close
                        </Button>

                        <Button
                            onClick={handleBuild}
                            disabled={!ready || building || fixingAction !== null}
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0"
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

            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={onClose}
                />
            )}
        </>
    )
}
