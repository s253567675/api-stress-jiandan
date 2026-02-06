/**
 * Local authentication service for username/password login
 * This extends the OAuth-based authentication to support local users
 */

import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { ONE_YEAR_MS } from "@shared/const";
import * as db from "./db";
import type { User } from "../drizzle/schema";

export type LocalSessionPayload = {
  userId: number;
  username: string;
  role: 'user' | 'admin';
  type: 'local';
};

class LocalAuthService {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a local user
   */
  async createLocalSessionToken(
    user: User,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'local',
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * Verify a local session token
   */
  async verifyLocalSession(
    cookieValue: string | undefined | null
  ): Promise<LocalSessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });

      const { userId, username, role, type } = payload as Record<string, unknown>;

      // Only accept local session tokens
      if (type !== 'local') {
        return null;
      }

      if (
        typeof userId !== 'number' ||
        typeof username !== 'string' ||
        (role !== 'user' && role !== 'admin')
      ) {
        console.warn("[LocalAuth] Session payload missing required fields");
        return null;
      }

      return {
        userId,
        username,
        role,
        type: 'local',
      };
    } catch (error) {
      console.warn("[LocalAuth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<{ user: User; token: string } | null> {
    const user = await db.verifyUserPassword(username, password);
    if (!user) {
      return null;
    }

    const token = await this.createLocalSessionToken(user);
    return { user, token };
  }

  /**
   * Get user from local session
   */
  async getUserFromSession(cookieValue: string | undefined | null): Promise<User | null> {
    const session = await this.verifyLocalSession(cookieValue);
    if (!session) {
      return null;
    }

    const user = await db.getUserById(session.userId);
    if (!user || user.isActive !== 1) {
      return null;
    }

    return user;
  }
}

export const localAuth = new LocalAuthService();
