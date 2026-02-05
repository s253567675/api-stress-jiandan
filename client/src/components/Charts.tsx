/*
 * Charts Component
 * Mission Control Style - Real-time monitoring charts
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import type { TimeSeriesPoint, TestMetrics } from '@/hooks/useStressTest';

interface QpsChartProps {
  data: TimeSeriesPoint[];
}

export function QpsChart({ data }: QpsChartProps) {
  return (
    <div className="data-card h-[200px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        实时 QPS
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="qpsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            tickFormatter={(v) => `${v}s`}
            stroke="oklch(0.28 0.04 250)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            stroke="oklch(0.28 0.04 250)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(0.18 0.03 250)',
              border: '1px solid oklch(0.28 0.04 250)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelFormatter={(v) => `时间: ${v}s`}
            formatter={(value: number) => [`${value} req/s`, 'QPS']}
          />
          <Area
            type="monotone"
            dataKey="qps"
            stroke="oklch(0.75 0.15 195)"
            strokeWidth={2}
            fill="url(#qpsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LatencyChartProps {
  data: TimeSeriesPoint[];
}

export function LatencyChart({ data }: LatencyChartProps) {
  return (
    <div className="data-card h-[200px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        响应延迟 (ms)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            tickFormatter={(v) => `${v}s`}
            stroke="oklch(0.28 0.04 250)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            stroke="oklch(0.28 0.04 250)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(0.18 0.03 250)',
              border: '1px solid oklch(0.28 0.04 250)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelFormatter={(v) => `时间: ${v}s`}
            formatter={(value: number) => [`${value} ms`, '延迟']}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="oklch(0.8 0.18 75)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ErrorRateChartProps {
  data: TimeSeriesPoint[];
}

export function ErrorRateChart({ data }: ErrorRateChartProps) {
  return (
    <div className="data-card h-[200px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        错误率 (%)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            tickFormatter={(v) => `${v}s`}
            stroke="oklch(0.28 0.04 250)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            stroke="oklch(0.28 0.04 250)"
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(0.18 0.03 250)',
              border: '1px solid oklch(0.28 0.04 250)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelFormatter={(v) => `时间: ${v}s`}
            formatter={(value: number) => [`${value.toFixed(2)}%`, '错误率']}
          />
          <Area
            type="monotone"
            dataKey="errorRate"
            stroke="oklch(0.6 0.22 25)"
            strokeWidth={2}
            fill="url(#errorGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatusCodeChartProps {
  statusCodes: Record<number, number>;
}

export function StatusCodeChart({ statusCodes }: StatusCodeChartProps) {
  const data = Object.entries(statusCodes).map(([code, count]) => ({
    code,
    count,
    color: getStatusColor(parseInt(code)),
  }));

  return (
    <div className="data-card h-[200px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        状态码分布
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
            <XAxis
              dataKey="code"
              tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
              stroke="oklch(0.28 0.04 250)"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
              stroke="oklch(0.28 0.04 250)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.18 0.03 250)',
                border: '1px solid oklch(0.28 0.04 250)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value}`, '请求数']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[85%] flex items-center justify-center text-muted-foreground text-sm">
          暂无数据
        </div>
      )}
    </div>
  );
}

function getStatusColor(code: number): string {
  if (code >= 200 && code < 300) return 'oklch(0.75 0.2 145)'; // Success - green
  if (code >= 300 && code < 400) return 'oklch(0.75 0.15 195)'; // Redirect - cyan
  if (code >= 400 && code < 500) return 'oklch(0.8 0.18 75)'; // Client error - amber
  if (code >= 500) return 'oklch(0.6 0.22 25)'; // Server error - red
  return 'oklch(0.65 0.03 250)'; // Unknown - gray
}

interface LatencyDistributionProps {
  metrics: TestMetrics;
}

export function LatencyDistribution({ metrics }: LatencyDistributionProps) {
  const data = [
    { name: 'P50', value: metrics.p50Latency, fill: 'oklch(0.75 0.15 195)' },
    { name: 'P90', value: metrics.p90Latency, fill: 'oklch(0.75 0.2 145)' },
    { name: 'P95', value: metrics.p95Latency, fill: 'oklch(0.8 0.18 75)' },
    { name: 'P99', value: metrics.p99Latency, fill: 'oklch(0.6 0.22 25)' },
  ];

  return (
    <div className="data-card h-[200px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        延迟分布 (ms)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            stroke="oklch(0.28 0.04 250)"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 250)' }}
            stroke="oklch(0.28 0.04 250)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(0.18 0.03 250)',
              border: '1px solid oklch(0.28 0.04 250)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value} ms`, '延迟']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SuccessRatePieProps {
  successCount: number;
  failCount: number;
}

export function SuccessRatePie({ successCount, failCount }: SuccessRatePieProps) {
  const total = successCount + failCount;
  const data = [
    { name: '成功', value: successCount, fill: 'oklch(0.75 0.2 145)' },
    { name: '失败', value: failCount, fill: 'oklch(0.6 0.22 25)' },
  ];

  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0';

  return (
    <div className="data-card h-[200px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        成功率
      </h3>
      <div className="h-[85%] flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-2">
          <div className="text-center">
            <span className="text-3xl font-bold mono-number text-chart-3">{successRate}%</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-chart-3" />
              <span className="text-muted-foreground">成功: {successCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-muted-foreground">失败: {failCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
