/*
 * Ramp-up Preview Component
 * Shows a small preview chart of QPS over time based on ramp-up configuration
 */

import { useMemo } from 'react';
import type { RampUpConfig } from '@/hooks/useStressTest';

interface RampUpPreviewProps {
  rampUp: RampUpConfig;
  targetQps: number;
  testDuration: number;
}

export function RampUpPreview({ rampUp, targetQps, testDuration }: RampUpPreviewProps) {
  // Generate preview data points
  const previewData = useMemo(() => {
    if (!rampUp.enabled) return [];
    
    const points: { time: number; qps: number }[] = [];
    const rampUpDuration = rampUp.duration || 10;
    const startQps = rampUp.startQps || 1;
    const totalDuration = rampUpDuration + testDuration;
    
    // Generate points for the preview
    const numPoints = Math.min(50, totalDuration);
    const interval = totalDuration / numPoints;
    
    for (let t = 0; t <= totalDuration; t += interval) {
      let qps: number;
      
      if (t < rampUpDuration) {
        if (rampUp.mode === 'linear') {
          const progress = t / rampUpDuration;
          qps = startQps + (targetQps - startQps) * progress;
        } else {
          // Step mode
          const stepInterval = rampUp.stepInterval || 5;
          const stepSize = rampUp.stepSize || Math.ceil((targetQps - startQps) / (rampUpDuration / stepInterval));
          const steps = Math.floor(t / stepInterval);
          qps = Math.min(startQps + steps * stepSize, targetQps);
        }
      } else {
        qps = targetQps;
      }
      
      points.push({ time: Math.round(t), qps: Math.round(qps) });
    }
    
    return points;
  }, [rampUp, targetQps, testDuration]);

  if (!rampUp.enabled || previewData.length === 0) {
    return null;
  }

  // Calculate SVG dimensions
  const width = 200;
  const height = 60;
  const padding = { top: 5, right: 10, bottom: 15, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxTime = previewData[previewData.length - 1]?.time || 1;
  const maxQps = Math.max(targetQps, ...previewData.map(d => d.qps));
  const rampUpDuration = rampUp.duration || 10;

  // Generate path
  const pathData = previewData.map((point, i) => {
    const x = padding.left + (point.time / maxTime) * chartWidth;
    const y = padding.top + chartHeight - (point.qps / maxQps) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate area path
  const areaPath = pathData + 
    ` L ${padding.left + chartWidth} ${padding.top + chartHeight}` +
    ` L ${padding.left} ${padding.top + chartHeight} Z`;

  // Ramp-up phase end line position
  const rampUpEndX = padding.left + (rampUpDuration / maxTime) * chartWidth;

  return (
    <div className="mt-3 p-2 rounded-lg bg-background/50 border border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">QPS 递增预览</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary/60"></span>
            <span className="text-muted-foreground">递增</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-chart-3/60"></span>
            <span className="text-muted-foreground">稳定</span>
          </span>
        </div>
      </div>
      <svg width={width} height={height} className="w-full">
        <defs>
          <linearGradient id="rampUpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="stableGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        <line 
          x1={padding.left} 
          y1={padding.top + chartHeight} 
          x2={padding.left + chartWidth} 
          y2={padding.top + chartHeight} 
          stroke="#334155" 
          strokeWidth={1}
        />
        <line 
          x1={padding.left} 
          y1={padding.top} 
          x2={padding.left} 
          y2={padding.top + chartHeight} 
          stroke="#334155" 
          strokeWidth={1}
        />
        
        {/* Ramp-up phase background */}
        <rect
          x={padding.left}
          y={padding.top}
          width={rampUpEndX - padding.left}
          height={chartHeight}
          fill="#00d4ff"
          fillOpacity={0.05}
        />
        
        {/* Stable phase background */}
        <rect
          x={rampUpEndX}
          y={padding.top}
          width={padding.left + chartWidth - rampUpEndX}
          height={chartHeight}
          fill="#22c55e"
          fillOpacity={0.05}
        />
        
        {/* Phase separator line */}
        <line
          x1={rampUpEndX}
          y1={padding.top}
          x2={rampUpEndX}
          y2={padding.top + chartHeight}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        
        {/* Area fill */}
        <path d={areaPath} fill="url(#rampUpGradient)" />
        
        {/* Line */}
        <path d={pathData} fill="none" stroke="#00d4ff" strokeWidth={1.5} />
        
        {/* Y-axis labels */}
        <text x={padding.left - 3} y={padding.top + 3} fontSize={8} fill="#94a3b8" textAnchor="end">
          {maxQps}
        </text>
        <text x={padding.left - 3} y={padding.top + chartHeight} fontSize={8} fill="#94a3b8" textAnchor="end">
          0
        </text>
        
        {/* X-axis labels */}
        <text x={padding.left} y={height - 2} fontSize={8} fill="#94a3b8" textAnchor="start">
          0s
        </text>
        <text x={rampUpEndX} y={height - 2} fontSize={8} fill="#f59e0b" textAnchor="middle">
          {rampUpDuration}s
        </text>
        <text x={padding.left + chartWidth} y={height - 2} fontSize={8} fill="#94a3b8" textAnchor="end">
          {maxTime}s
        </text>
      </svg>
    </div>
  );
}
