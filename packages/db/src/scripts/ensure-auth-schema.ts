import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

const DATABASE_URL =
	process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("DATABASE_URL or DATABASE_URL_UNPOOLED is not set in .env");
	process.exit(1);
}

async function ensureAuthSchema() {
	const pool = new Pool({ connectionString: DATABASE_URL });

	try {
		await pool.query("CREATE SCHEMA IF NOT EXISTS auth");
		console.log("Ensured schema: auth");
	} finally {
		await pool.end();
	}
}

ensureAuthSchema().catch((error) => {
	console.error("Ensure auth schema failed:", error);
	process.exit(1);
});
