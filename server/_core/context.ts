import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { localAuth } from "../localAuth";
import { COOKIE_NAME, LOCAL_COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }
  const parsed = parseCookieHeader(cookieHeader);
  return new Map(Object.entries(parsed));
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookies = parseCookies(opts.req.headers.cookie);

  // Try local authentication first
  const localCookie = cookies.get(LOCAL_COOKIE_NAME);
  if (localCookie) {
    try {
      user = await localAuth.getUserFromSession(localCookie);
    } catch (error) {
      console.warn("[Context] Local auth failed:", error);
      user = null;
    }
  }

  // Fall back to OAuth authentication if no local user
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
