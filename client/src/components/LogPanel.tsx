/*
 * Log Panel Component
 * Mission Control Style - Real-time request logs with auto-scroll and response preview
 */

import { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronUp, Eye, Copy, Check } from 'lucide-react';
import type { RequestResult } from '@/hooks/useStressTest';
import { cn } from '@/lib/utils';

interface LogPanelProps {
  logs: RequestResult[];
  onClear?: () => void;
}

export function LogPanel({ logs }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedLog, setSelectedLog] = useState<RequestResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getStatusBadge = (status: number, success: boolean) => {
    if (!success || status === 0) {
      return <Badge variant="destructive" className="text-xs font-mono">ERR</Badge>;
    }
    if (status >= 200 && status < 300) {
      return <Badge className="bg-chart-3 text-xs font-mono">{status}</Badge>;
    }
    if (status >= 300 && status < 400) {
      return <Badge className="bg-primary text-xs font-mono">{status}</Badge>;
    }
    if (status >= 400 && status < 500) {
      return <Badge className="bg-chart-4 text-xs font-mono">{status}</Badge>;
    }
    return <Badge variant="destructive" className="text-xs font-mono">{status}</Badge>;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatJson = (str: string | undefined) => {
    if (!str) return '无响应内容';
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  const handleCopy = async () => {
    if (selectedLog?.responseBody) {
      await navigator.clipboard.writeText(selectedLog.responseBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="data-card flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider">
              请求日志
            </h3>
            <Badge variant="outline" className="text-xs">
              {logs.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              {autoScroll ? '自动滚动' : '手动滚动'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Log List */}
        {isExpanded && (
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto max-h-[200px] space-y-1 pr-2"
          >
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                暂无日志
              </div>
            ) : (
              logs.slice(-100).map((log, index) => (
                <div
                  key={`${log.id}-${log.timestamp}-${index}`}
                  className={cn(
                    'flex items-center gap-3 py-1.5 px-2 rounded text-xs font-mono cursor-pointer',
                    'bg-muted/30 hover:bg-muted/50 transition-colors',
                    !log.success && 'bg-destructive/10 hover:bg-destructive/20'
                  )}
                  onClick={() => setSelectedLog(log)}
                >
                  <span className="text-muted-foreground w-24 shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  {getStatusBadge(log.status, log.success)}
                  <span
                    className={cn(
                      'w-16 text-right shrink-0',
                      log.duration > 1000 ? 'text-destructive' :
                      log.duration > 500 ? 'text-chart-4' :
                      'text-chart-3'
                    )}
                  >
                    {log.duration.toFixed(0)}ms
                  </span>
                  {log.businessCode && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {log.businessCode}
                    </Badge>
                  )}
                  {log.error && (
                    <span className="text-destructive truncate flex-1">
                      {log.error}
                    </span>
                  )}
                  {log.size && !log.error && (
                    <span className="text-muted-foreground">
                      {(log.size / 1024).toFixed(1)}KB
                    </span>
                  )}
                  {log.responseBody && (
                    <Eye className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Response Preview Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>响应详情</span>
              {selectedLog && (
                <>
                  {getStatusBadge(selectedLog.status, selectedLog.success)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {selectedLog.duration.toFixed(0)}ms
                  </span>
                  {selectedLog.businessCode && (
                    <Badge variant="outline" className="text-xs">
                      业务码: {selectedLog.businessCode}
                    </Badge>
                  )}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Request Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">请求ID:</span>
                <span className="ml-2 font-mono">{selectedLog?.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">时间:</span>
                <span className="ml-2 font-mono">
                  {selectedLog && formatTime(selectedLog.timestamp)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">HTTP状态:</span>
                <span className="ml-2 font-mono">{selectedLog?.status || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">响应大小:</span>
                <span className="ml-2 font-mono">
                  {selectedLog?.size ? `${(selectedLog.size / 1024).toFixed(2)}KB` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {selectedLog?.error && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="text-xs text-destructive font-medium mb-1">错误信息</div>
                <div className="text-sm font-mono text-destructive">{selectedLog.error}</div>
              </div>
            )}

            {/* Response Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">响应体</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleCopy}
                  disabled={!selectedLog?.responseBody}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      复制
                    </>
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[300px] rounded-lg border border-border bg-muted/30 p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {formatJson(selectedLog?.responseBody)}
                </pre>
              </ScrollArea>
              {selectedLog?.responseBody && selectedLog.responseBody.length >= 2048 && (
                <p className="text-xs text-muted-foreground mt-1">
                  * 响应体已截断，仅显示前2KB内容
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
