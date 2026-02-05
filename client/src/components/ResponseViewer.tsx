/*
 * Response Data Visualization Component
 * Displays and analyzes API response data from stress tests
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { 
  FileJson, 
  BarChart3, 
  PieChartIcon, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type { RequestResult, TestMetrics } from '@/hooks/useStressTest';

interface ResponseViewerProps {
  logs: RequestResult[];
  metrics: TestMetrics;
}

// Color palette for charts
const COLORS = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  chart: ['#00d4ff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
};

export function ResponseViewer({ logs, metrics }: ResponseViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<RequestResult | null>(null);

  // Calculate response time distribution
  const latencyDistribution = useMemo(() => {
    if (logs.length === 0) return [];
    
    const ranges = [
      { name: '0-100ms', min: 0, max: 100, count: 0 },
      { name: '100-300ms', min: 100, max: 300, count: 0 },
      { name: '300-500ms', min: 300, max: 500, count: 0 },
      { name: '500-1000ms', min: 500, max: 1000, count: 0 },
      { name: '1-2s', min: 1000, max: 2000, count: 0 },
      { name: '2-5s', min: 2000, max: 5000, count: 0 },
      { name: '>5s', min: 5000, max: Infinity, count: 0 },
    ];

    logs.forEach(log => {
      const range = ranges.find(r => log.duration >= r.min && log.duration < r.max);
      if (range) range.count++;
    });

    return ranges.filter(r => r.count > 0);
  }, [logs]);

  // Calculate status code distribution for pie chart
  const statusCodeData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = [];
    
    Object.entries(metrics.statusCodes).forEach(([code, count]) => {
      const codeNum = parseInt(code);
      let color = COLORS.info;
      if (codeNum >= 200 && codeNum < 300) color = COLORS.success;
      else if (codeNum >= 400 && codeNum < 500) color = COLORS.warning;
      else if (codeNum >= 500 || codeNum === 0) color = COLORS.error;
      
      data.push({ name: code === '0' ? '网络错误' : code, value: count, color });
    });

    return data;
  }, [metrics.statusCodes]);

  // Calculate error types distribution
  const errorTypes = useMemo(() => {
    const errors: Record<string, number> = {};
    
    logs.filter(l => !l.success).forEach(log => {
      const errorType = log.error || `HTTP ${log.status}`;
      errors[errorType] = (errors[errorType] || 0) + 1;
    });

    return Object.entries(errors)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [logs]);

  // Calculate response time scatter data
  const scatterData = useMemo(() => {
    return logs.slice(-200).map((log, index) => ({
      x: index,
      y: log.duration,
      status: log.success ? 'success' : 'error',
    }));
  }, [logs]);

  // Export response data
  const handleExportData = () => {
    const exportData = {
      summary: {
        totalRequests: metrics.completedRequests,
        successCount: metrics.successCount,
        failCount: metrics.failCount,
        avgLatency: metrics.avgLatency,
        minLatency: metrics.minLatency,
        maxLatency: metrics.maxLatency,
        p50: metrics.p50Latency,
        p90: metrics.p90Latency,
        p95: metrics.p95Latency,
        p99: metrics.p99Latency,
        errorRate: metrics.errorRate,
        throughput: metrics.throughput,
      },
      statusCodes: metrics.statusCodes,
      latencyDistribution,
      errorTypes,
      rawLogs: logs.slice(-1000), // Export last 1000 logs
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stress-test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (logs.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="w-4 h-4 text-primary" />
            响应数据分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            <p>暂无测试数据，请先运行压力测试</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-card border-border transition-all ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="w-4 h-4 text-primary" />
            响应数据分析
            <Badge variant="secondary" className="ml-2">
              {logs.length} 条记录
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExportData}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted mb-4">
            <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
            <TabsTrigger value="latency" className="text-xs">延迟分布</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs">错误分析</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">时间线</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Success/Fail Pie Chart */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <PieChartIcon className="w-3 h-3" />
                  成功/失败比例
                </h4>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '成功', value: metrics.successCount, color: COLORS.success },
                        { name: '失败', value: metrics.failCount, color: COLORS.error },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      <Cell fill={COLORS.success} />
                      <Cell fill={COLORS.error} />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Status Code Distribution */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  状态码分布
                </h4>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusCodeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusCodeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Key Metrics Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-mono font-bold text-primary">{metrics.avgLatency}</div>
                <div className="text-xs text-muted-foreground">平均延迟 (ms)</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-mono font-bold text-chart-3">{metrics.p95Latency}</div>
                <div className="text-xs text-muted-foreground">P95延迟 (ms)</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-mono font-bold text-chart-4">{metrics.throughput}</div>
                <div className="text-xs text-muted-foreground">吞吐量 (req/s)</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className={`text-2xl font-mono font-bold ${metrics.errorRate > 5 ? 'text-destructive' : 'text-chart-3'}`}>
                  {metrics.errorRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">错误率</div>
              </div>
            </div>
          </TabsContent>

          {/* Latency Distribution Tab */}
          <TabsContent value="latency" className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                响应时间分布
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={latencyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value} 请求`, '数量']}
                  />
                  <Bar dataKey="count" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Percentile breakdown */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Min', value: metrics.minLatency },
                { label: 'P50', value: metrics.p50Latency },
                { label: 'P90', value: metrics.p90Latency },
                { label: 'P95', value: metrics.p95Latency },
                { label: 'P99', value: metrics.p99Latency },
              ].map((item, index) => (
                <div key={item.label} className="bg-muted/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-mono font-bold" style={{ color: COLORS.chart[index] }}>
                    {item.value}ms
                  </div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            {errorTypes.length > 0 ? (
              <>
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    错误类型分布
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={errorTypes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        width={120}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" fill={COLORS.error} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Error list */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-xs text-muted-foreground mb-2">最近错误详情</h4>
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {logs.filter(l => !l.success).slice(-20).reverse().map((log, index) => (
                        <div 
                          key={`error-${log.id}-${log.timestamp}-${index}`}
                          className="flex items-center justify-between p-2 bg-destructive/10 rounded text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <XCircle className="w-3 h-3 text-destructive" />
                            <span className="font-mono">{log.error || `HTTP ${log.status}`}</span>
                          </div>
                          <span className="text-muted-foreground">{log.duration.toFixed(0)}ms</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 text-chart-3 mb-2" />
                <p>没有错误记录</p>
                <p className="text-xs">所有请求都成功完成</p>
              </div>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                响应时间散点图 (最近200个请求)
              </h4>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="请求序号"
                    tick={{ fill: '#ffffff', fontSize: 12, fontWeight: 500 }}
                    axisLine={{ stroke: '#ffffff', strokeWidth: 1 }}
                    tickLine={{ stroke: '#ffffff' }}
                    label={{ value: '请求序号', position: 'bottom', fill: '#ffffff', fontSize: 12, offset: 0 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="延迟"
                    unit="ms"
                    tick={{ fill: '#ffffff', fontSize: 12, fontWeight: 500 }}
                    axisLine={{ stroke: '#ffffff', strokeWidth: 1 }}
                    tickLine={{ stroke: '#ffffff' }}
                    label={{ value: '延迟 (ms)', angle: -90, position: 'insideLeft', fill: '#ffffff', fontSize: 12 }}
                    width={60}
                  />
                  <ZAxis range={[30, 30]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === '延迟') return [`${value.toFixed(0)}ms`, name];
                      return [value, name];
                    }}
                  />
                  <Scatter 
                    data={scatterData.filter(d => d.status === 'success')} 
                    fill={COLORS.success}
                    name="成功"
                  />
                  <Scatter 
                    data={scatterData.filter(d => d.status === 'error')} 
                    fill={COLORS.error}
                    name="失败"
                  />
                  <Legend />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Recent requests list */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs text-muted-foreground mb-2">最近请求记录</h4>
              <ScrollArea className="h-40">
                <div className="space-y-1">
                  {logs.slice(-30).reverse().map((log, index) => (
                    <div 
                      key={`recent-${log.id}-${log.timestamp}-${index}`}
                      className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer hover:bg-muted/50 ${
                        log.success ? 'bg-chart-3/10' : 'bg-destructive/10'
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle2 className="w-3 h-3 text-chart-3" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive" />
                        )}
                        <span className="font-mono">
                          {log.status === 0 ? 'ERR' : log.status}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className={`font-mono ${log.duration > 1000 ? 'text-chart-4' : ''}`}>
                        {log.duration.toFixed(0)}ms
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
