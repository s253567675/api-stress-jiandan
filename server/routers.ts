import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

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
      }))
      .mutation(async ({ input }) => {
        const startTime = Date.now();
        
        try {
          const response = await fetch(input.url, {
            method: input.method,
            headers: input.headers,
            body: input.body,
          });
          
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
          const duration = Date.now() - startTime;
          return {
            success: false,
            status: 0,
            statusText: 'Network Error',
            duration,
            body: null,
            headers: {},
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
