import { eq, desc, and, or, like } from "drizzle-orm";
import * as bcrypt from 'bcryptjs';
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, testRecords, InsertTestRecord, TestRecord, configTemplates, InsertConfigTemplate, ConfigTemplate } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by username for local authentication
 */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create a new local user with username and password
 */
export async function createLocalUser(data: {
  username: string;
  password: string;
  name?: string;
  email?: string;
  role?: 'user' | 'admin';
}): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return null;
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // Generate a unique openId for local users
    const openId = `local_${data.username}_${Date.now()}`;
    
    const result = await db.insert(users).values({
      openId,
      username: data.username,
      password: hashedPassword,
      name: data.name || data.username,
      email: data.email,
      role: data.role || 'user',
      loginMethod: 'local',
      isActive: 1,
    });
    
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create user:", error);
    throw error;
  }
}

/**
 * Verify user password
 */
export async function verifyUserPassword(username: string, password: string): Promise<typeof users.$inferSelect | null> {
  const user = await getUserByUsername(username);
  if (!user || !user.password || user.isActive !== 1) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  // Update last signed in
  const db = await getDb();
  if (db) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  }

  return user;
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(limit: number = 100) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get users: database not available");
    return [];
  }

  try {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get users:", error);
    return [];
  }
}

/**
 * Update user (admin only)
 */
export async function updateUser(id: number, data: {
  name?: string;
  email?: string | null;
  role?: 'user' | 'admin';
  isActive?: number;
  password?: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return false;
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    await db.update(users).set(updateData).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update user:", error);
    return false;
  }
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete user: database not available");
    return false;
  }

  try {
    await db.delete(users).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete user:", error);
    return false;
  }
}

// Test Records CRUD operations

/**
 * Create a new test record
 */
export async function createTestRecord(record: InsertTestRecord): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create test record: database not available");
    return null;
  }

  try {
    const result = await db.insert(testRecords).values(record);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create test record:", error);
    throw error;
  }
}

/**
 * Get all test records, ordered by creation date (newest first)
 */
export async function getTestRecords(limit: number = 50): Promise<TestRecord[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get test records: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(testRecords)
      .orderBy(desc(testRecords.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get test records:", error);
    return [];
  }
}

/**
 * Get a single test record by ID
 */
export async function getTestRecordById(id: number): Promise<TestRecord | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get test record: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(testRecords)
      .where(eq(testRecords.id, id))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get test record:", error);
    return null;
  }
}

/**
 * Delete a test record by ID
 */
export async function deleteTestRecord(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete test record: database not available");
    return false;
  }

  try {
    await db.delete(testRecords).where(eq(testRecords.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete test record:", error);
    return false;
  }
}

/**
 * Update test record name
 */
export async function updateTestRecordName(id: number, name: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update test record: database not available");
    return false;
  }

  try {
    await db.update(testRecords).set({ name }).where(eq(testRecords.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update test record:", error);
    return false;
  }
}

// Config Templates CRUD operations

/**
 * Create a new config template
 */
export async function createConfigTemplate(template: InsertConfigTemplate): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create config template: database not available");
    return null;
  }

  try {
    const result = await db.insert(configTemplates).values(template);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create config template:", error);
    throw error;
  }
}

/**
 * Get all config templates, ordered by update date (newest first)
 */
export async function getConfigTemplates(limit: number = 50): Promise<ConfigTemplate[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get config templates: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(configTemplates)
      .orderBy(desc(configTemplates.updatedAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get config templates:", error);
    return [];
  }
}

/**
 * Get a single config template by ID
 */
export async function getConfigTemplateById(id: number): Promise<ConfigTemplate | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get config template: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(configTemplates)
      .where(eq(configTemplates.id, id))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get config template:", error);
    return null;
  }
}

/**
 * Update a config template
 */
export async function updateConfigTemplate(id: number, data: { name?: string; description?: string; config?: unknown }): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update config template: database not available");
    return false;
  }

  try {
    await db.update(configTemplates).set(data).where(eq(configTemplates.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update config template:", error);
    return false;
  }
}

/**
 * Delete a config template by ID
 */
export async function deleteConfigTemplate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete config template: database not available");
    return false;
  }

  try {
    await db.delete(configTemplates).where(eq(configTemplates.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete config template:", error);
    return false;
  }
}

// User-scoped queries for data isolation

/**
 * Get test records by user ID (for data isolation)
 */
export async function getTestRecordsByUserId(userId: number, limit: number = 50): Promise<TestRecord[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get test records: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(testRecords)
      .where(eq(testRecords.userId, userId))
      .orderBy(desc(testRecords.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get test records:", error);
    return [];
  }
}

/**
 * Get config templates by user ID (for data isolation)
 */
export async function getConfigTemplatesByUserId(userId: number, limit: number = 50): Promise<ConfigTemplate[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get config templates: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(configTemplates)
      .where(eq(configTemplates.userId, userId))
      .orderBy(desc(configTemplates.updatedAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get config templates:", error);
    return [];
  }
}
