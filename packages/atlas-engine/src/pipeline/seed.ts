import { execFile as execFileCb } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { appendFile, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type { SeedResult } from "./types";

const execFileAsync = promisify(execFileCb);

export async function seedInitialData(opts: {
	projectDir: string;
	ownerEmail?: string;
	ownerPassword?: string;
	ownerName?: string;
	projectSlug?: string;
}): Promise<SeedResult> {
	const email = opts.ownerEmail ?? "admin@superbuilder.app";
	const password = opts.ownerPassword ?? "changeme!!";
	const name = opts.ownerName ?? "Admin";
	const projectSlug = opts.projectSlug ?? basename(opts.projectDir);

	// Read DATABASE_URL from .env
	const envPath = join(opts.projectDir, ".env");
	const envContent = await readFile(envPath, "utf-8");
	const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
	if (!dbUrlMatch) throw new Error("DATABASE_URL not found in .env");

	// Hash password using scrypt — Better Auth compatible format: salt_hex:key_hex
	// Better Auth uses: N=16384, r=16, p=1, dkLen=64
	const salt = randomBytes(16);
	const key = scryptSync(password.normalize("NFKC"), salt.toString("hex"), 64, {
		N: 16384,
		r: 16,
		p: 1,
		maxmem: 128 * 16384 * 16 * 2,
	});
	const passwordHash = `${salt.toString("hex")}:${key.toString("hex")}`;

	// Write temp seed script (uses postgres from project deps)
	const seedScript = `
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const userId = crypto.randomUUID();
const orgId = crypto.randomUUID();
const now = new Date();

try {
  // Create tables if they don't exist (better-auth core schema)
  await sql\`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      image TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      banned BOOLEAN DEFAULT false,
      ban_reason TEXT,
      ban_expires TIMESTAMP,
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_secret TEXT,
      two_factor_backup_codes TEXT,
      is_active BOOLEAN DEFAULT true,
      marketing_consent_at TIMESTAMP,
      deleted_at TIMESTAMP
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id),
      password TEXT,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at TIMESTAMP NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES "user"(id),
      two_factor_verified BOOLEAN DEFAULT false,
      active_organization_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      active_organization_id TEXT
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS organization (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      logo TEXT,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS member (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organization(id),
      user_id TEXT NOT NULL REFERENCES "user"(id),
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      role TEXT DEFAULT 'member',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  \`;

  // Seed data
  await sql\`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (\${userId}, \${process.env.SEED_NAME}, \${process.env.SEED_EMAIL}, true, \${now}, \${now})
  \`;

  await sql\`
    INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES (\${crypto.randomUUID()}, \${process.env.SEED_EMAIL}, 'credential', \${userId}, \${process.env.SEED_PASSWORD_HASH}, \${now}, \${now})
  \`;

  await sql\`
    INSERT INTO organization (id, name, slug, created_at)
    VALUES (\${orgId}, \${process.env.SEED_PROJECT_SLUG}, \${process.env.SEED_PROJECT_SLUG}, \${now})
  \`;

  await sql\`
    INSERT INTO member (id, organization_id, user_id, role, created_at)
    VALUES (\${crypto.randomUUID()}, \${orgId}, \${userId}, 'owner', \${now})
  \`;

  await sql\`
    INSERT INTO profiles (id, name, email, role, created_at, updated_at)
    VALUES (\${userId}, \${process.env.SEED_NAME}, \${process.env.SEED_EMAIL}, 'owner', \${now}, \${now})
  \`;

  console.log(JSON.stringify({ success: true, userId, orgId }));
} catch (e) {
  console.error(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
} finally {
  await sql.end();
}
`;

	const seedPath = join(opts.projectDir, "packages/drizzle/_seed-owner.mjs");
	await writeFile(seedPath, seedScript, "utf-8");

	try {
		// Dependencies already installed by installFeatures() step
		// Run seed script from packages/drizzle where postgres package is available
		const { stdout } = await execFileAsync("bun", ["run", seedPath], {
			cwd: join(opts.projectDir, "packages/drizzle"),
			env: {
				...process.env,
				DATABASE_URL: dbUrlMatch[1],
				SEED_NAME: name,
				SEED_EMAIL: email,
				SEED_PASSWORD_HASH: passwordHash,
				SEED_PROJECT_SLUG: projectSlug,
			},
			timeout: 30_000,
		});

		await unlink(seedPath).catch(() => {});

		const result = JSON.parse(stdout.trim()) as {
			success: boolean;
			userId: string;
			orgId: string;
		};

		if (!result.success) {
			throw new Error("Seed script returned success: false");
		}

		// Append SYSTEM_ORG_ID to .env
		await appendFile(envPath, `SYSTEM_ORG_ID=${result.orgId}\n`, "utf-8");

		return {
			systemOrgId: result.orgId,
			ownerEmail: email,
			ownerPassword: password,
		};
	} catch (error) {
		await unlink(seedPath).catch(() => {});
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`Seed failed: ${msg.slice(0, 500)}`);
	}
}
