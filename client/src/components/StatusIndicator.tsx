/*
 * Status Indicator Component
 * Mission Control Style - LED-style status lights and progress indicators
 */

import { cn } from '@/lib/utils';
import type { TestStatus, TestMetrics, RampUpConfig } from '@/hooks/useStressTest';
import { Activity, CheckCircle2, AlertCircle, XCircle, Pause, Circle, TrendingUp, Minus } from 'lucide-react';

interface StatusIndicatorProps {
  status: TestStatus;
  metrics: TestMetrics;
  rampUpConfig?: RampUpConfig;
  elapsedTime?: number;
}

export function StatusIndicator({ status, metrics, rampUpConfig, elapsedTime = 0 }: StatusIndicatorProps) {
  // Determine current phase for ramp-up mode
  const isRampUpEnabled = rampUpConfig?.enabled;
  const rampUpDuration = rampUpConfig?.duration || 10;
  const isInRampUpPhase = isRampUpEnabled && status === 'running' && elapsedTime < rampUpDuration;
  const isInStablePhase = isRampUpEnabled && status === 'running' && elapsedTime >= rampUpDuration;
  const rampUpProgress = isRampUpEnabled && elapsedTime < rampUpDuration 
    ? Math.min(100, (elapsedTime / rampUpDuration) * 100) 
    : 100;

  const statusConfig = {
    idle: {
      label: '就绪',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted-foreground/20',
      icon: Circle,
      lightClass: 'status-light-idle',
    },
    running: {
      label: '运行中',
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/20',
      icon: Activity,
      lightClass: 'status-light-running',
    },
    paused: {
      label: '已暂停',
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/20',
      icon: Pause,
      lightClass: 'status-light-warning',
    },
    completed: {
      label: '已完成',
      color: 'text-primary',
      bgColor: 'bg-primary/20',
      icon: CheckCircle2,
      lightClass: 'status-light-idle',
    },
    error: {
      label: '错误',
      color: 'text-destructive',
      bgColor: 'bg-destructive/20',
      icon: XCircle,
      lightClass: 'status-light-error',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Calculate progress
  const progress = metrics.totalRequests > 0
    ? (metrics.completedRequests / metrics.totalRequests) * 100
    : 0;

  return (
    <div className="data-card-highlight">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('status-light', config.lightClass)} />
          <div>
            <div className="flex items-center gap-2">
              <Icon className={cn('w-4 h-4', config.color)} />
              <span className={cn('font-semibold', config.color)}>{config.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {status === 'running' && `已运行 ${metrics.elapsedTime}s`}
              {status === 'completed' && `总耗时 ${metrics.elapsedTime}s`}
              {status === 'idle' && '等待开始测试'}
              {status === 'paused' && '测试已暂停'}
              {status === 'error' && '测试出错'}
            </p>
          </div>
        </div>

        {/* Progress Ring */}
        {(status === 'running' || status === 'completed') && metrics.totalRequests > 0 && (
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="oklch(0.28 0.04 250)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="oklch(0.75 0.15 195)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono text-primary">
                {progress.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {(status === 'running' || status === 'paused') && metrics.totalRequests > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>进度</span>
            <span>{metrics.completedRequests.toLocaleString()} / {metrics.totalRequests.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Ramp-up Phase Indicator */}
      {isRampUpEnabled && status === 'running' && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isInRampUpPhase ? (
                <>
                  <TrendingUp className="w-4 h-4 text-chart-4 animate-pulse" />
                  <span className="text-sm font-medium text-chart-4">递增阶段</span>
                </>
              ) : (
                <>
                  <Minus className="w-4 h-4 text-chart-3" />
                  <span className="text-sm font-medium text-chart-3">稳定阶段</span>
                </>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {isInRampUpPhase 
                ? `${Math.round(rampUpProgress)}% (${Math.round(elapsedTime)}s / ${rampUpDuration}s)`
                : `已达到目标QPS`
              }
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isInRampUpPhase ? "bg-chart-4" : "bg-chart-3"
              )}
              style={{ width: `${rampUpProgress}%` }}
            />
          </div>
          {isInRampUpPhase && (
            <p className="text-xs text-muted-foreground mt-1">
              当前QPS: {metrics.currentQps} → 目标: {rampUpConfig?.startQps || 1} + ...
            </p>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-lg font-bold mono-number text-chart-3">
            {metrics.currentQps}
          </div>
          <div className="text-xs text-muted-foreground">当前 QPS</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold mono-number text-chart-4">
            {metrics.avgLatency}
          </div>
          <div className="text-xs text-muted-foreground">平均延迟 (ms)</div>
        </div>
        <div className="text-center">
          <div className={cn(
            'text-lg font-bold mono-number',
            metrics.errorRate > 10 ? 'text-destructive' :
            metrics.errorRate > 5 ? 'text-chart-4' :
            'text-chart-3'
          )}>
            {metrics.errorRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">错误率</div>
        </div>
      </div>
    </div>
  );
}
