/*
 * API Stress Tester - Main Page
 * Design Style: Mission Control (控制中心风格)
 * - Deep navy background for professional stability
 * - Electric cyan accent for active states
 * - Three-column layout: Config | Monitor | Status
 */

import { useStressTest } from '@/hooks/useStressTest';
import { ConfigPanel } from '@/components/ConfigPanel';
import { MetricCard, MetricGrid, LargeMetric } from '@/components/MetricCard';
import { QpsChart, LatencyChart, ErrorRateChart, StatusCodeChart, LatencyDistribution, SuccessRatePie } from '@/components/Charts';
import { LogPanel } from '@/components/LogPanel';
import { StatusIndicator } from '@/components/StatusIndicator';
import { 
  Activity, 
  Zap, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Timer,
  TrendingUp,
  BarChart3,
  Gauge
} from 'lucide-react';

export default function Home() {
  const {
    status,
    metrics,
    timeSeries,
    logs,
    startTest,
    stopTest,
    pauseTest,
    resumeTest,
    resetTest,
  } = useStressTest();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Configuration */}
      <ConfigPanel
        onStart={startTest}
        onStop={stopTest}
        onPause={pauseTest}
        onResume={resumeTest}
        onReset={resetTest}
        status={status}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">API 压力测试工具</h1>
              <p className="text-xs text-muted-foreground">实时监控 · 性能分析</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>并发限制:</span>
              <span className="font-mono text-primary">100</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>限流:</span>
              <span className="font-mono text-primary">1000 QPS</span>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Row - Key Metrics */}
          <MetricGrid>
            <MetricCard
              title="总请求数"
              value={metrics.completedRequests}
              icon={<Activity className="w-4 h-4" />}
              status={status === 'running' ? 'success' : 'normal'}
            />
            <MetricCard
              title="成功请求"
              value={metrics.successCount}
              icon={<CheckCircle2 className="w-4 h-4" />}
              status="success"
            />
            <MetricCard
              title="失败请求"
              value={metrics.failCount}
              icon={<XCircle className="w-4 h-4" />}
              status={metrics.failCount > 0 ? 'danger' : 'normal'}
            />
            <MetricCard
              title="吞吐量"
              value={metrics.throughput}
              unit="req/s"
              icon={<TrendingUp className="w-4 h-4" />}
              status={status === 'running' ? 'success' : 'normal'}
            />
          </MetricGrid>

          {/* Second Row - Latency Metrics */}
          <MetricGrid>
            <MetricCard
              title="平均延迟"
              value={metrics.avgLatency}
              unit="ms"
              icon={<Timer className="w-4 h-4" />}
              status={metrics.avgLatency > 1000 ? 'danger' : metrics.avgLatency > 500 ? 'warning' : 'normal'}
            />
            <MetricCard
              title="最小延迟"
              value={metrics.minLatency}
              unit="ms"
              icon={<Clock className="w-4 h-4" />}
            />
            <MetricCard
              title="最大延迟"
              value={metrics.maxLatency}
              unit="ms"
              icon={<Clock className="w-4 h-4" />}
              status={metrics.maxLatency > 2000 ? 'warning' : 'normal'}
            />
            <MetricCard
              title="P99延迟"
              value={metrics.p99Latency}
              unit="ms"
              icon={<BarChart3 className="w-4 h-4" />}
              status={metrics.p99Latency > 1500 ? 'warning' : 'normal'}
            />
          </MetricGrid>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <QpsChart data={timeSeries} />
            <LatencyChart data={timeSeries} />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ErrorRateChart data={timeSeries} />
            <StatusCodeChart statusCodes={metrics.statusCodes} />
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LatencyDistribution metrics={metrics} />
            <SuccessRatePie successCount={metrics.successCount} failCount={metrics.failCount} />
          </div>

          {/* Log Panel */}
          <LogPanel logs={logs} />
        </main>
      </div>

      {/* Right Panel - Status */}
      <div className="w-72 border-l border-border bg-sidebar p-4 space-y-4 overflow-y-auto">
        <StatusIndicator status={status} metrics={metrics} />

        {/* Detailed Latency Stats */}
        <div className="data-card">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            延迟百分位
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">P50</span>
              <span className="font-mono text-sm text-primary">{metrics.p50Latency}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">P90</span>
              <span className="font-mono text-sm text-chart-3">{metrics.p90Latency}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">P95</span>
              <span className="font-mono text-sm text-chart-4">{metrics.p95Latency}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">P99</span>
              <span className="font-mono text-sm text-destructive">{metrics.p99Latency}ms</span>
            </div>
          </div>
        </div>

        {/* Status Codes Summary */}
        <div className="data-card">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            状态码统计
          </h3>
          <div className="space-y-2">
            {Object.entries(metrics.statusCodes).length > 0 ? (
              Object.entries(metrics.statusCodes)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([code, count]) => (
                  <div key={code} className="flex justify-between items-center">
                    <span className={`text-sm font-mono ${getStatusCodeColor(parseInt(code))}`}>
                      {code}
                    </span>
                    <span className="font-mono text-sm text-foreground">{count.toLocaleString()}</span>
                  </div>
                ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">暂无数据</p>
            )}
          </div>
        </div>

        {/* Test Info */}
        <div className="data-card">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            测试信息
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">运行时间</span>
              <span className="font-mono">{metrics.elapsedTime}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">错误率</span>
              <span className={`font-mono ${metrics.errorRate > 10 ? 'text-destructive' : metrics.errorRate > 5 ? 'text-chart-4' : 'text-chart-3'}`}>
                {metrics.errorRate.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">当前QPS</span>
              <span className="font-mono text-primary">{metrics.currentQps}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-chart-3';
  if (code >= 300 && code < 400) return 'text-primary';
  if (code >= 400 && code < 500) return 'text-chart-4';
  if (code >= 500) return 'text-destructive';
  return 'text-muted-foreground';
}
