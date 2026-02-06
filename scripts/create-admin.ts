import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import * as bcrypt from "bcryptjs";
import { users } from "../drizzle/schema";

async function createAdmin() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);
  
  const username = "admin";
  const password = "admin123";
  const hashedPassword = await bcrypt.hash(password, 10);
  const openId = `local_${username}_${Date.now()}`;

  try {
    await db.insert(users).values({
      openId,
      username,
      password: hashedPassword,
      name: "Administrator",
      role: "admin",
      loginMethod: "local",
      isActive: 1,
    });

    console.log("Admin user created successfully!");
    console.log("Username: admin");
    console.log("Password: admin123");
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      console.log("Admin user already exists");
    } else {
      console.error("Failed to create admin user:", error);
    }
  }

  process.exit(0);
}

createAdmin();
