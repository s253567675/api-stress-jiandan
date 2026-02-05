/*
 * Stress Test Engine Hook
 * Handles concurrent requests, QPS control, and real-time metrics collection
 * Uses backend proxy to bypass CORS restrictions
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

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
}

export interface RequestResult {
  id: number;
  timestamp: number;
  duration: number;
  status: number;
  success: boolean;
  error?: string;
  size?: number;
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
  statusCodes: Record<number, number>;
}

export interface TimeSeriesPoint {
  time: number;
  qps: number;
  latency: number;
  errorRate: number;
  activeConnections: number;
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
    results.forEach(r => {
      statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
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
    };

    setMetrics(newMetrics);

    // Add time series point
    setTimeSeries(prev => {
      const newPoint: TimeSeriesPoint = {
        time: Math.round(elapsed),
        qps: currentQps,
        latency: Math.round(avgLatency),
        errorRate: newMetrics.errorRate,
        activeConnections: activeConnectionsRef.current,
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
      
      // Try to get response size
      let size = 0;
      try {
        const text = await response.text();
        size = new Blob([text]).size;
      } catch {
        // Ignore size calculation errors
      }

      activeConnectionsRef.current--;
      lastSecondRequestsRef.current.push(Date.now());

      return {
        id,
        timestamp: Date.now(),
        duration,
        status: response.status,
        success: response.ok,
        size,
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
      });

      const endTime = performance.now();
      // Use server-side duration if available, otherwise use client-side
      const duration = result.duration || (endTime - startTime);
      
      activeConnectionsRef.current--;
      lastSecondRequestsRef.current.push(Date.now());

      return {
        id,
        timestamp: Date.now(),
        duration,
        status: result.status,
        success: result.success,
        size: result.body ? new Blob([result.body]).size : 0,
        error: result.error,
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

    // Calculate interval between requests based on QPS
    const intervalMs = 1000 / config.qps;
    let requestsSent = 0;
    let pendingRequests: Promise<void>[] = [];

    // Start metrics update interval
    intervalRef.current = setInterval(updateMetrics, 500);

    const sendRequest = async () => {
      if (signal.aborted || isPausedRef.current || isAbortedRef.current) return;
      
      // Check if we should stop based on duration or total requests
      if (config.duration > 0) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed >= config.duration) return;
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

    // QPS-controlled request sending
    qpsIntervalRef.current = setInterval(() => {
      if (!signal.aborted && !isPausedRef.current && !isAbortedRef.current) {
        sendRequest();
      }
    }, intervalMs);

    // Wait for completion
    const checkCompletion = async () => {
      while (!signal.aborted && !isAbortedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (config.duration > 0) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed >= config.duration && activeConnectionsRef.current === 0) {
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
      clearInterval(qpsIntervalRef.current);
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
      clearInterval(qpsIntervalRef.current);
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
  };
}
