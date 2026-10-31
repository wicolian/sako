'use client'

import { useMemo } from 'react'
import { 
  FileText, 
  Palette, 
  Shield, 
  Rocket, 
  BarChart3,
  Check,
  Lock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  type CampaignStage, 
  type CampaignProgress,
  type StageStatus,
  CAMPAIGN_STAGES,
  formatBlockerMessage,
} from '@/lib/campaigns/staged-flow'

// ============================================================================
// Icon Mapping
// ============================================================================

const STAGE_ICONS: Record<CampaignStage, typeof FileText> = {
  content: FileText,
  design: Palette,
  compliance: Shield,
  publish: Rocket,
  performance: BarChart3,
}

// ============================================================================
// Stage Step Component
// ============================================================================

interface StageStepProps {
  stage: StageStatus;
  config: typeof CAMPAIGN_STAGES[number];
  isActive: boolean;
  onClick: () => void;
}

function StageStep({ stage, config, isActive, onClick }: StageStepProps) {
  const Icon = STAGE_ICONS[stage.stage]
  
  const hasErrors = stage.blockers.some(b => b.severity === 'error')
  const hasWarnings = stage.blockers.some(b => b.severity === 'warning')

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={!stage.isUnlocked}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-lg transition-all min-w-[80px]",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
              stage.isUnlocked 
                ? "cursor-pointer hover:bg-muted"
                : "cursor-not-allowed opacity-50",
              isActive && "bg-primary/10 ring-2 ring-primary",
            )}
          >
            {/* Icon with status */}
            <div className={cn(
              "relative w-10 h-10 rounded-full flex items-center justify-center",
              stage.isComplete 
                ? "bg-emerald-500 text-white"
                : stage.isUnlocked
                  ? isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                  : "bg-muted/50 text-muted-foreground/50"
            )}>
              {stage.isComplete ? (
                <Check className="h-5 w-5" />
              ) : !stage.isUnlocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
              
              {/* Warning/Error indicator */}
              {stage.isUnlocked && (hasErrors || hasWarnings) && (
                <div className={cn(
                  "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                  hasErrors ? "bg-red-500" : "bg-amber-500"
                )}>
                  <AlertTriangle className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>

            {/* Stage name */}
            <span className={cn(
              "text-xs font-medium",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {config.name}
            </span>

            {/* Progress bar */}
            {stage.isUnlocked && !stage.isComplete && (
              <div className="w-full">
                <Progress value={stage.progress} className="h-1" />
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <p className="font-medium">{config.name}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          {!stage.isUnlocked && (
            <p className="text-xs text-amber-500 mt-1">
              Complete {config.requiredStages.join(' and ')} first
            </p>
          )}
          {stage.blockers.length > 0 && (
            <p className={cn(
              "text-xs mt-1",
              hasErrors ? "text-red-500" : "text-amber-500"
            )}>
              {formatBlockerMessage(stage.blockers)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Connector Line
// ============================================================================

function StageConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="flex items-center px-1">
      <div className={cn(
        "h-0.5 w-8",
        isComplete ? "bg-emerald-500" : "bg-muted"
      )} />
      <ChevronRight className={cn(
        "h-4 w-4 -ml-1",
        isComplete ? "text-emerald-500" : "text-muted-foreground"
      )} />
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface StagedProgressProps {
  progress: CampaignProgress;
  activeStage: CampaignStage;
  onStageChange: (stage: CampaignStage) => void;
  className?: string;
}

export function StagedProgress({
  progress,
  activeStage,
  onStageChange,
  className,
}: StagedProgressProps) {
  const stageConfigs = useMemo(() => {
    return progress.stages.map(s => ({
      status: s,
      config: CAMPAIGN_STAGES.find(c => c.id === s.stage)!,
    }))
  }, [progress.stages])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress stages */}
      <div className="flex items-center justify-center">
        {stageConfigs.map((item, index) => (
          <div key={item.status.stage} className="flex items-center">
            <StageStep
              stage={item.status}
              config={item.config}
              isActive={activeStage === item.status.stage}
              onClick={() => item.status.isUnlocked && onStageChange(item.status.stage)}
            />
            {index < stageConfigs.length - 1 && (
              <StageConnector isComplete={item.status.isComplete} />
            )}
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Overall Progress</span>
          <Badge variant={progress.overallProgress >= 80 ? "default" : "secondary"}>
            {progress.overallProgress}%
          </Badge>
        </div>

        {progress.canPublish ? (
          <Badge className="bg-emerald-500">Ready to Publish</Badge>
        ) : progress.blockers.length > 0 ? (
          <Badge variant="destructive">
            {progress.blockers.length} blocker{progress.blockers.length === 1 ? '' : 's'}
          </Badge>
        ) : (
          <Badge variant="secondary">In Progress</Badge>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Compact Variant
// ============================================================================

interface CompactStagedProgressProps {
  progress: CampaignProgress;
  className?: string;
}

export function CompactStagedProgress({ progress, className }: CompactStagedProgressProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {progress.stages.map((stage) => {
        const Icon = STAGE_ICONS[stage.stage]
        const hasError = stage.blockers.some(b => b.severity === 'error')
        
        return (
          <TooltipProvider key={stage.stage}>
            <Tooltip>
              <TooltipTrigger>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  stage.isComplete
                    ? "bg-emerald-500 text-white"
                    : hasError
                      ? "bg-destructive/10 text-red-500"
                      : stage.isUnlocked
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted/50 text-muted-foreground/50"
                )}>
                  {stage.isComplete ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {CAMPAIGN_STAGES.find(c => c.id === stage.stage)?.name}
                  {stage.isComplete && ' (Complete)'}
                  {hasError && ' (Has blockers)'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}

// ============================================================================
// Stage Content Wrapper
// ============================================================================

interface StageContentProps {
  stage: CampaignStage;
  status: StageStatus;
  children: React.ReactNode;
  className?: string;
}

export function StageContent({ stage, status, children, className }: StageContentProps) {
  const config = CAMPAIGN_STAGES.find(c => c.id === stage)
  
  if (!status.isUnlocked) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}>
        <Lock className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="font-medium text-muted-foreground">Stage Locked</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Complete {config?.requiredStages.join(' and ')} to unlock this stage
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Stage header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">{config?.name}</h2>
          <p className="text-sm text-muted-foreground">{config?.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{status.progress}% complete</p>
            {status.blockers.length > 0 && (
              <p className={cn(
                "text-xs",
                status.blockers.some(b => b.severity === 'error')
                  ? "text-red-500"
                  : "text-amber-500"
              )}>
                {status.blockers.length} issue{status.blockers.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <Progress value={status.progress} className="w-24 h-2" />
        </div>
      </div>

      {/* Blockers */}
      {status.blockers.length > 0 && (
        <div className="mb-6 space-y-2">
          {status.blockers.map((blocker, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                blocker.severity === 'error'
                  ? "bg-red-50 text-destructive border border-red-200"
                  : "bg-amber-50 text-amber-500 border border-amber-200"
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {blocker.message}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  )
}
