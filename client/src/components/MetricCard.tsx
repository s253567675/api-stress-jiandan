/*
 * Metric Card Component
 * Mission Control Style - Glowing data cards with status indicators
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'normal' | 'warning' | 'danger' | 'success';
  subtitle?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  icon,
  status = 'normal',
  subtitle,
  className,
}: MetricCardProps) {
  const statusStyles = {
    normal: 'border-border',
    success: 'border-chart-3/50 glow-success',
    warning: 'border-chart-4/50 glow-warning',
    danger: 'border-destructive/50 glow-danger',
  };

  const valueStyles = {
    normal: 'text-foreground',
    success: 'text-chart-3',
    warning: 'text-chart-4',
    danger: 'text-destructive',
  };

  return (
    <div
      className={cn(
        'data-card border transition-all duration-300',
        statusStyles[status],
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <span className={cn('text-muted-foreground', status !== 'normal' && valueStyles[status])}>
            {icon}
          </span>
        )}
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-bold mono-number', valueStyles[status])}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

interface MetricGridProps {
  children: ReactNode;
  className?: string;
}

export function MetricGrid({ children, className }: MetricGridProps) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {children}
    </div>
  );
}

interface LargeMetricProps {
  title: string;
  value: string | number;
  unit?: string;
  status?: 'normal' | 'warning' | 'danger' | 'success';
  className?: string;
}

export function LargeMetric({ title, value, unit, status = 'normal', className }: LargeMetricProps) {
  const statusStyles = {
    normal: 'text-primary',
    success: 'text-chart-3',
    warning: 'text-chart-4',
    danger: 'text-destructive',
  };

  return (
    <div className={cn('text-center', className)}>
      <div className="flex items-baseline justify-center gap-2">
        <span className={cn('text-5xl font-bold mono-number', statusStyles[status])}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-xl text-muted-foreground">{unit}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wider">{title}</p>
    </div>
  );
}
