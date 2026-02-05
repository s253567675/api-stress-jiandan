/*
 * Log Panel Component
 * Mission Control Style - Real-time request logs with auto-scroll
 */

import { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
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

  return (
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
                  'flex items-center gap-3 py-1.5 px-2 rounded text-xs font-mono',
                  'bg-muted/30 hover:bg-muted/50 transition-colors',
                  !log.success && 'bg-destructive/10 hover:bg-destructive/20'
                )}
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
