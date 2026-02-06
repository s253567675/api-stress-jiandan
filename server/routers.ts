import { COOKIE_NAME, LOCAL_COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  createTestRecord, 
  getTestRecords, 
  getTestRecordById, 
  deleteTestRecord, 
  updateTestRecordName, 
  createConfigTemplate, 
  getConfigTemplates, 
  getConfigTemplateById, 
  updateConfigTemplate, 
  deleteConfigTemplate,
  createLocalUser,
  getAllUsers,
  updateUser,
  deleteUser,
  getUserByUsername,
  getTestRecordsByUserId,
  getConfigTemplatesByUserId,
} from "./db";
import { localAuth } from "./localAuth";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // Clear both OAuth and local cookies
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(LOCAL_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // Local login
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1).max(64),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await localAuth.login(input.username, input.password);
        if (!result) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '用户名或密码错误',
          });
        }

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(LOCAL_COOKIE_NAME, result.token, cookieOptions);

        return {
          success: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            name: result.user.name,
            role: result.user.role,
          },
        };
      }),
  }),

  // User management (admin only)
  users: router({
    // Create a new user (admin only)
    create: adminProcedure
      .input(z.object({
        username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
        password: z.string().min(6).max(100),
        name: z.string().max(255).optional(),
        email: z.string().email().optional(),
        role: z.enum(['user', 'admin']).default('user'),
      }))
      .mutation(async ({ input }) => {
        // Check if username already exists
        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '用户名已存在',
          });
        }

        const id = await createLocalUser(input);
        return { success: !!id, id };
      }),

    // Get all users (admin only)
    list: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).optional().default(100),
      }).optional())
      .query(async ({ input }) => {
        const users = await getAllUsers(input?.limit ?? 100);
        return users;
      }),

    // Update user (admin only)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().max(255).optional(),
        email: z.string().email().optional().nullable(),
        role: z.enum(['user', 'admin']).optional(),
        isActive: z.number().min(0).max(1).optional(),
        password: z.string().min(6).max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const success = await updateUser(id, data);
        return { success };
      }),

    // Delete user (admin only)
    delete: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Prevent deleting self
        if (ctx.user && ctx.user.id === input.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '不能删除自己的账号',
          });
        }
        const success = await deleteUser(input.id);
        return { success };
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

  // Test Records - Save and retrieve stress test results (with user isolation)
  testRecords: router({
    // Create a new test record (requires login)
    create: protectedProcedure
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
      .mutation(async ({ input, ctx }) => {
        const id = await createTestRecord({
          ...input,
          userId: ctx.user.id,
        });
        return { success: !!id, id };
      }),

    // Get all test records for current user
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      }).optional())
      .query(async ({ input, ctx }) => {
        const records = await getTestRecordsByUserId(ctx.user.id, input?.limit ?? 50);
        return records;
      }),

    // Get all test records (admin only)
    listAll: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).optional().default(100),
      }).optional())
      .query(async ({ input }) => {
        const records = await getTestRecords(input?.limit ?? 100);
        return records;
      }),

    // Get a single test record by ID (with ownership check)
    getById: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const record = await getTestRecordById(input.id);
        // Check ownership (admin can view all)
        if (record && record.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权访问此记录',
          });
        }
        return record;
      }),

    // Delete a test record (with ownership check)
    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const record = await getTestRecordById(input.id);
        // Check ownership (admin can delete all)
        if (record && record.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权删除此记录',
          });
        }
        const success = await deleteTestRecord(input.id);
        return { success };
      }),

    // Update test record name (with ownership check)
    updateName: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input, ctx }) => {
        const record = await getTestRecordById(input.id);
        // Check ownership (admin can update all)
        if (record && record.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权修改此记录',
          });
        }
        const success = await updateTestRecordName(input.id, input.name);
        return { success };
      }),
  }),

  // Config Templates - Save and load test configurations (with user isolation)
  configTemplates: router({
    // Create a new config template (requires login)
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        config: z.any(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await createConfigTemplate({
          ...input,
          userId: ctx.user.id,
        });
        return { success: !!id, id };
      }),

    // Get all config templates for current user
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      }).optional())
      .query(async ({ input, ctx }) => {
        const templates = await getConfigTemplatesByUserId(ctx.user.id, input?.limit ?? 50);
        return templates;
      }),

    // Get all config templates (admin only)
    listAll: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).optional().default(100),
      }).optional())
      .query(async ({ input }) => {
        const templates = await getConfigTemplates(input?.limit ?? 100);
        return templates;
      }),

    // Get a single config template by ID (with ownership check)
    getById: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const template = await getConfigTemplateById(input.id);
        // Check ownership (admin can view all)
        if (template && template.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权访问此模板',
          });
        }
        return template;
      }),

    // Update a config template (with ownership check)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        config: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const template = await getConfigTemplateById(input.id);
        // Check ownership (admin can update all)
        if (template && template.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权修改此模板',
          });
        }
        const { id, ...data } = input;
        const success = await updateConfigTemplate(id, data);
        return { success };
      }),

    // Delete a config template (with ownership check)
    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const template = await getConfigTemplateById(input.id);
        // Check ownership (admin can delete all)
        if (template && template.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权删除此模板',
          });
        }
        const success = await deleteConfigTemplate(input.id);
        return { success };
      }),
  }),
});

export type AppRouter = typeof appRouter;
