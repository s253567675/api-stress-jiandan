/*
 * Stress Test Engine Hook
 * Handles concurrent requests, QPS control, and real-time metrics collection
 * Uses backend proxy to bypass CORS restrictions
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

// Success condition configuration for response validation
export interface SuccessCondition {
  enabled: boolean;
  field: string; // JSON path to check, e.g., "code" or "data.status"
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'exists' | 'notExists';
  value: string; // Expected value (string representation)
}

// Ramp-up configuration for gradual load increase
export interface RampUpConfig {
  enabled: boolean;
  duration: number; // Ramp-up duration in seconds
  startQps: number; // Starting QPS (default 1)
  mode: 'linear' | 'step'; // Linear or step increase
  stepInterval?: number; // For step mode: interval between steps in seconds
  stepSize?: number; // For step mode: QPS increase per step
}

export interface TestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers: Record<string, string>;
  body: string;
  concurrency: number;
  qps: number;
  duration: number; // seconds, 0 means use totalRequests
  totalRequests: number;
  useProxy: boolean; // Whether to use backend proxy
  timeout: number; // Request timeout in milliseconds
  successCondition?: SuccessCondition; // Custom success condition based on response body
  rampUp?: RampUpConfig; // Optional ramp-up configuration
}

export interface RequestResult {
  id: number;
  timestamp: number;
  duration: number;
  status: number;
  success: boolean;
  error?: string;
  size?: number;
  businessCode?: string; // 业务状态码（从响应体中提取）
}

export interface TestMetrics {
  totalRequests: number;
  completedRequests: number;
  successCount: number;
  failCount: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  currentQps: number;
  throughput: number;
  errorRate: number;
  elapsedTime: number;
  statusCodes: Record<number, number>; // HTTP状态码统计
  businessCodes: Record<string, number>; // 业务状态码统计
}

export interface TimeSeriesPoint {
  time: number;
  qps: number;
  latency: number;
  errorRate: number;
  activeConnections: number;
  targetQps?: number; // Target QPS for ramp-up visualization
}

export type TestStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

const initialMetrics: TestMetrics = {
  totalRequests: 0,
  completedRequests: 0,
  successCount: 0,
  failCount: 0,
  avgLatency: 0,
  minLatency: 0,
  maxLatency: 0,
  p50Latency: 0,
  p90Latency: 0,
  p95Latency: 0,
  p99Latency: 0,
  currentQps: 0,
  throughput: 0,
  errorRate: 0,
  elapsedTime: 0,
  statusCodes: {},
  businessCodes: {},
};

function calculatePercentile(sortedLatencies: number[], percentile: number): number {
  if (sortedLatencies.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedLatencies.length) - 1;
  return sortedLatencies[Math.max(0, index)];
}

export function useStressTest() {
  const [status, setStatus] = useState<TestStatus>('idle');
  const [metrics, setMetrics] = useState<TestMetrics>(initialMetrics);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [logs, setLogs] = useState<RequestResult[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<RequestResult[]>([]);
  const startTimeRef = useRef<number>(0);
  const requestIdRef = useRef<number>(0);
  const activeConnectionsRef = useRef<number>(0);
  const lastSecondRequestsRef = useRef<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const qpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef<TestConfig | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const isAbortedRef = useRef<boolean>(false);

  // Get tRPC mutation for proxy requests
  const proxyMutation = trpc.proxy.request.useMutation();

  const addLog = useCallback((result: RequestResult) => {
    setLogs(prev => {
      const newLogs = [...prev, result];
      // Keep only last 500 logs for performance
      if (newLogs.length > 500) {
        return newLogs.slice(-500);
      }
      return newLogs;
    });
  }, []);

  const updateMetrics = useCallback(() => {
    const results = resultsRef.current;
    if (results.length === 0) return;

    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    
    // Calculate latencies
    const latencies = results.map(r => r.duration).sort((a, b) => a - b);
    const successResults = results.filter(r => r.success);
    const failResults = results.filter(r => !r.success);
    
    // Calculate status code distribution
    const statusCodes: Record<number, number> = {};
    const businessCodes: Record<string, number> = {};
    results.forEach(r => {
      statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
      // 统计业务状态码
      if (r.businessCode !== undefined) {
        businessCodes[r.businessCode] = (businessCodes[r.businessCode] || 0) + 1;
      }
    });

    // Calculate current QPS (requests in last second)
    const oneSecondAgo = now - 1000;
    lastSecondRequestsRef.current = lastSecondRequestsRef.current.filter(t => t > oneSecondAgo);
    const currentQps = lastSecondRequestsRef.current.length;

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    const newMetrics: TestMetrics = {
      totalRequests: configRef.current?.duration 
        ? Math.ceil(configRef.current.qps * configRef.current.duration)
        : configRef.current?.totalRequests || 0,
      completedRequests: results.length,
      successCount: successResults.length,
      failCount: failResults.length,
      avgLatency: Math.round(avgLatency),
      minLatency: Math.round(latencies[0] || 0),
      maxLatency: Math.round(latencies[latencies.length - 1] || 0),
      p50Latency: Math.round(calculatePercentile(latencies, 50)),
      p90Latency: Math.round(calculatePercentile(latencies, 90)),
      p95Latency: Math.round(calculatePercentile(latencies, 95)),
      p99Latency: Math.round(calculatePercentile(latencies, 99)),
      currentQps,
      throughput: elapsed > 0 ? Math.round(results.length / elapsed) : 0,
      errorRate: results.length > 0 ? (failResults.length / results.length) * 100 : 0,
      elapsedTime: Math.round(elapsed),
      statusCodes,
      businessCodes,
    };

    setMetrics(newMetrics);

    // Calculate target QPS for ramp-up visualization
    let targetQps = configRef.current?.qps || 0;
    if (configRef.current?.rampUp?.enabled) {
      const rampUp = configRef.current.rampUp;
      const rampUpDuration = rampUp.duration || 10;
      const startQps = rampUp.startQps || 1;
      const finalQps = configRef.current.qps;
      
      if (elapsed < rampUpDuration) {
        if (rampUp.mode === 'linear') {
          const progress = elapsed / rampUpDuration;
          targetQps = Math.round(startQps + (finalQps - startQps) * progress);
        } else {
          // Step mode
          const stepInterval = rampUp.stepInterval || 5;
          const stepSize = rampUp.stepSize || Math.ceil((finalQps - startQps) / (rampUpDuration / stepInterval));
          const steps = Math.floor(elapsed / stepInterval);
          targetQps = Math.min(startQps + steps * stepSize, finalQps);
        }
      }
    }

    // Add time series point
    setTimeSeries(prev => {
      const newPoint: TimeSeriesPoint = {
        time: Math.round(elapsed),
        qps: currentQps,
        latency: Math.round(avgLatency),
        errorRate: newMetrics.errorRate,
        activeConnections: activeConnectionsRef.current,
        targetQps,
      };
      const newSeries = [...prev, newPoint];
      // Keep last 300 points (5 minutes at 1 point/second)
      if (newSeries.length > 300) {
        return newSeries.slice(-300);
      }
      return newSeries;
    });
  }, []);

  // Direct fetch request (may fail due to CORS)
  const makeDirectRequest = useCallback(async (config: TestConfig, signal: AbortSignal): Promise<RequestResult> => {
    const id = ++requestIdRef.current;
    const startTime = performance.now();
    
    activeConnectionsRef.current++;
    
    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.method !== 'GET' ? config.body : undefined,
        signal,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Try to get response body and size
      let size = 0;
      let responseBody: string | null = null;
      try {
        responseBody = await response.text();
        size = new Blob([responseBody]).size;
      } catch {
        // Ignore body read errors
      }

      activeConnectionsRef.current--;
      lastSecondRequestsRef.current.push(Date.now());

      // Check success condition based on response body (same as proxy mode)
      const { success: isSuccess, businessCode } = checkSuccessCondition(responseBody, config.successCondition, response.ok);

      return {
        id,
        timestamp: Date.now(),
        duration,
        status: response.status,
        success: isSuccess,
        size,
        businessCode,
      };
    } catch (error) {
      const endTime = performance.now();
      activeConnectionsRef.current--;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't count aborted requests
      if (errorMessage.includes('abort')) {
        return {
          id,
          timestamp: Date.now(),
          duration: endTime - startTime,
          status: 0,
          success: false,
          error: 'Aborted',
        };
      }

      lastSecondRequestsRef.current.push(Date.now());

      return {
        id,
        timestamp: Date.now(),
        duration: endTime - startTime,
        status: 0,
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  // Helper function to get nested field value from JSON object
  const getNestedValue = (obj: unknown, path: string): unknown => {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  };

  // Check if response matches success condition and extract business code
  const checkSuccessCondition = (responseBody: string | null, condition: SuccessCondition | undefined, httpSuccess: boolean): { success: boolean; businessCode?: string } => {
    // If no custom condition, use HTTP status code
    if (!condition || !condition.enabled) {
      return { success: httpSuccess };
    }

    // Try to parse response as JSON
    if (!responseBody) {
      return { success: condition.operator === 'notExists' };
    }

    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(responseBody);
    } catch {
      // If not valid JSON, can only check exists/notExists
      if (condition.operator === 'notExists') return { success: true };
      if (condition.operator === 'exists') return { success: false };
      return { success: false };
    }

    const fieldValue = getNestedValue(jsonBody, condition.field);
    const stringValue = fieldValue !== undefined && fieldValue !== null ? String(fieldValue) : undefined;
    // 提取业务状态码，如果字段不存在则记录为 "N/A"
    const businessCode = stringValue !== undefined ? stringValue : 'N/A';

    let success = false;
    switch (condition.operator) {
      case 'equals':
        success = stringValue === condition.value;
        break;
      case 'notEquals':
        success = stringValue !== condition.value;
        break;
      case 'contains':
        success = stringValue !== undefined && stringValue.includes(condition.value);
        break;
      case 'notContains':
        success = stringValue === undefined || !stringValue.includes(condition.value);
        break;
      case 'exists':
        success = fieldValue !== undefined;
        break;
      case 'notExists':
        success = fieldValue === undefined;
        break;
      default:
        success = httpSuccess;
    }

    return { success, businessCode };
  };

  // Proxy request through backend (bypasses CORS)
  const makeProxyRequest = useCallback(async (config: TestConfig): Promise<RequestResult> => {
    const id = ++requestIdRef.current;
    const startTime = performance.now();
    
    activeConnectionsRef.current++;
    
    try {
      const result = await proxyMutation.mutateAsync({
        url: config.url,
        method: config.method,
        headers: config.headers,
        body: config.method !== 'GET' ? config.body : undefined,
        timeout: config.timeout,
      });

      const endTime = performance.now();
      // Use server-side duration if available, otherwise use client-side
      const duration = result.duration || (endTime - startTime);
      
      activeConnectionsRef.current--;
      lastSecondRequestsRef.current.push(Date.now());

      // Check success condition based on response body
      const { success: isSuccess, businessCode } = checkSuccessCondition(result.body, config.successCondition, result.success);

      return {
        id,
        timestamp: Date.now(),
        duration,
        status: result.status,
        success: isSuccess,
        size: result.body ? new Blob([result.body]).size : 0,
        error: result.error,
        businessCode,
      };
    } catch (error) {
      const endTime = performance.now();
      activeConnectionsRef.current--;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      lastSecondRequestsRef.current.push(Date.now());

      return {
        id,
        timestamp: Date.now(),
        duration: endTime - startTime,
        status: 0,
        success: false,
        error: errorMessage,
      };
    }
  }, [proxyMutation]);

  const makeRequest = useCallback(async (config: TestConfig, signal: AbortSignal): Promise<RequestResult> => {
    // Check if aborted before making request
    if (isAbortedRef.current || signal.aborted) {
      return {
        id: ++requestIdRef.current,
        timestamp: Date.now(),
        duration: 0,
        status: 0,
        success: false,
        error: 'Aborted',
      };
    }

    // Use proxy by default to bypass CORS
    if (config.useProxy) {
      return makeProxyRequest(config);
    } else {
      return makeDirectRequest(config, signal);
    }
  }, [makeProxyRequest, makeDirectRequest]);

  const runTest = useCallback(async (config: TestConfig) => {
    // Reset state
    setStatus('running');
    setMetrics(initialMetrics);
    setTimeSeries([]);
    setLogs([]);
    resultsRef.current = [];
    requestIdRef.current = 0;
    activeConnectionsRef.current = 0;
    lastSecondRequestsRef.current = [];
    startTimeRef.current = Date.now();
    configRef.current = config;
    isPausedRef.current = false;
    isAbortedRef.current = false;

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Calculate total requests
    const totalRequests = config.duration > 0 
      ? config.qps * config.duration 
      : config.totalRequests;

    // Ramp-up configuration
    const rampUp = config.rampUp;
    const targetQps = config.qps;
    const startQps = rampUp?.enabled ? (rampUp.startQps || 1) : targetQps;
    const rampUpDuration = rampUp?.enabled ? (rampUp.duration || 10) : 0;
    const rampUpMode = rampUp?.mode || 'linear';
    const stepInterval = rampUp?.stepInterval || 5;
    const stepSize = rampUp?.stepSize || Math.ceil((targetQps - startQps) / (rampUpDuration / stepInterval));

    // Function to calculate current QPS based on elapsed time
    const getCurrentQps = (): number => {
      if (!rampUp?.enabled) return targetQps;
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      
      // After ramp-up duration, use target QPS
      if (elapsed >= rampUpDuration) return targetQps;
      
      if (rampUpMode === 'linear') {
        // Linear interpolation from startQps to targetQps
        const progress = elapsed / rampUpDuration;
        return Math.round(startQps + (targetQps - startQps) * progress);
      } else {
        // Step mode: increase by stepSize every stepInterval seconds
        const steps = Math.floor(elapsed / stepInterval);
        const currentQps = startQps + steps * stepSize;
        return Math.min(currentQps, targetQps);
      }
    };

    let requestsSent = 0;
    let pendingRequests: Promise<void>[] = [];
    let currentIntervalMs = 1000 / startQps;

    // Start metrics update interval
    intervalRef.current = setInterval(updateMetrics, 500);

    const sendRequest = async () => {
      if (signal.aborted || isPausedRef.current || isAbortedRef.current) return;
      
      // Check if we should stop based on duration or total requests
      if (config.duration > 0) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        // For ramp-up mode, total duration = rampUpDuration + config.duration
        const totalDuration = rampUp?.enabled ? (rampUpDuration + config.duration) : config.duration;
        if (elapsed >= totalDuration) return;
      } else if (requestsSent >= totalRequests) {
        return;
      }

      // Respect concurrency limit
      while (activeConnectionsRef.current >= config.concurrency) {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (signal.aborted || isAbortedRef.current) return;
      }

      requestsSent++;
      
      const requestPromise = makeRequest(config, signal).then(result => {
        if (!result.error?.includes('Aborted')) {
          resultsRef.current.push(result);
          addLog(result);
        }
      });

      pendingRequests.push(requestPromise);

      // Clean up completed promises periodically
      if (pendingRequests.length > 100) {
        pendingRequests = pendingRequests.slice(-50);
      }
    };

    // Dynamic QPS control with ramp-up support
    let lastQpsUpdate = Date.now();
    let accumulatedTime = 0;
    
    const dynamicQpsLoop = () => {
      if (signal.aborted || isAbortedRef.current) return;
      
      const now = Date.now();
      const deltaTime = now - lastQpsUpdate;
      lastQpsUpdate = now;
      
      if (!isPausedRef.current) {
        const currentQps = getCurrentQps();
        const intervalMs = 1000 / currentQps;
        
        accumulatedTime += deltaTime;
        
        // Send requests based on accumulated time
        while (accumulatedTime >= intervalMs) {
          accumulatedTime -= intervalMs;
          sendRequest();
        }
      }
      
      // Schedule next iteration
      qpsIntervalRef.current = setTimeout(dynamicQpsLoop, 10) as unknown as NodeJS.Timeout;
    };
    
    // Start the dynamic QPS loop
    dynamicQpsLoop();

    // Wait for completion
    const checkCompletion = async () => {
      // Calculate total duration including ramp-up
      const totalDuration = rampUp?.enabled 
        ? (rampUpDuration + config.duration) 
        : config.duration;
      
      while (!signal.aborted && !isAbortedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (config.duration > 0) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed >= totalDuration && activeConnectionsRef.current === 0) {
            break;
          }
        } else if (resultsRef.current.length >= totalRequests) {
          break;
        }
      }
    };

    await checkCompletion();

    // Cleanup
    if (qpsIntervalRef.current) {
      clearTimeout(qpsIntervalRef.current);
      qpsIntervalRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Final metrics update
    updateMetrics();

    if (!signal.aborted && !isAbortedRef.current) {
      setStatus('completed');
    }
  }, [makeRequest, updateMetrics, addLog]);

  const startTest = useCallback((config: TestConfig) => {
    // Default to using proxy
    const configWithProxy = { ...config, useProxy: config.useProxy ?? true };
    runTest(configWithProxy);
  }, [runTest]);

  const stopTest = useCallback(() => {
    isAbortedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (qpsIntervalRef.current) {
      clearTimeout(qpsIntervalRef.current);
      qpsIntervalRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('idle');
  }, []);

  const pauseTest = useCallback(() => {
    isPausedRef.current = true;
    setStatus('paused');
  }, []);

  const resumeTest = useCallback(() => {
    isPausedRef.current = false;
    setStatus('running');
  }, []);

  const resetTest = useCallback(() => {
    stopTest();
    setMetrics(initialMetrics);
    setTimeSeries([]);
    setLogs([]);
    resultsRef.current = [];
    setStatus('idle');
  }, [stopTest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isAbortedRef.current = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (qpsIntervalRef.current) {
        clearInterval(qpsIntervalRef.current);
      }
    };
  }, []);

  return {
    status,
    metrics,
    timeSeries,
    logs,
    startTest,
    stopTest,
    pauseTest,
    resumeTest,
    resetTest,
    currentConfig: configRef.current,
  };
}
