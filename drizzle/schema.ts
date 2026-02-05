import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Test records table for storing stress test results
 */
export const testRecords = mysqlTable("test_records", {
  id: int("id").autoincrement().primaryKey(),
  /** Test name/label for easy identification */
  name: varchar("name", { length: 255 }).notNull(),
  /** Target API URL */
  url: text("url").notNull(),
  /** HTTP method used */
  method: varchar("method", { length: 10 }).notNull(),
  /** Test configuration (JSON) */
  config: json("config"),
  /** Test status: completed, failed, cancelled */
  status: mysqlEnum("status", ["completed", "failed", "cancelled"]).default("completed").notNull(),
  
  // Core metrics
  /** Total number of requests */
  totalRequests: int("totalRequests").notNull(),
  /** Number of successful requests */
  successCount: int("successCount").notNull(),
  /** Number of failed requests */
  failCount: int("failCount").notNull(),
  /** Average latency in ms */
  avgLatency: int("avgLatency").notNull(),
  /** Minimum latency in ms */
  minLatency: int("minLatency").notNull(),
  /** Maximum latency in ms */
  maxLatency: int("maxLatency").notNull(),
  /** P50 latency in ms */
  p50Latency: int("p50Latency").notNull(),
  /** P90 latency in ms */
  p90Latency: int("p90Latency").notNull(),
  /** P95 latency in ms */
  p95Latency: int("p95Latency").notNull(),
  /** P99 latency in ms */
  p99Latency: int("p99Latency").notNull(),
  /** Throughput (requests per second) */
  throughput: int("throughput").notNull(),
  /** Error rate percentage */
  errorRate: int("errorRate").notNull(),
  /** Test duration in seconds */
  duration: int("duration").notNull(),
  
  // Status code distribution (JSON)
  statusCodes: json("statusCodes"),
  /** Business status codes distribution (JSON) */
  businessCodes: json("businessCodes"),
  
  // Time series data for charts (JSON)
  timeSeries: json("timeSeries"),
  
  /** User who ran the test (optional, for multi-user support) */
  userId: int("userId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TestRecord = typeof testRecords.$inferSelect;
export type InsertTestRecord = typeof testRecords.$inferInsert;

/**
 * Configuration templates for saving and reusing test configurations
 */
export const configTemplates = mysqlTable("config_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Template name for easy identification */
  name: varchar("name", { length: 255 }).notNull(),
  /** Template description */
  description: text("description"),
  /** Full test configuration (JSON) */
  config: json("config").notNull(),
  /** User who created the template (optional) */
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConfigTemplate = typeof configTemplates.$inferSelect;
export type InsertConfigTemplate = typeof configTemplates.$inferInsert;
