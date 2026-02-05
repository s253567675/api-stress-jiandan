/*
 * Configuration Panel Component
 * Mission Control Style - Left sidebar for test parameters
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Square, Pause, RotateCcw, Settings, Zap, Clock, Target, AlertTriangle } from 'lucide-react';
import type { TestConfig, TestStatus } from '@/hooks/useStressTest';

interface ConfigPanelProps {
  onStart: (config: TestConfig) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  status: TestStatus;
  concurrencyLimit: number;
  qpsLimit: number;
  onConcurrencyLimitChange: (value: number) => void;
  onQpsLimitChange: (value: number) => void;
}

const defaultConfig: TestConfig = {
  url: 'https://pqtdlrkpxk.execute-api.cn-north-1.amazonaws.com.cn/uat/v1/stations/day-power',
  method: 'POST',
  headers: {
    'x-api-key': 'tRWNQ7sGlp76vPVLRn0tIask7bLwXW7yEMqMTTYi',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    stationno: [
      "105H2404000686", "105H2404000648", "105H2403000575", "105H2403000473",
      "135H2305001780", "135H2304001164", "135H2310004198", "135H2309004101",
      "207H2401001460", "207H2402001498", "207H2403001515", "207H2403001624",
      "207H2403001711", "135H2305001401", "135H2305001680", "207H2406002211",
      "207H2406002243", "207H2406002273", "207H2407002330", "293H2310000768",
      "293H2310000802", "293H2310000854", "311H2310000482", "105H2312000292",
      "113H2211000166", "113H2210000121", "113H2210000075", "113H2209000040",
      "105H2406001004", "105H2406000934", "105H2406000916", "105H2405000837",
      "105H2405000795"
    ],
    dateRange: [
      "2025-11-01", "2025-11-02", "2025-11-03", "2025-11-04", "2025-11-05",
      "2025-11-06", "2025-11-07", "2025-11-08", "2025-11-09", "2025-11-10",
      "2025-11-11", "2025-11-12", "2025-11-13", "2025-11-14", "2025-11-15",
      "2025-11-16", "2025-11-17", "2025-11-18", "2025-11-19", "2025-11-20",
      "2025-11-21", "2025-11-22", "2025-11-23", "2025-11-24", "2025-11-25",
      "2025-11-26", "2025-11-27", "2025-11-28", "2025-11-29", "2025-11-30",
      "2024-06-12"
    ]
  }, null, 2),
  concurrency: 50,
  qps: 100,
  duration: 30,
  totalRequests: 1000,
};

export function ConfigPanel({ 
  onStart, 
  onStop, 
  onPause, 
  onResume, 
  onReset, 
  status,
  concurrencyLimit,
  qpsLimit,
  onConcurrencyLimitChange,
  onQpsLimitChange,
}: ConfigPanelProps) {
  const [config, setConfig] = useState<TestConfig>(defaultConfig);
  const [headersText, setHeadersText] = useState(JSON.stringify(defaultConfig.headers, null, 2));
  const [useDuration, setUseDuration] = useState(true);

  useEffect(() => {
    try {
      const parsed = JSON.parse(headersText);
      setConfig(prev => ({ ...prev, headers: parsed }));
    } catch {
      // Invalid JSON, ignore
    }
  }, [headersText]);

  const handleStart = () => {
    const finalConfig = {
      ...config,
      duration: useDuration ? config.duration : 0,
      totalRequests: useDuration ? 0 : config.totalRequests,
    };
    onStart(finalConfig);
  };

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle' || status === 'completed' || status === 'error';

  // Check if current values exceed limits
  const concurrencyExceedsLimit = config.concurrency > concurrencyLimit;
  const qpsExceedsLimit = config.qps > qpsLimit;

  return (
    <div className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-sidebar-foreground">测试配置</h2>
        </div>
        <p className="text-xs text-muted-foreground">配置API压力测试参数</p>
      </div>

      {/* Config Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="basic" className="text-xs">基础配置</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs">高级配置</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* URL */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">目标URL</Label>
              <Input
                value={config.url}
                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://api.example.com/endpoint"
                className="bg-input text-sm font-mono"
                disabled={!isIdle}
              />
            </div>

            {/* Method */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">请求方法</Label>
              <Select
                value={config.method}
                onValueChange={(value) => setConfig(prev => ({ ...prev, method: value as TestConfig['method'] }))}
                disabled={!isIdle}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Concurrency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  并发数
                </Label>
                <Input
                  type="number"
                  value={config.concurrency}
                  onChange={(e) => setConfig(prev => ({ ...prev, concurrency: Math.max(1, parseInt(e.target.value) || 1) }))}
                  min={1}
                  className="w-20 h-7 bg-input text-sm font-mono text-right"
                  disabled={!isIdle}
                />
              </div>
              <Slider
                value={[config.concurrency]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, concurrency: value }))}
                min={1}
                max={Math.max(500, concurrencyLimit * 2)}
                step={1}
                disabled={!isIdle}
                className="py-2"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">API限制:</span>
                  <Input
                    type="number"
                    value={concurrencyLimit}
                    onChange={(e) => onConcurrencyLimitChange(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-16 h-6 bg-input text-xs font-mono text-center px-1"
                    disabled={!isIdle}
                  />
                  <span className="text-xs text-muted-foreground">并发</span>
                </div>
                {concurrencyExceedsLimit && (
                  <div className="flex items-center gap-1 text-chart-4">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-xs">超限</span>
                  </div>
                )}
              </div>
            </div>

            {/* QPS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  目标QPS
                </Label>
                <Input
                  type="number"
                  value={config.qps}
                  onChange={(e) => setConfig(prev => ({ ...prev, qps: Math.max(1, parseInt(e.target.value) || 1) }))}
                  min={1}
                  className="w-20 h-7 bg-input text-sm font-mono text-right"
                  disabled={!isIdle}
                />
              </div>
              <Slider
                value={[config.qps]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, qps: value }))}
                min={1}
                max={Math.max(5000, qpsLimit * 2)}
                step={10}
                disabled={!isIdle}
                className="py-2"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">API限流:</span>
                  <Input
                    type="number"
                    value={qpsLimit}
                    onChange={(e) => onQpsLimitChange(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-16 h-6 bg-input text-xs font-mono text-center px-1"
                    disabled={!isIdle}
                  />
                  <span className="text-xs text-muted-foreground">QPS</span>
                </div>
                {qpsExceedsLimit && (
                  <div className="flex items-center gap-1 text-chart-4">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-xs">超限</span>
                  </div>
                )}
              </div>
            </div>

            {/* Duration Mode Toggle */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">按时长测试</Label>
                <Switch
                  checked={useDuration}
                  onCheckedChange={setUseDuration}
                  disabled={!isIdle}
                />
              </div>

              {useDuration ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      测试时长 (秒)
                    </Label>
                    <Input
                      type="number"
                      value={config.duration}
                      onChange={(e) => setConfig(prev => ({ ...prev, duration: Math.max(1, parseInt(e.target.value) || 1) }))}
                      min={1}
                      className="w-20 h-7 bg-input text-sm font-mono text-right"
                      disabled={!isIdle}
                    />
                  </div>
                  <Slider
                    value={[config.duration]}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, duration: value }))}
                    min={5}
                    max={600}
                    step={5}
                    disabled={!isIdle}
                    className="py-2"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">总请求数</Label>
                  <Input
                    type="number"
                    value={config.totalRequests}
                    onChange={(e) => setConfig(prev => ({ ...prev, totalRequests: parseInt(e.target.value) || 0 }))}
                    min={1}
                    className="bg-input text-sm font-mono"
                    disabled={!isIdle}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            {/* Headers */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">请求头 (JSON)</Label>
              <Textarea
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder='{"Content-Type": "application/json"}'
                className="bg-input text-xs font-mono min-h-[100px]"
                disabled={!isIdle}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">请求体 (JSON)</Label>
              <Textarea
                value={config.body}
                onChange={(e) => setConfig(prev => ({ ...prev, body: e.target.value }))}
                placeholder='{"key": "value"}'
                className="bg-input text-xs font-mono min-h-[200px]"
                disabled={!isIdle}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Control Buttons */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {isIdle && (
          <Button
            onClick={handleStart}
            className="w-full glow-cyan-strong"
            size="lg"
          >
            <Play className="w-4 h-4 mr-2" />
            开始测试
          </Button>
        )}

        {isRunning && (
          <div className="flex gap-2">
            <Button
              onClick={onPause}
              variant="secondary"
              className="flex-1"
              size="lg"
            >
              <Pause className="w-4 h-4 mr-2" />
              暂停
            </Button>
            <Button
              onClick={onStop}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              <Square className="w-4 h-4 mr-2" />
              停止
            </Button>
          </div>
        )}

        {isPaused && (
          <div className="flex gap-2">
            <Button
              onClick={onResume}
              className="flex-1 glow-cyan"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              继续
            </Button>
            <Button
              onClick={onStop}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              <Square className="w-4 h-4 mr-2" />
              停止
            </Button>
          </div>
        )}

        {(status === 'completed' || status === 'error') && (
          <Button
            onClick={onReset}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            重置
          </Button>
        )}
      </div>
    </div>
  );
}
