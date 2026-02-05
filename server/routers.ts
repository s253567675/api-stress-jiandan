import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createTestRecord, getTestRecords, getTestRecordById, deleteTestRecord, updateTestRecordName, createConfigTemplate, getConfigTemplates, getConfigTemplateById, updateConfigTemplate, deleteConfigTemplate } from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // API Proxy for stress testing - bypasses CORS restrictions
  proxy: router({
    request: publicProcedure
      .input(z.object({
        url: z.string().url(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.string().optional(),
        timeout: z.number().min(1000).max(300000).optional().default(30000), // Default 30s timeout
      }))
      .mutation(async ({ input }) => {
        const startTime = Date.now();
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), input.timeout);
        
        try {
          const response = await fetch(input.url, {
            method: input.method,
            headers: input.headers,
            body: input.body,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          
          // Try to get response body
          let responseBody: string | null = null;
          try {
            responseBody = await response.text();
          } catch {
            // Ignore body parsing errors
          }
          
          return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            duration,
            body: responseBody,
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch (error) {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          
          // Check if it's a timeout error
          const isTimeout = error instanceof Error && error.name === 'AbortError';
          
          return {
            success: false,
            status: isTimeout ? 408 : 0,
            statusText: isTimeout ? 'Request Timeout' : 'Network Error',
            duration,
            body: null,
            headers: {},
            error: isTimeout ? `Request timeout after ${input.timeout}ms` : (error instanceof Error ? error.message : 'Unknown error'),
          };
        }
      }),
  }),

  // Test Records - Save and retrieve stress test results
  testRecords: router({
    // Create a new test record
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        url: z.string(),
        method: z.string(),
        config: z.any().optional(),
        status: z.enum(['completed', 'failed', 'cancelled']).default('completed'),
        totalRequests: z.number(),
        successCount: z.number(),
        failCount: z.number(),
        avgLatency: z.number(),
        minLatency: z.number(),
        maxLatency: z.number(),
        p50Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
        throughput: z.number(),
        errorRate: z.number(),
        duration: z.number(),
        statusCodes: z.any().optional(),
        businessCodes: z.any().optional(),
        timeSeries: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createTestRecord(input);
        return { success: !!id, id };
      }),

    // Get all test records
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      }).optional())
      .query(async ({ input }) => {
        const records = await getTestRecords(input?.limit ?? 50);
        return records;
      }),

    // Get a single test record by ID
    getById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        const record = await getTestRecordById(input.id);
        return record;
      }),

    // Delete a test record
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const success = await deleteTestRecord(input.id);
        return { success };
      }),

    // Update test record name
    updateName: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const success = await updateTestRecordName(input.id, input.name);
        return { success };
      }),
  }),

  // Config Templates - Save and load test configurations
  configTemplates: router({
    // Create a new config template
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        config: z.any(),
      }))
      .mutation(async ({ input }) => {
        const id = await createConfigTemplate(input);
        return { success: !!id, id };
      }),

    // Get all config templates
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      }).optional())
      .query(async ({ input }) => {
        const templates = await getConfigTemplates(input?.limit ?? 50);
        return templates;
      }),

    // Get a single config template by ID
    getById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        const template = await getConfigTemplateById(input.id);
        return template;
      }),

    // Update a config template
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        config: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const success = await updateConfigTemplate(id, data);
        return { success };
      }),

    // Delete a config template
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const success = await deleteConfigTemplate(input.id);
        return { success };
      }),
  }),
});

export type AppRouter = typeof appRouter;
