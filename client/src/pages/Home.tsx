/*
 * API Stress Tester - Main Page
 * Design Style: Mission Control (控制中心风格)
 * - Deep navy background for professional stability
 * - Electric cyan accent for active states
 * - Three-column layout: Config | Monitor | Status
 */

import { useState } from 'react';
import { useStressTest } from '@/hooks/useStressTest';
import { ConfigPanel } from '@/components/ConfigPanel';
import { MetricCard, MetricGrid } from '@/components/MetricCard';
import { QpsChart, LatencyChart, ErrorRateChart, StatusCodeChart, LatencyDistribution, SuccessRatePie } from '@/components/Charts';
import { LogPanel } from '@/components/LogPanel';
import { StatusIndicator } from '@/components/StatusIndicator';
import { ResponseViewer } from '@/components/ResponseViewer';
import { AIAnalysis } from '@/components/AIAnalysis';
import { ReportExport } from '@/components/ReportExport';
import { TestHistory } from '@/components/TestHistory';
import { CompareAnalysis } from '@/components/CompareAnalysis';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { 
  Activity, 
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
    currentConfig,
  } = useStressTest();

  
  // AI Analysis result for report export
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  
  // History and comparison
  const [compareRecords, setCompareRecords] = useState<any[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  
  // Save test record mutation
  const saveRecordMutation = trpc.testRecords.create.useMutation({
    onSuccess: () => {
      toast.success('测试记录已保存');
    },
    onError: (error: { message: string }) => {
      toast.error('保存失败: ' + error.message);
    },
  });
  
  const handleSaveRecord = () => {
    if (metrics.completedRequests === 0) {
      toast.error('暂无测试数据可保存');
      return;
    }
    
    saveRecordMutation.mutate({
      name: `测试_${new Date().toLocaleString('zh-CN').replace(/[\/:]/g, '-')}`,
      url: currentConfig?.url || 'unknown',
      method: currentConfig?.method || 'POST',
      totalRequests: metrics.completedRequests,
      successCount: metrics.successCount,
      failCount: metrics.failCount,
      avgLatency: metrics.avgLatency,
      minLatency: metrics.minLatency,
      maxLatency: metrics.maxLatency,
      p50Latency: metrics.p50Latency,
      p90Latency: metrics.p90Latency,
      p95Latency: metrics.p95Latency,
      p99Latency: metrics.p99Latency,
      throughput: metrics.throughput,
      errorRate: metrics.errorRate,
      duration: metrics.elapsedTime,
      status: status === 'completed' ? 'completed' : status === 'error' ? 'failed' : 'cancelled',
    });
  };
  
  const handleCompare = (records: any[]) => {
    setCompareRecords(records);
    setIsCompareOpen(true);
  };

  const isIdle = status === 'idle' || status === 'completed' || status === 'error';

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
        <header className="border-b border-border px-4 py-2 bg-card/50">
          <div className="flex items-center justify-between">
            {/* Left: Title */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold">API 压力测试工具</h1>
                <p className="text-xs text-muted-foreground">实时监控 · 性能分析</p>
              </div>
            </div>
            
            {/* Right: Actions and Settings */}
            <div className="flex items-center gap-2 text-sm">
              {/* Action Buttons */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveRecord}
                disabled={metrics.completedRequests === 0 || saveRecordMutation.isPending}
                className="gap-1 h-7 px-2 text-xs"
              >
                <Save className="w-3 h-3" />
                保存
              </Button>
              
              <TestHistory onCompare={handleCompare} />
              
              <ReportExport 
                metrics={metrics} 
                logs={logs} 
                timeSeries={timeSeries}
                aiAnalysis={aiAnalysisResult}
              />
              

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
            <StatusCodeChart statusCodes={metrics.statusCodes} businessCodes={metrics.businessCodes} useBusinessCode={true} />
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LatencyDistribution metrics={metrics} />
            <SuccessRatePie successCount={metrics.successCount} failCount={metrics.failCount} />
          </div>

          {/* Response Data Visualization */}
          <ResponseViewer logs={logs} metrics={metrics} />

          {/* AI Analysis */}
          <AIAnalysis 
            metrics={metrics} 
            logs={logs}
          />

          {/* Log Panel */}
          <LogPanel logs={logs} />
        </main>
      </div>

      {/* Right Panel - Status */}
      <div className="w-72 border-l border-border bg-sidebar p-4 space-y-4 overflow-y-auto">
        <StatusIndicator 
          status={status} 
          metrics={metrics} 
          rampUpConfig={currentConfig?.rampUp}
          elapsedTime={metrics.elapsedTime}
        />

        {/* Detailed Latency Stats */}
        <div className="rounded-lg border border-border bg-card/50 p-4">
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

        {/* Business Code Summary - 业务状态码统计 */}
        <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
          <h3 className="text-xs text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            业务状态码 (code)
          </h3>
          <p className="text-xs text-muted-foreground mb-2">成功判断依据</p>
          <div className="space-y-2">
            {Object.entries(metrics.businessCodes).length > 0 ? (
              Object.entries(metrics.businessCodes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([code, count]) => (
                  <div key={code} className="flex justify-between items-center">
                    <span className={`text-sm font-mono ${code === '0' ? 'text-chart-3' : 'text-destructive'}`}>
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

        {/* HTTP Status Codes Summary - HTTP状态码统计 */}
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
            HTTP状态码
          </h3>
          <p className="text-xs text-muted-foreground mb-2">协议层响应</p>
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
        <div className="rounded-lg border border-border bg-card/50 p-4">
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
      
      {/* Compare Analysis Dialog */}
      <CompareAnalysis 
        records={compareRecords}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
      />
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
