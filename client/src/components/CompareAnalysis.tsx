import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  GitCompare, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  X
} from 'lucide-react';

interface TestRecord {
  id: number;
  name: string;
  url: string;
  method: string;
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  duration: number;
  createdAt: Date;
}

interface CompareAnalysisProps {
  records: TestRecord[];
  isOpen: boolean;
  onClose: () => void;
}

// Color palette for different records
const COLORS = [
  '#00d4ff', // cyan
  '#ff6b6b', // red
  '#4ecdc4', // teal
  '#ffe66d', // yellow
  '#95e1d3', // mint
  '#f38181', // coral
];

export function CompareAnalysis({ records, isOpen, onClose }: CompareAnalysisProps) {
  if (records.length < 2) return null;

  // Prepare data for bar charts
  const latencyCompareData = [
    {
      name: '平均延迟',
      ...records.reduce((acc, r, i) => ({ ...acc, [r.name]: r.avgLatency }), {}),
    },
    {
      name: 'P50',
      ...records.reduce((acc, r, i) => ({ ...acc, [r.name]: r.p50Latency }), {}),
    },
    {
      name: 'P90',
      ...records.reduce((acc, r, i) => ({ ...acc, [r.name]: r.p90Latency }), {}),
    },
    {
      name: 'P95',
      ...records.reduce((acc, r, i) => ({ ...acc, [r.name]: r.p95Latency }), {}),
    },
    {
      name: 'P99',
      ...records.reduce((acc, r, i) => ({ ...acc, [r.name]: r.p99Latency }), {}),
    },
  ];

  const throughputCompareData = records.map(r => ({
    name: r.name.length > 15 ? r.name.substring(0, 15) + '...' : r.name,
    吞吐量: r.throughput,
    fullName: r.name,
  }));

  const successRateCompareData = records.map(r => ({
    name: r.name.length > 15 ? r.name.substring(0, 15) + '...' : r.name,
    成功率: r.totalRequests > 0 ? ((r.successCount / r.totalRequests) * 100).toFixed(1) : 0,
    fullName: r.name,
  }));

  // Prepare radar chart data - normalize values to 0-100 scale
  const maxValues = {
    throughput: Math.max(...records.map(r => r.throughput)),
    successRate: 100,
    avgLatency: Math.max(...records.map(r => r.avgLatency)),
    p99Latency: Math.max(...records.map(r => r.p99Latency)),
    totalRequests: Math.max(...records.map(r => r.totalRequests)),
  };

  const radarData = [
    { metric: '吞吐量', fullMark: 100 },
    { metric: '成功率', fullMark: 100 },
    { metric: '低延迟', fullMark: 100 },
    { metric: 'P99稳定性', fullMark: 100 },
    { metric: '请求量', fullMark: 100 },
  ].map(item => {
    const result: any = { ...item };
    records.forEach(r => {
      switch (item.metric) {
        case '吞吐量':
          result[r.name] = maxValues.throughput > 0 ? (r.throughput / maxValues.throughput) * 100 : 0;
          break;
        case '成功率':
          result[r.name] = r.totalRequests > 0 ? (r.successCount / r.totalRequests) * 100 : 0;
          break;
        case '低延迟':
          // Inverse - lower latency is better
          result[r.name] = maxValues.avgLatency > 0 ? (1 - r.avgLatency / maxValues.avgLatency) * 100 : 100;
          break;
        case 'P99稳定性':
          // Inverse - lower P99 is better
          result[r.name] = maxValues.p99Latency > 0 ? (1 - r.p99Latency / maxValues.p99Latency) * 100 : 100;
          break;
        case '请求量':
          result[r.name] = maxValues.totalRequests > 0 ? (r.totalRequests / maxValues.totalRequests) * 100 : 0;
          break;
      }
    });
    return result;
  });

  // Calculate comparison insights
  const getComparisonInsight = (metric: string, values: number[], higherIsBetter: boolean) => {
    const best = higherIsBetter ? Math.max(...values) : Math.min(...values);
    const worst = higherIsBetter ? Math.min(...values) : Math.max(...values);
    const diff = ((best - worst) / worst * 100).toFixed(1);
    return { best, worst, diff };
  };

  const throughputInsight = getComparisonInsight('throughput', records.map(r => r.throughput), true);
  const latencyInsight = getComparisonInsight('latency', records.map(r => r.avgLatency), false);
  const successRateInsight = getComparisonInsight('successRate', 
    records.map(r => r.totalRequests > 0 ? (r.successCount / r.totalRequests) * 100 : 0), true);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <GitCompare className="w-5 h-5" />
              性能对比分析
              <span className="text-sm text-muted-foreground">
                ({records.length} 条记录)
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">吞吐量差异</p>
                    <p className="text-2xl font-bold text-primary">{throughputInsight.diff}%</p>
                  </div>
                  {parseFloat(throughputInsight.diff) > 10 ? (
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  ) : parseFloat(throughputInsight.diff) < -10 ? (
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  ) : (
                    <Minus className="w-8 h-8 text-yellow-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  最高: {throughputInsight.best} req/s
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">延迟差异</p>
                    <p className="text-2xl font-bold text-cyan-400">{latencyInsight.diff}%</p>
                  </div>
                  {parseFloat(latencyInsight.diff) < 0 ? (
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  ) : parseFloat(latencyInsight.diff) > 20 ? (
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  ) : (
                    <Minus className="w-8 h-8 text-yellow-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  最低: {latencyInsight.best}ms
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">成功率差异</p>
                    <p className="text-2xl font-bold text-green-400">{successRateInsight.diff}%</p>
                  </div>
                  {parseFloat(successRateInsight.diff) > 5 ? (
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  ) : parseFloat(successRateInsight.diff) < -5 ? (
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  ) : (
                    <Minus className="w-8 h-8 text-yellow-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  最高: {successRateInsight.best.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart */}
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">综合性能雷达图</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  {records.map((record, index) => (
                    <Radar
                      key={record.id}
                      name={record.name}
                      dataKey={record.name}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Charts Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Latency Comparison */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">延迟对比 (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={latencyCompareData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#e2e8f0', fontSize: 12 }}
                      axisLine={{ stroke: '#64748b' }}
                    />
                    <YAxis 
                      tick={{ fill: '#e2e8f0', fontSize: 12 }}
                      axisLine={{ stroke: '#64748b' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    {records.map((record, index) => (
                      <Bar 
                        key={record.id}
                        dataKey={record.name} 
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput Comparison */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">吞吐量对比 (req/s)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={throughputCompareData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#e2e8f0', fontSize: 12 }}
                      axisLine={{ stroke: '#64748b' }}
                    />
                    <YAxis 
                      tick={{ fill: '#e2e8f0', fontSize: 12 }}
                      axisLine={{ stroke: '#64748b' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any, name: string, props: any) => [value, props.payload.fullName]}
                    />
                    <Bar dataKey="吞吐量" fill="#00d4ff" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Comparison Table */}
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">详细指标对比</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground">指标</th>
                      {records.map((r, i) => (
                        <th key={r.id} className="text-right py-2 px-3" style={{ color: COLORS[i % COLORS.length] }}>
                          {r.name.length > 20 ? r.name.substring(0, 20) + '...' : r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">总请求数</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.totalRequests.toLocaleString()}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">成功数</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono text-green-400">{r.successCount.toLocaleString()}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">失败数</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono text-red-400">{r.failCount.toLocaleString()}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">成功率</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">
                          {r.totalRequests > 0 ? ((r.successCount / r.totalRequests) * 100).toFixed(2) : 0}%
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">吞吐量</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.throughput} req/s</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">平均延迟</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.avgLatency}ms</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">P50延迟</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.p50Latency}ms</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">P90延迟</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.p90Latency}ms</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">P95延迟</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.p95Latency}ms</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">P99延迟</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.p99Latency}ms</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-muted-foreground">测试时长</td>
                      {records.map(r => (
                        <td key={r.id} className="text-right py-2 px-3 font-mono">{r.duration}s</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
