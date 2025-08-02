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
  troopDeployment: number; // 0-1, percentage of soldiers to deploy for combat/expansion
  conquestTroops: number; // Number of troops currently allocated to conquering
  isConquering: boolean; // Whether player is actively conquering
  spawnTileId: number; // ID of the tile where player spawned
  joinedAt: number; // Timestamp when player joined
  lastActive: number;
  allianceId?: string;
  lastPopulationGrowth: number;
}

export interface GameTile {
  id: number;
  ownerId?: string;
  structureType?: "city" | "port" | "missile_silo" | "base_hq";
  population: number;
  terrainType: "water" | "grass" | "desert" | "mountain";
  isIrradiated?: boolean;
}

export interface Missile {
  id: string;
  fromTileId: number;
  toTileId: number;
  playerId: string;
  launchTime: number;
  travelTime: number;
  trajectory: [number, number, number][];
}

export interface GameMessage {
  type:
    | "spawn_player"
    | "select_tile"
    | "expand_territory"
    | "adjust_worker_ratio"
    | "adjust_troop_deployment"
    | "start_conquest"
    | "cancel_conquest"
    | "build_structure"
    | "launch_missile"
    | "create_alliance"
    | "join_alliance"
    | "leave_alliance"
    | "kick_from_alliance";
  data: any;
}

export interface Missile {
  id: string;
  fromTileId: number;
  toTileId: number;
  playerId: string;
  launchTime: number;
  travelTime: number; // milliseconds for missile to reach target
  trajectory: [number, number, number][]; // 3D points along the path
}

export interface Alliance {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  isPublic: boolean;
}
