import { neon, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool as NodePgPool } from "pg";

import { env } from "./env";
import * as schema from "./schema";

config({ path: ".env", quiet: true });

const sql = neon(env.DATABASE_URL);
const nodePgPool = new NodePgPool({ connectionString: env.DATABASE_URL });

function shouldUseNodePgClient(connectionString: string): boolean {
	const hostname = new URL(connectionString).hostname.toLowerCase();

	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
		!hostname.endsWith(".neon.tech")
	);
}

export const db = shouldUseNodePgClient(env.DATABASE_URL)
	? drizzleNodePg({
			client: nodePgPool,
			schema,
			casing: "snake_case",
		})
	: drizzle({
			client: sql,
			schema,
			casing: "snake_case",
		});

export const dbWs = drizzleWs({
	client: new Pool({ connectionString: env.DATABASE_URL }),
	schema,
	casing: "snake_case",
});
