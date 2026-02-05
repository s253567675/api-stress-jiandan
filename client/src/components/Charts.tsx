/*
 * Charts Component
 * Mission Control Style - Real-time monitoring charts
 * Enhanced axis visibility for better readability
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

// Common axis styles for better visibility
const axisTickStyle = { 
  fontSize: 12, 
  fill: '#e2e8f0', // Light gray for better contrast
  fontWeight: 500,
};

const axisLineStyle = {
  stroke: '#64748b', // Slate-500 for axis lines
  strokeWidth: 1,
};

const gridStyle = {
  stroke: '#334155', // Slate-700 for grid
  strokeDasharray: '3 3',
};

interface QpsChartProps {
  data: TimeSeriesPoint[];
}

export function QpsChart({ data }: QpsChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 h-[220px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        实时 QPS
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="qpsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis
            dataKey="time"
            tick={axisTickStyle}
            tickFormatter={(v) => `${v}s`}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
            labelFormatter={(v) => `时间: ${v}s`}
            formatter={(value: number) => [`${value} req/s`, 'QPS']}
          />
          <Area
            type="monotone"
            dataKey="qps"
            stroke="#00d4ff"
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
    <div className="rounded-lg border border-border bg-card/50 p-4 h-[220px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        响应延迟 (ms)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis
            dataKey="time"
            tick={axisTickStyle}
            tickFormatter={(v) => `${v}s`}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
            labelFormatter={(v) => `时间: ${v}s`}
            formatter={(value: number) => [`${value} ms`, '延迟']}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="#f59e0b"
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
    <div className="rounded-lg border border-border bg-card/50 p-4 h-[220px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        错误率 (%)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis
            dataKey="time"
            tick={axisTickStyle}
            tickFormatter={(v) => `${v}s`}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
            domain={[0, 100]}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
            labelFormatter={(v) => `时间: ${v}s`}
            formatter={(value: number) => [`${value.toFixed(2)}%`, '错误率']}
          />
          <Area
            type="monotone"
            dataKey="errorRate"
            stroke="#ef4444"
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
  businessCodes?: Record<string, number>;
  useBusinessCode?: boolean;
}

export function StatusCodeChart({ statusCodes, businessCodes, useBusinessCode = true }: StatusCodeChartProps) {
  // 优先使用业务状态码
  const codes = useBusinessCode && businessCodes ? businessCodes : statusCodes;
  const data = Object.entries(codes).map(([code, count]) => ({
    code,
    count,
    color: useBusinessCode && businessCodes ? getBusinessCodeColor(code) : getStatusColor(parseInt(code)),
  }));

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 h-[220px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        {useBusinessCode && businessCodes ? '业务状态码分布' : 'HTTP状态码分布'}
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="code"
              tick={axisTickStyle}
              axisLine={axisLineStyle}
              tickLine={{ stroke: '#64748b' }}
            />
            <YAxis
              tick={axisTickStyle}
              axisLine={axisLineStyle}
              tickLine={{ stroke: '#64748b' }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e2e8f0',
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
  if (code >= 200 && code < 300) return '#22c55e'; // Success - green
  if (code >= 300 && code < 400) return '#00d4ff'; // Redirect - cyan
  if (code >= 400 && code < 500) return '#f59e0b'; // Client error - amber
  if (code >= 500) return '#ef4444'; // Server error - red
  return '#64748b'; // Unknown - gray
}

function getBusinessCodeColor(code: string): string {
  const numCode = parseInt(code);
  if (code === '0' || code === 'success' || code === 'ok') return '#22c55e'; // Success - green
  if (numCode === 0) return '#22c55e'; // Success - green
  if (code === 'N/A' || code === 'null' || code === 'undefined') return '#64748b'; // Unknown - gray
  return '#ef4444'; // Error - red (any non-zero code is considered error)
}

interface LatencyDistributionProps {
  metrics: TestMetrics;
}

export function LatencyDistribution({ metrics }: LatencyDistributionProps) {
  const data = [
    { name: 'P50', value: metrics.p50Latency, fill: '#00d4ff' },
    { name: 'P90', value: metrics.p90Latency, fill: '#22c55e' },
    { name: 'P95', value: metrics.p95Latency, fill: '#f59e0b' },
    { name: 'P99', value: metrics.p99Latency, fill: '#ef4444' },
  ];

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 h-[220px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        延迟分布 (ms)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis
            type="number"
            tick={axisTickStyle}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={axisTickStyle}
            axisLine={axisLineStyle}
            tickLine={{ stroke: '#64748b' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0',
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
  label?: string;
}

export function SuccessRatePie({ successCount, failCount, label = '业务成功率' }: SuccessRatePieProps) {
  const total = successCount + failCount;
  const data = [
    { name: '成功', value: successCount, fill: '#22c55e' },
    { name: '失败', value: failCount, fill: '#ef4444' },
  ];

  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 h-[220px]">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        {label}
      </h3>
      <p className="text-xs text-muted-foreground -mt-2 mb-2">基于响应体code字段判断</p>
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
            <span className="text-3xl font-bold font-mono text-green-400">{successRate}%</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-300">成功: {successCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-300">失败: {failCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
