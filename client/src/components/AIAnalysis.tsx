/*
 * AI Analysis Component
 * Provides AI-powered analysis of stress test results
 * Supports custom LLM configuration (OpenAI, Claude, custom endpoints)
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { 
  Brain, 
  Settings2, 
  Sparkles, 
  Loader2, 
  Copy, 
  Check,
  AlertCircle,
  Save,
  Trash2
} from 'lucide-react';
import type { TestMetrics, RequestResult } from '@/hooks/useStressTest';

interface AIAnalysisProps {
  metrics: TestMetrics;
  logs: RequestResult[];
}

interface LLMConfig {
  provider: 'openai' | 'claude' | 'custom';
  apiKey: string;
  apiEndpoint: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const defaultConfigs: Record<string, Partial<LLMConfig>> = {
  openai: {
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
  claude: {
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.7,
  },
  custom: {
    apiEndpoint: '',
    model: '',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

const STORAGE_KEY = 'stress-test-llm-config';

export function AIAnalysis({ metrics, logs }: AIAnalysisProps) {
  const [config, setConfig] = useState<LLMConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      provider: 'openai',
      apiKey: '',
      ...defaultConfigs.openai,
    } as LLMConfig;
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Save config to localStorage
  const saveConfig = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success('配置已保存');
    setConfigOpen(false);
  }, [config]);

  // Clear config
  const clearConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig({
      provider: 'openai',
      apiKey: '',
      ...defaultConfigs.openai,
    } as LLMConfig);
    toast.success('配置已清除');
  }, []);

  // Handle provider change
  const handleProviderChange = (provider: 'openai' | 'claude' | 'custom') => {
    setConfig(prev => ({
      ...prev,
      provider,
      ...defaultConfigs[provider],
    }));
  };

  // Generate analysis prompt
  const generatePrompt = useCallback(() => {
    const errorTypes: Record<string, number> = {};
    logs.filter(l => !l.success).forEach(log => {
      const errorType = log.error || `HTTP ${log.status}`;
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    return `作为一名专业的API性能测试专家，请分析以下压力测试结果并提供详细的分析报告：

## 测试概览
- 总请求数: ${metrics.completedRequests}
- 成功请求: ${metrics.successCount}
- 失败请求: ${metrics.failCount}
- 错误率: ${metrics.errorRate.toFixed(2)}%
- 测试时长: ${metrics.elapsedTime}秒
- 吞吐量: ${metrics.throughput} req/s

## 延迟统计
- 平均延迟: ${metrics.avgLatency}ms
- 最小延迟: ${metrics.minLatency}ms
- 最大延迟: ${metrics.maxLatency}ms
- P50延迟: ${metrics.p50Latency}ms
- P90延迟: ${metrics.p90Latency}ms
- P95延迟: ${metrics.p95Latency}ms
- P99延迟: ${metrics.p99Latency}ms

## 状态码分布
${Object.entries(metrics.statusCodes).map(([code, count]) => `- ${code}: ${count}次`).join('\n')}

## 错误类型分布
${Object.entries(errorTypes).map(([type, count]) => `- ${type}: ${count}次`).join('\n') || '无错误'}

请提供以下分析：
1. **性能评估**: 评估API的整体性能表现，包括响应时间、吞吐量等指标
2. **稳定性分析**: 分析API在压力下的稳定性，包括错误率、延迟波动等
3. **瓶颈识别**: 识别可能的性能瓶颈和问题点
4. **优化建议**: 提供具体的优化建议和改进方向
5. **风险评估**: 评估在生产环境中可能面临的风险
6. **总结**: 给出整体评价和建议

请用中文回答，使用Markdown格式，确保分析专业、详细且有实际参考价值。`;
  }, [metrics, logs]);

  // Call LLM API
  const analyzeWithAI = useCallback(async () => {
    if (!config.apiKey) {
      toast.error('请先配置API Key');
      setConfigOpen(true);
      return;
    }

    if (metrics.completedRequests === 0) {
      toast.error('暂无测试数据，请先运行压力测试');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult('');

    const prompt = generatePrompt();

    try {
      let response: Response;
      let result: string = '';

      if (config.provider === 'openai' || config.provider === 'custom') {
        // OpenAI-compatible API
        response = await fetch(config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: 'system',
                content: '你是一名专业的API性能测试专家，擅长分析压力测试结果并提供专业的优化建议。',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: config.maxTokens,
            temperature: config.temperature,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'API请求失败');
        }

        const data = await response.json();
        result = data.choices?.[0]?.message?.content || '';
      } else if (config.provider === 'claude') {
        // Anthropic Claude API
        response = await fetch(config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'API请求失败');
        }

        const data = await response.json();
        result = data.content?.[0]?.text || '';
      }

      setAnalysisResult(result);
      toast.success('分析完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '分析失败';
      toast.error(message);
      setAnalysisResult(`分析失败: ${message}\n\n请检查：\n1. API Key是否正确\n2. API端点是否可访问\n3. 网络连接是否正常`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [config, metrics, generatePrompt]);

  // Copy analysis result
  const copyResult = useCallback(() => {
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('已复制到剪贴板');
  }, [analysisResult]);

  const hasData = metrics.completedRequests > 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            AI智能分析
            {config.apiKey && (
              <Badge variant="secondary" className="ml-2">
                {config.provider === 'openai' ? 'OpenAI' : config.provider === 'claude' ? 'Claude' : '自定义'}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    大模型配置
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Provider Selection */}
                  <div className="space-y-2">
                    <Label>模型提供商</Label>
                    <Select
                      value={config.provider}
                      onValueChange={(v) => handleProviderChange(v as 'openai' | 'claude' | 'custom')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                        <SelectItem value="claude">Anthropic (Claude)</SelectItem>
                        <SelectItem value="custom">自定义接口</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="sk-..."
                    />
                  </div>

                  {/* API Endpoint */}
                  <div className="space-y-2">
                    <Label>API 端点</Label>
                    <Input
                      value={config.apiEndpoint}
                      onChange={(e) => setConfig(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                      placeholder="https://api.openai.com/v1/chat/completions"
                    />
                    <p className="text-xs text-muted-foreground">
                      支持OpenAI兼容接口，如Azure、本地部署等
                    </p>
                  </div>

                  {/* Model */}
                  <div className="space-y-2">
                    <Label>模型名称</Label>
                    <Input
                      value={config.model}
                      onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="gpt-4o"
                    />
                  </div>

                  {/* Advanced Settings */}
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">基础</TabsTrigger>
                      <TabsTrigger value="advanced">高级</TabsTrigger>
                    </TabsList>
                    <TabsContent value="basic" className="space-y-2 mt-2">
                      <p className="text-xs text-muted-foreground">
                        基础配置已完成，点击保存即可使用
                      </p>
                    </TabsContent>
                    <TabsContent value="advanced" className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label>最大Token数</Label>
                        <Input
                          type="number"
                          value={config.maxTokens}
                          onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))}
                          min={100}
                          max={128000}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Temperature (0-2)</Label>
                        <Input
                          type="number"
                          value={config.temperature}
                          onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.7 }))}
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveConfig} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      保存配置
                    </Button>
                    <Button variant="outline" onClick={clearConfig}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={analyzeWithAI}
              disabled={isAnalyzing || !hasData}
              size="sm"
              className="h-7"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  开始分析
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!config.apiKey ? (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>请先配置大模型API</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="mt-1"
            >
              点击配置
            </Button>
          </div>
        ) : !hasData ? (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
            <Brain className="w-8 h-8 mb-2 opacity-50" />
            <p>暂无测试数据</p>
            <p className="text-xs">请先运行压力测试后再进行AI分析</p>
          </div>
        ) : analysisResult ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyResult}
                className="h-7"
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
            <ScrollArea className="h-96 rounded-lg border border-border p-4 bg-muted/30">
              <div className="prose prose-sm prose-invert max-w-none">
                <Streamdown>{analysisResult}</Streamdown>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mb-2 opacity-50" />
            <p>点击"开始分析"获取AI智能分析报告</p>
            <p className="text-xs mt-1">AI将分析性能指标并提供优化建议</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
