import { db } from "@superset/db/client";
import { AUTH_SCHEMA_NAME } from "@superset/db/schema/auth";
import { sql } from "drizzle-orm";

const REQUIRED_BETTER_AUTH_TABLES = [
	"users",
	"sessions",
	"accounts",
	"verifications",
	"organizations",
	"members",
	"invitations",
	"oauth_clients",
	"oauth_refresh_tokens",
	"oauth_access_tokens",
	"oauth_consents",
	"apikeys",
	"jwkss",
] as const;

type TableRow = { table_name: string };

export type AuthSchemaReadiness = {
	ready: boolean;
	missingTables: string[];
};

export async function getAuthSchemaReadiness(): Promise<AuthSchemaReadiness> {
	const result = await db.execute(
		sql`select table_name from information_schema.tables where table_schema = ${AUTH_SCHEMA_NAME}`,
	);
	const rows = ((result as unknown as { rows?: TableRow[] }).rows ??
		[]) as TableRow[];
	const existingTables = new Set(rows.map((row) => row.table_name));
	const missingTables = REQUIRED_BETTER_AUTH_TABLES.filter(
		(tableName) => !existingTables.has(tableName),
	).map((tableName) => `${AUTH_SCHEMA_NAME}.${tableName}`);

	return {
		ready: missingTables.length === 0,
		missingTables,
	};
}

export function isMissingRelationError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return (
		error.message.includes(`relation "${AUTH_SCHEMA_NAME}.`) &&
		error.message.includes('" does not exist')
	);
}
