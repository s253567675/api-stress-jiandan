import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, testRecords, InsertTestRecord, TestRecord } from "../drizzle/schema";
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
