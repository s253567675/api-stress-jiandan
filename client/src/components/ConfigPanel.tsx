/*
 * Configuration Panel Component
 * Mission Control Style - Left sidebar for test parameters
 * Features: Import/Export config, URL validation, Proxy mode, Timeout, Authorization
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
  AlertTriangle, Download, Upload, CheckCircle2, XCircle, Shield, Timer, Globe
} from 'lucide-react';
import type { TestConfig, TestStatus, SuccessCondition } from '@/hooks/useStressTest';

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
  timeout: 30000, // 30 seconds default timeout
  successCondition: {
    enabled: true,
    field: 'code',
    operator: 'equals',
    value: '0',
  },
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

// Authorization type options
type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'custom';

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
  
  // Authorization state
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authToken, setAuthToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [customAuthHeader, setCustomAuthHeader] = useState('');
  const [customAuthValue, setCustomAuthValue] = useState('');

  // Update headers when auth changes
  useEffect(() => {
    const updateAuthHeaders = () => {
      let authHeaders: Record<string, string> = {};
      
      switch (authType) {
        case 'bearer':
          if (authToken.trim()) {
            authHeaders['Authorization'] = `Bearer ${authToken.trim()}`;
          }
          break;
        case 'basic':
          if (basicUsername.trim() || basicPassword.trim()) {
            const credentials = btoa(`${basicUsername}:${basicPassword}`);
            authHeaders['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'apikey':
          if (apiKeyName.trim() && apiKeyValue.trim()) {
            authHeaders[apiKeyName.trim()] = apiKeyValue.trim();
          }
          break;
        case 'custom':
          if (customAuthHeader.trim() && customAuthValue.trim()) {
            authHeaders[customAuthHeader.trim()] = customAuthValue.trim();
          }
          break;
      }
      
      // Merge with existing headers from headersText
      try {
        const existingHeaders = headersText.trim() ? JSON.parse(headersText) : {};
        // Remove old auth headers before adding new ones
        const cleanedHeaders = { ...existingHeaders };
        delete cleanedHeaders['Authorization'];
        if (authType !== 'apikey') {
          delete cleanedHeaders[apiKeyName];
        }
        if (authType !== 'custom') {
          delete cleanedHeaders[customAuthHeader];
        }
        
        setConfig(prev => ({ 
          ...prev, 
          headers: { ...cleanedHeaders, ...authHeaders }
        }));
      } catch {
        setConfig(prev => ({ 
          ...prev, 
          headers: authHeaders
        }));
      }
    };
    
    updateAuthHeaders();
  }, [authType, authToken, basicUsername, basicPassword, apiKeyName, apiKeyValue, customAuthHeader, customAuthValue, headersText]);

  useEffect(() => {
    try {
      if (headersText.trim()) {
        const parsed = JSON.parse(headersText);
        // Only update non-auth headers
        const authHeaders: Record<string, string> = {};
        if (authType === 'bearer' && authToken.trim()) {
          authHeaders['Authorization'] = `Bearer ${authToken.trim()}`;
        } else if (authType === 'basic' && (basicUsername.trim() || basicPassword.trim())) {
          authHeaders['Authorization'] = `Basic ${btoa(`${basicUsername}:${basicPassword}`)}`;
        } else if (authType === 'apikey' && apiKeyName.trim() && apiKeyValue.trim()) {
          authHeaders[apiKeyName.trim()] = apiKeyValue.trim();
        } else if (authType === 'custom' && customAuthHeader.trim() && customAuthValue.trim()) {
          authHeaders[customAuthHeader.trim()] = customAuthValue.trim();
        }
        setConfig(prev => ({ ...prev, headers: { ...parsed, ...authHeaders } }));
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
      useProxy: config.useProxy,
      timeout: config.timeout,
      useDuration,
      concurrencyLimit,
      qpsLimit,
      authType,
      authToken: authType === 'bearer' ? authToken : '',
      basicUsername: authType === 'basic' ? basicUsername : '',
      basicPassword: authType === 'basic' ? basicPassword : '',
      apiKeyName: authType === 'apikey' ? apiKeyName : '',
      apiKeyValue: authType === 'apikey' ? apiKeyValue : '',
      customAuthHeader: authType === 'custom' ? customAuthHeader : '',
      customAuthValue: authType === 'custom' ? customAuthValue : '',
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
          useProxy: importedData.useProxy ?? true,
          timeout: importedData.timeout || 30000,
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

        // Update auth settings
        if (importedData.authType) {
          setAuthType(importedData.authType);
          setAuthToken(importedData.authToken || '');
          setBasicUsername(importedData.basicUsername || '');
          setBasicPassword(importedData.basicPassword || '');
          setApiKeyName(importedData.apiKeyName || 'X-API-Key');
          setApiKeyValue(importedData.apiKeyValue || '');
          setCustomAuthHeader(importedData.customAuthHeader || '');
          setCustomAuthValue(importedData.customAuthValue || '');
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
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="basic" className="text-xs">基础配置</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs">认证配置</TabsTrigger>
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

          {/* Auth Tab */}
          <TabsContent value="auth" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                认证类型
              </Label>
              <Select
                value={authType}
                onValueChange={(value) => setAuthType(value as AuthType)}
                disabled={!isIdle}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无认证</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="apikey">API Key</SelectItem>
                  <SelectItem value="custom">自定义Header</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType === 'bearer' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bearer Token</Label>
                <Input
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="输入您的Bearer Token"
                  className="bg-input text-sm font-mono"
                  disabled={!isIdle}
                  type="password"
                />
                <p className="text-xs text-muted-foreground">
                  将自动添加 Authorization: Bearer {'<token>'} 请求头
                </p>
              </div>
            )}

            {authType === 'basic' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">用户名</Label>
                  <Input
                    value={basicUsername}
                    onChange={(e) => setBasicUsername(e.target.value)}
                    placeholder="用户名"
                    className="bg-input text-sm"
                    disabled={!isIdle}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">密码</Label>
                  <Input
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                    placeholder="密码"
                    className="bg-input text-sm"
                    disabled={!isIdle}
                    type="password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  将自动添加 Authorization: Basic {'<base64>'} 请求头
                </p>
              </div>
            )}

            {authType === 'apikey' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Header名称</Label>
                  <Input
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    placeholder="X-API-Key"
                    className="bg-input text-sm font-mono"
                    disabled={!isIdle}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">API Key值</Label>
                  <Input
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder="输入您的API Key"
                    className="bg-input text-sm font-mono"
                    disabled={!isIdle}
                    type="password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  将自动添加 {apiKeyName || 'X-API-Key'}: {'<value>'} 请求头
                </p>
              </div>
            )}

            {authType === 'custom' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Header名称</Label>
                  <Input
                    value={customAuthHeader}
                    onChange={(e) => setCustomAuthHeader(e.target.value)}
                    placeholder="自定义Header名称"
                    className="bg-input text-sm font-mono"
                    disabled={!isIdle}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Header值</Label>
                  <Input
                    value={customAuthValue}
                    onChange={(e) => setCustomAuthValue(e.target.value)}
                    placeholder="自定义Header值"
                    className="bg-input text-sm font-mono"
                    disabled={!isIdle}
                    type="password"
                  />
                </div>
              </div>
            )}

            {authType === 'none' && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  未配置认证，请求将不包含认证信息
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            {/* Proxy Mode Toggle */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  使用代理模式
                </Label>
                <Switch
                  checked={config.useProxy}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, useProxy: checked }))}
                  disabled={!isIdle}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {config.useProxy 
                  ? '通过后端代理发送请求，可绕过CORS限制' 
                  : '直接从浏览器发送请求，可能受CORS限制'}
              </p>
            </div>

            {/* Timeout Configuration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  请求超时 (毫秒)
                </Label>
                <Input
                  type="number"
                  value={config.timeout}
                  onChange={(e) => setConfig(prev => ({ ...prev, timeout: Math.max(1000, parseInt(e.target.value) || 30000) }))}
                  min={1000}
                  max={300000}
                  className="w-24 h-7 bg-input text-sm font-mono text-right"
                  disabled={!isIdle}
                />
              </div>
              <Slider
                value={[config.timeout]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, timeout: value }))}
                min={1000}
                max={120000}
                step={1000}
                disabled={!isIdle}
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                单个请求的最大等待时间: {(config.timeout / 1000).toFixed(1)}秒
              </p>
            </div>

            {/* Success Condition */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  自定义成功条件
                </Label>
                <Switch
                  checked={config.successCondition?.enabled || false}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    successCondition: { ...prev.successCondition!, enabled: checked }
                  }))}
                  disabled={!isIdle}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {config.successCondition?.enabled
                  ? '根据响应体字段判断请求是否成功'
                  : '使用HTTP状态码(200-299)判断成功'}
              </p>
              
              {config.successCondition?.enabled && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">字段路径</Label>
                    <Input
                      value={config.successCondition?.field || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        successCondition: { ...prev.successCondition!, field: e.target.value }
                      }))}
                      placeholder="code 或 data.status"
                      className="bg-input text-sm font-mono"
                      disabled={!isIdle}
                    />
                    <p className="text-xs text-muted-foreground">
                      支持嵌套路径，如: data.result.code
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">匹配条件</Label>
                    <Select
                      value={config.successCondition?.operator || 'equals'}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        successCondition: { ...prev.successCondition!, operator: value as SuccessCondition['operator'] }
                      }))}
                      disabled={!isIdle}
                    >
                      <SelectTrigger className="bg-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">等于</SelectItem>
                        <SelectItem value="notEquals">不等于</SelectItem>
                        <SelectItem value="contains">包含</SelectItem>
                        <SelectItem value="notContains">不包含</SelectItem>
                        <SelectItem value="exists">字段存在</SelectItem>
                        <SelectItem value="notExists">字段不存在</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {config.successCondition?.operator !== 'exists' && config.successCondition?.operator !== 'notExists' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">期望值</Label>
                      <Input
                        value={config.successCondition?.value || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          successCondition: { ...prev.successCondition!, value: e.target.value }
                        }))}
                        placeholder="0"
                        className="bg-input text-sm font-mono"
                        disabled={!isIdle}
                      />
                      <p className="text-xs text-muted-foreground">
                        例如: code=0 表示成功
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">额外请求头 (JSON)</Label>
              <Textarea
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder='{"Content-Type": "application/json"}'
                className="bg-input text-xs font-mono min-h-[100px]"
                disabled={!isIdle}
              />
              <p className="text-xs text-muted-foreground">
                认证Header会自动添加，这里可配置其他请求头
              </p>
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
