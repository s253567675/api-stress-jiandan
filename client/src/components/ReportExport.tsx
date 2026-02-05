/*
 * Report Export Component
 * Generates professional PDF reports from stress test results
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { FileText, Download, Loader2 } from 'lucide-react';
import type { TestMetrics, RequestResult, TimeSeriesPoint } from '@/hooks/useStressTest';

interface ReportExportProps {
  metrics: TestMetrics;
  logs: RequestResult[];
  timeSeries: TimeSeriesPoint[];
  aiAnalysis?: string;
}

interface ReportOptions {
  title: string;
  author: string;
  description: string;
  includeMetrics: boolean;
  includeCharts: boolean;
  includeLogs: boolean;
  includeAIAnalysis: boolean;
  maxLogs: number;
}

export function ReportExport({ metrics, logs, timeSeries, aiAnalysis }: ReportExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [options, setOptions] = useState<ReportOptions>({
    title: 'API压力测试报告',
    author: '',
    description: '',
    includeMetrics: true,
    includeCharts: true,
    includeLogs: true,
    includeAIAnalysis: true,
    maxLogs: 100,
  });

  // Generate HTML report content
  const generateHTMLReport = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleString('zh-CN');
    
    // Calculate error types
    const errorTypes: Record<string, number> = {};
    logs.filter(l => !l.success).forEach(log => {
      const errorType = log.error || `HTTP ${log.status}`;
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    // Generate latency distribution data
    const latencyRanges = [
      { name: '0-100ms', min: 0, max: 100, count: 0 },
      { name: '100-300ms', min: 100, max: 300, count: 0 },
      { name: '300-500ms', min: 300, max: 500, count: 0 },
      { name: '500-1000ms', min: 500, max: 1000, count: 0 },
      { name: '1-2s', min: 1000, max: 2000, count: 0 },
      { name: '>2s', min: 2000, max: Infinity, count: 0 },
    ];
    logs.forEach(log => {
      const range = latencyRanges.find(r => log.duration >= r.min && log.duration < r.max);
      if (range) range.count++;
    });

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: #ffffff;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #00d4ff;
    }
    .header h1 {
      font-size: 28px;
      color: #0a0a1a;
      margin-bottom: 10px;
    }
    .header .meta {
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 18px;
      color: #0a0a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e0e0e0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      border: 1px solid #e0e0e0;
    }
    .metric-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #00d4ff;
    }
    .metric-card .label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .metric-card.success .value { color: #22c55e; }
    .metric-card.danger .value { color: #ef4444; }
    .metric-card.warning .value { color: #f59e0b; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 10px 15px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #0a0a1a;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .status-200 { color: #22c55e; }
    .status-400 { color: #f59e0b; }
    .status-500 { color: #ef4444; }
    .status-0 { color: #ef4444; }
    .chart-placeholder {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      height: 150px;
      gap: 10px;
      padding: 10px 0;
    }
    .bar-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .bar {
      width: 100%;
      background: linear-gradient(180deg, #00d4ff, #0099cc);
      border-radius: 4px 4px 0 0;
      min-height: 5px;
    }
    .bar-label {
      font-size: 10px;
      color: #666;
      margin-top: 5px;
      text-align: center;
    }
    .bar-value {
      font-size: 11px;
      font-weight: bold;
      color: #0a0a1a;
      margin-bottom: 5px;
    }
    .ai-analysis {
      background: #f0f9ff;
      border: 1px solid #00d4ff;
      border-radius: 8px;
      padding: 20px;
    }
    .ai-analysis h3 {
      color: #0099cc;
      margin-bottom: 15px;
    }
    .ai-analysis-content {
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.8;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${options.title}</h1>
    <div class="meta">
      ${options.author ? `<p>作者: ${options.author}</p>` : ''}
      <p>生成时间: ${dateStr}</p>
      ${options.description ? `<p>${options.description}</p>` : ''}
    </div>
  </div>

  ${options.includeMetrics ? `
  <div class="section">
    <h2>📊 测试概览</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="value">${metrics.completedRequests.toLocaleString()}</div>
        <div class="label">总请求数</div>
      </div>
      <div class="metric-card success">
        <div class="value">${metrics.successCount.toLocaleString()}</div>
        <div class="label">成功请求</div>
      </div>
      <div class="metric-card ${metrics.failCount > 0 ? 'danger' : ''}">
        <div class="value">${metrics.failCount.toLocaleString()}</div>
        <div class="label">失败请求</div>
      </div>
      <div class="metric-card ${metrics.errorRate > 5 ? 'danger' : metrics.errorRate > 1 ? 'warning' : 'success'}">
        <div class="value">${metrics.errorRate.toFixed(2)}%</div>
        <div class="label">错误率</div>
      </div>
    </div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="value">${metrics.throughput}</div>
        <div class="label">吞吐量 (req/s)</div>
      </div>
      <div class="metric-card">
        <div class="value">${metrics.avgLatency}ms</div>
        <div class="label">平均延迟</div>
      </div>
      <div class="metric-card">
        <div class="value">${metrics.p95Latency}ms</div>
        <div class="label">P95延迟</div>
      </div>
      <div class="metric-card">
        <div class="value">${metrics.elapsedTime}s</div>
        <div class="label">测试时长</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>⏱️ 延迟统计</h2>
    <table>
      <thead>
        <tr>
          <th>指标</th>
          <th>值</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>最小延迟</td><td>${metrics.minLatency}ms</td><td>最快响应时间</td></tr>
        <tr><td>平均延迟</td><td>${metrics.avgLatency}ms</td><td>所有请求的平均响应时间</td></tr>
        <tr><td>最大延迟</td><td>${metrics.maxLatency}ms</td><td>最慢响应时间</td></tr>
        <tr><td>P50</td><td>${metrics.p50Latency}ms</td><td>50%的请求在此时间内完成</td></tr>
        <tr><td>P90</td><td>${metrics.p90Latency}ms</td><td>90%的请求在此时间内完成</td></tr>
        <tr><td>P95</td><td>${metrics.p95Latency}ms</td><td>95%的请求在此时间内完成</td></tr>
        <tr><td>P99</td><td>${metrics.p99Latency}ms</td><td>99%的请求在此时间内完成</td></tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  ${options.includeCharts ? `
  <div class="section">
    <h2>📈 延迟分布</h2>
    <div class="chart-placeholder">
      <div class="bar-chart">
        ${latencyRanges.filter(r => r.count > 0 || r.name === '0-100ms').map(range => {
          const maxCount = Math.max(...latencyRanges.map(r => r.count), 1);
          const height = (range.count / maxCount) * 100;
          return `
            <div class="bar-item">
              <div class="bar-value">${range.count}</div>
              <div class="bar" style="height: ${Math.max(height, 5)}%"></div>
              <div class="bar-label">${range.name}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📋 状态码分布</h2>
    <table>
      <thead>
        <tr>
          <th>状态码</th>
          <th>数量</th>
          <th>占比</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(metrics.statusCodes).map(([code, count]) => {
          const percentage = ((count / metrics.completedRequests) * 100).toFixed(2);
          const codeNum = parseInt(code);
          let statusClass = '';
          let description = '';
          if (codeNum >= 200 && codeNum < 300) {
            statusClass = 'status-200';
            description = '成功';
          } else if (codeNum >= 400 && codeNum < 500) {
            statusClass = 'status-400';
            description = '客户端错误';
          } else if (codeNum >= 500) {
            statusClass = 'status-500';
            description = '服务端错误';
          } else if (codeNum === 0) {
            statusClass = 'status-0';
            description = '网络错误';
          }
          return `
            <tr>
              <td class="${statusClass}">${code === '0' ? '网络错误' : code}</td>
              <td>${count.toLocaleString()}</td>
              <td>${percentage}%</td>
              <td>${description}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  ${Object.keys(errorTypes).length > 0 ? `
  <div class="section">
    <h2>❌ 错误分析</h2>
    <table>
      <thead>
        <tr>
          <th>错误类型</th>
          <th>数量</th>
          <th>占比</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(errorTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const percentage = ((count / metrics.failCount) * 100).toFixed(2);
          return `
            <tr>
              <td class="status-0">${type}</td>
              <td>${count.toLocaleString()}</td>
              <td>${percentage}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
  ` : ''}

  ${options.includeAIAnalysis && aiAnalysis ? `
  <div class="section">
    <h2>🤖 AI智能分析</h2>
    <div class="ai-analysis">
      <div class="ai-analysis-content">${aiAnalysis.replace(/\n/g, '<br>').replace(/#{1,6}\s/g, '<strong>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
    </div>
  </div>
  ` : ''}

  ${options.includeLogs ? `
  <div class="section">
    <h2>📝 请求日志 (最近${Math.min(options.maxLogs, logs.length)}条)</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>时间</th>
          <th>状态</th>
          <th>延迟</th>
          <th>结果</th>
        </tr>
      </thead>
      <tbody>
        ${logs.slice(-options.maxLogs).map((log, index) => {
          const statusClass = log.success ? 'status-200' : 'status-0';
          return `
            <tr>
              <td>${log.id}</td>
              <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
              <td class="${statusClass}">${log.status === 0 ? 'ERR' : log.status}</td>
              <td>${log.duration.toFixed(0)}ms</td>
              <td>${log.success ? '✓ 成功' : `✗ ${log.error || '失败'}`}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>本报告由 API压力测试工具 自动生成</p>
    <p>生成时间: ${dateStr}</p>
  </div>
</body>
</html>
    `;

    return html;
  }, [metrics, logs, options, aiAnalysis]);

  // Export as HTML (can be printed to PDF)
  const exportHTML = useCallback(() => {
    setIsGenerating(true);
    
    try {
      const html = generateHTMLReport();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${options.title}-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('报告已导出，可在浏览器中打开并打印为PDF');
      setDialogOpen(false);
    } catch (error) {
      toast.error('导出失败');
    } finally {
      setIsGenerating(false);
    }
  }, [generateHTMLReport, options.title]);

  // Open print preview
  const openPrintPreview = useCallback(() => {
    setIsGenerating(true);
    
    try {
      const html = generateHTMLReport();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error('打开预览失败');
    } finally {
      setIsGenerating(false);
    }
  }, [generateHTMLReport]);

  const hasData = metrics.completedRequests > 0;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!hasData}>
          <FileText className="w-4 h-4 mr-2" />
          导出报告
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            导出测试报告
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Report Title */}
          <div className="space-y-2">
            <Label>报告标题</Label>
            <Input
              value={options.title}
              onChange={(e) => setOptions(prev => ({ ...prev, title: e.target.value }))}
              placeholder="API压力测试报告"
            />
          </div>

          {/* Author */}
          <div className="space-y-2">
            <Label>作者 (可选)</Label>
            <Input
              value={options.author}
              onChange={(e) => setOptions(prev => ({ ...prev, author: e.target.value }))}
              placeholder="测试工程师"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>描述 (可选)</Label>
            <Textarea
              value={options.description}
              onChange={(e) => setOptions(prev => ({ ...prev, description: e.target.value }))}
              placeholder="测试目的、环境说明等..."
              rows={2}
            />
          </div>

          {/* Content Options */}
          <div className="space-y-3">
            <Label>报告内容</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeMetrics"
                  checked={options.includeMetrics}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeMetrics: !!checked }))}
                />
                <label htmlFor="includeMetrics" className="text-sm">包含性能指标</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCharts"
                  checked={options.includeCharts}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeCharts: !!checked }))}
                />
                <label htmlFor="includeCharts" className="text-sm">包含图表分析</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeLogs"
                  checked={options.includeLogs}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeLogs: !!checked }))}
                />
                <label htmlFor="includeLogs" className="text-sm">包含请求日志</label>
              </div>
              {aiAnalysis && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeAIAnalysis"
                    checked={options.includeAIAnalysis}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeAIAnalysis: !!checked }))}
                  />
                  <label htmlFor="includeAIAnalysis" className="text-sm">包含AI分析</label>
                </div>
              )}
            </div>
          </div>

          {/* Max Logs */}
          {options.includeLogs && (
            <div className="space-y-2">
              <Label>日志数量上限</Label>
              <Input
                type="number"
                value={options.maxLogs}
                onChange={(e) => setOptions(prev => ({ ...prev, maxLogs: parseInt(e.target.value) || 100 }))}
                min={10}
                max={500}
              />
            </div>
          )}

          {/* Export Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={exportHTML} className="flex-1" disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              下载HTML报告
            </Button>
            <Button onClick={openPrintPreview} variant="outline" disabled={isGenerating}>
              <FileText className="w-4 h-4 mr-2" />
              打印/PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            提示：点击"打印/PDF"可直接打印或保存为PDF文件
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
