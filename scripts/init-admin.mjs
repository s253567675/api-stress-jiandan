/**
 * Initialize admin user script
 * Run this script to create the first admin user
 * Usage: node scripts/init-admin.mjs <username> <password>
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { mysqlTable, int, varchar, mysqlEnum, timestamp, text } from 'drizzle-orm/mysql-core';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Define users table schema inline
const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  password: varchar("password", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/init-admin.mjs <username> <password>');
  console.log('Example: node scripts/init-admin.mjs admin admin123');
  process.exit(1);
}

const [username, password] = args;

if (username.length < 3) {
  console.error('Error: Username must be at least 3 characters');
  process.exit(1);
}

if (password.length < 6) {
  console.error('Error: Password must be at least 6 characters');
  process.exit(1);
}

async function main() {
  console.log('Connecting to database...');
  const db = drizzle(DATABASE_URL);

  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      console.error(`Error: User "${username}" already exists`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const openId = `local_${username}_${Date.now()}`;

    // Insert admin user
    await db.insert(users).values({
      openId,
      username,
      password: hashedPassword,
      name: username,
      role: 'admin',
      loginMethod: 'local',
      isActive: 1,
    });

    console.log(`✅ Admin user "${username}" created successfully!`);
    console.log('You can now login with these credentials.');
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
