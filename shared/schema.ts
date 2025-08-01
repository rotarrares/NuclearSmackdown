import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Game types
export interface Player {
  id: string;
  username: string;
  color: string;
  gold: number;
  population: number;
  workerRatio: number; // 0-1, percentage of population that are workers (vs soldiers)
  lastActive: number;
}

export interface GameTile {
  id: number;
  ownerId?: string;
  hasCity: boolean;
  hasPort: boolean;
  hasMissileSilo?: boolean;
  population: number;
  terrainType: 'water' | 'grass' | 'desert' | 'mountain';
}

export interface GameMessage {
  type: 'spawn_player' | 'select_tile' | 'expand_territory' | 'adjust_worker_ratio' | 'build_structure';
  data: any;
}
