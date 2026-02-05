/*
 * Configuration Panel Component
 * Mission Control Style - Left sidebar for test parameters
 * Features: Import/Export config, URL validation
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Play, Square, Pause, RotateCcw, Settings, Zap, Clock, Target, 
  AlertTriangle, Download, Upload, CheckCircle2, XCircle 
} from 'lucide-react';
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
  url: '',
  method: 'POST',
  headers: {},
  body: '',
  concurrency: 50,
  qps: 100,
  duration: 30,
  totalRequests: 1000,
  useProxy: true, // Use backend proxy to bypass CORS
};

// URL validation function
function isValidUrl(urlString: string): boolean {
  if (!urlString.trim()) return false;
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

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
  const [headersText, setHeadersText] = useState('');
  const [useDuration, setUseDuration] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (headersText.trim()) {
        const parsed = JSON.parse(headersText);
        setConfig(prev => ({ ...prev, headers: parsed }));
      } else {
        setConfig(prev => ({ ...prev, headers: {} }));
      }
    } catch {
      // Invalid JSON, ignore
    }
  }, [headersText]);

  // URL validation effect
  useEffect(() => {
    if (config.url.trim() === '') {
      setUrlError(null);
    } else if (!isValidUrl(config.url)) {
      setUrlError('请输入有效的URL地址 (http:// 或 https://)');
    } else {
      setUrlError(null);
    }
  }, [config.url]);

  const handleStart = () => {
    // Validate URL before starting
    if (!config.url.trim()) {
      toast.error('请输入目标URL');
      return;
    }
    if (!isValidUrl(config.url)) {
      toast.error('URL格式无效，请检查');
      return;
    }

    const finalConfig = {
      ...config,
      duration: useDuration ? config.duration : 0,
      totalRequests: useDuration ? 0 : config.totalRequests,
    };
    onStart(finalConfig);
  };

  // Export configuration to JSON file
  const handleExportConfig = () => {
    const exportData = {
      url: config.url,
      method: config.method,
      headers: config.headers,
      body: config.body,
      concurrency: config.concurrency,
      qps: config.qps,
      duration: config.duration,
      totalRequests: config.totalRequests,
      useDuration,
      concurrencyLimit,
      qpsLimit,
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stress-test-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('配置已导出');
  };

  // Import configuration from JSON file
  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        // Validate and apply imported config
        setConfig(prev => ({
          ...prev,
          url: importedData.url || '',
          method: importedData.method || 'POST',
          headers: importedData.headers || {},
          body: importedData.body || '',
          concurrency: importedData.concurrency || 50,
          qps: importedData.qps || 100,
          duration: importedData.duration || 30,
          totalRequests: importedData.totalRequests || 1000,
        }));

        // Update headers text
        if (importedData.headers && Object.keys(importedData.headers).length > 0) {
          setHeadersText(JSON.stringify(importedData.headers, null, 2));
        } else {
          setHeadersText('');
        }

        // Update duration mode
        if (typeof importedData.useDuration === 'boolean') {
          setUseDuration(importedData.useDuration);
        }

        // Update limits if provided
        if (importedData.concurrencyLimit) {
          onConcurrencyLimitChange(importedData.concurrencyLimit);
        }
        if (importedData.qpsLimit) {
          onQpsLimitChange(importedData.qpsLimit);
        }

        toast.success('配置已导入');
      } catch (err) {
        toast.error('配置文件格式无效');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle' || status === 'completed' || status === 'error';

  // Check if current values exceed limits
  const concurrencyExceedsLimit = config.concurrency > concurrencyLimit;
  const qpsExceedsLimit = config.qps > qpsLimit;
  const isUrlValid = config.url.trim() !== '' && isValidUrl(config.url);

  return (
    <div className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-sidebar-foreground">测试配置</h2>
          </div>
          {/* Import/Export buttons */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportConfig}
              className="hidden"
              disabled={!isIdle}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isIdle}
              title="导入配置"
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleExportConfig}
              title="导出配置"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
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
            {/* URL with validation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">目标URL</Label>
                {config.url.trim() !== '' && (
                  isUrlValid ? (
                    <CheckCircle2 className="w-4 h-4 text-chart-3" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )
                )}
              </div>
              <Input
                value={config.url}
                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://api.example.com/endpoint"
                className={`bg-input text-sm font-mono ${urlError ? 'border-destructive' : ''}`}
                disabled={!isIdle}
              />
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
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
            disabled={!isUrlValid}
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
