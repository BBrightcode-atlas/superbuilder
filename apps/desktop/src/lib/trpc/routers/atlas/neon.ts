import { z } from "zod";
import { eq } from "drizzle-orm";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { scryptSync, randomBytes } from "node:crypto";
import { publicProcedure, router } from "../..";
import { localDb } from "main/lib/local-db";
import { atlasIntegrations, atlasProjects } from "@superset/local-db";
import { encrypt, decrypt } from "../auth/utils/crypto-storage";
import { getProcessEnvWithShellPath } from "../workspaces/utils/shell-env";

const execFileAsync = promisify(execFileCb);

const NEON_API = "https://console.neon.tech/api/v2";

async function getNeonApiKey(): Promise<string> {
	const envKey = process.env.NEON_API_KEY;
	if (envKey) return envKey;

	const [integration] = await localDb
		.select()
		.from(atlasIntegrations)
		.where(eq(atlasIntegrations.service, "neon"));
	if (!integration) throw new Error("Neon API key not configured");
	return decrypt(integration.encryptedToken);
}

async function neonFetch(path: string, options: RequestInit = {}) {
	const apiKey = await getNeonApiKey();
	const res = await fetch(`${NEON_API}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Neon API error (${res.status}): ${body}`);
	}
	return res.json();
}

export const createAtlasNeonRouter = () =>
	router({
		saveToken: publicProcedure
			.input(z.object({ token: z.string().min(1) }))
			.mutation(async ({ input }) => {
				// Verify token by calling /projects
				try {
					const res = await fetch(`${NEON_API}/projects?limit=1`, {
						headers: { Authorization: `Bearer ${input.token}` },
					});
					if (!res.ok) throw new Error("Invalid token");
				} catch {
					throw new Error(
						"토큰 검증 실패: Neon에 연결할 수 없습니다",
					);
				}

				const encrypted = encrypt(input.token);

				await localDb
					.delete(atlasIntegrations)
					.where(eq(atlasIntegrations.service, "neon"));

				await localDb.insert(atlasIntegrations).values({
					service: "neon",
					encryptedToken: encrypted,
				});

				return { success: true };
			}),

		removeToken: publicProcedure.mutation(async () => {
			await localDb
				.delete(atlasIntegrations)
				.where(eq(atlasIntegrations.service, "neon"));
			return { success: true };
		}),

		getConnectionStatus: publicProcedure.query(async () => {
			if (process.env.NEON_API_KEY) return { connected: true };
			const [integration] = await localDb
				.select()
				.from(atlasIntegrations)
				.where(eq(atlasIntegrations.service, "neon"));
			return { connected: !!integration };
		}),

		listOrganizations: publicProcedure.query(async () => {
			// Try /users/me/organizations first (personal API key)
			// Fall back to extracting org info from /projects (org API key)
			try {
				const data = await neonFetch("/users/me/organizations");
				return (data.organizations ?? data ?? []) as Array<{
					id: string;
					name: string;
				}>;
			} catch {
				// Org API key — extract org info from projects list
				try {
					const data = await neonFetch("/projects?limit=1");
					const projects = data.projects ?? [];
					if (projects.length > 0 && projects[0].org_id) {
						return [
							{
								id: projects[0].org_id as string,
								name: projects[0].org_id as string,
							},
						];
					}
				} catch {
					// ignore
				}
				return [] as Array<{ id: string; name: string }>;
			}
		}),

		createProject: publicProcedure
			.input(
				z.object({
					name: z.string().min(1),
					orgId: z.string().optional(),
					atlasProjectId: z.string().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				const projectPayload: Record<string, unknown> = {
					name: input.name,
				};
				if (input.orgId) {
					projectPayload.org_id = input.orgId;
				}

				const data = await neonFetch("/projects", {
					method: "POST",
					body: JSON.stringify({ project: projectPayload }),
				});

				const project = data.project;
				const connectionUri =
					data.connection_uris?.[0]?.connection_uri ?? "";

				await localDb
					.update(atlasProjects)
					.set({
						neonProjectId: project.id,
						neonConnectionString: connectionUri,
						updatedAt: Date.now(),
					})
					.where(eq(atlasProjects.id, input.atlasProjectId));

				return {
					id: project.id,
					name: project.name,
					connectionUri,
				};
			}),

		getConnectionString: publicProcedure
			.input(z.object({ projectId: z.string().min(1) }))
			.query(async ({ input }) => {
				const data = await neonFetch(
					`/projects/${input.projectId}/connection_uri`,
				);
				return { connectionUri: data.uri as string };
			}),

		writeEnvFile: publicProcedure
			.input(
				z.object({
					projectPath: z.string(),
					connectionUri: z.string(),
					neonProjectId: z.string(),
					betterAuthSecret: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const envPath = join(input.projectPath, ".env");
				let existing = "";
				try {
					existing = await readFile(envPath, "utf-8");
				} catch {
					// File doesn't exist yet
				}

				const envLines = [
					`DATABASE_URL=${input.connectionUri}`,
					`NEON_PROJECT_ID=${input.neonProjectId}`,
				];

				if (input.betterAuthSecret) {
					envLines.push(`BETTER_AUTH_SECRET=${input.betterAuthSecret}`);
				}

				const neonEnv = envLines.join("\n");

				const newContent = existing
					? `${existing}\n\n# Neon + Auth (auto-generated by Composer)\n${neonEnv}\n`
					: `# Neon + Auth (auto-generated by Composer)\n${neonEnv}\n`;

				await writeFile(envPath, newContent, "utf-8");
				return { envPath };
			}),

		runMigration: publicProcedure
			.input(
				z.object({
					projectPath: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const shellEnv = await getProcessEnvWithShellPath();

				// Read .env to get DATABASE_URL for drizzle-kit
				const envPath = join(input.projectPath, ".env");
				let envContent = "";
				try {
					envContent = await readFile(envPath, "utf-8");
				} catch {
					throw new Error(".env file not found — run writeEnvFile first");
				}

				// Parse DATABASE_URL from .env
				const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
				if (!dbUrlMatch) {
					throw new Error("DATABASE_URL not found in .env");
				}

				const drizzleDir = join(input.projectPath, "packages/drizzle");

				try {
					const { stdout, stderr } = await execFileAsync(
						"bunx",
						["drizzle-kit", "push", "--force"],
						{
							cwd: drizzleDir,
							env: {
								...shellEnv,
								DATABASE_URL: dbUrlMatch[1],
							},
							timeout: 60_000,
						},
					);
					return {
						success: true,
						stdout: stdout.slice(0, 2000),
						stderr: stderr.slice(0, 2000),
					};
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					return {
						success: false,
						stdout: "",
						stderr: msg.slice(0, 2000),
					};
				}
			}),

		seedOwner: publicProcedure
			.input(
				z.object({
					projectPath: z.string(),
					email: z.string(),
					name: z.string(),
					password: z.string(),
					projectSlug: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const shellEnv = await getProcessEnvWithShellPath();

				// Read DATABASE_URL from .env
				const envPath = join(input.projectPath, ".env");
				const envContent = await readFile(envPath, "utf-8");
				const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
				if (!dbUrlMatch) throw new Error("DATABASE_URL not found in .env");

				// Hash password using scrypt — Better Auth compatible format: salt_hex:key_hex
				// Better Auth uses: N=16384, r=16, p=1, dkLen=64
				const salt = randomBytes(16);
				const key = scryptSync(
					input.password.normalize("NFKC"),
					salt.toString("hex"),
					64,
					{ N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
				);
				const passwordHash = `${salt.toString("hex")}:${key.toString("hex")}`;

				// Write temp seed script (uses postgres from project deps)
				const seedScript = `
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const userId = crypto.randomUUID();
const orgId = crypto.randomUUID();
const now = new Date();

try {
  await sql\`
    INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
    VALUES (\${userId}, \${process.env.SEED_NAME}, \${process.env.SEED_EMAIL}, true, \${now}, \${now})
  \`;

  await sql\`
    INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES (\${crypto.randomUUID()}, \${process.env.SEED_EMAIL}, 'credential', \${userId}, \${process.env.SEED_PASSWORD_HASH}, \${now}, \${now})
  \`;

  await sql\`
    INSERT INTO organizations (id, name, slug, created_at)
    VALUES (\${orgId}, \${process.env.SEED_PROJECT_SLUG}, \${process.env.SEED_PROJECT_SLUG}, \${now})
  \`;

  await sql\`
    INSERT INTO members (id, organization_id, user_id, role, created_at)
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

				const seedPath = join(input.projectPath, "_seed-owner.mjs");
				await writeFile(seedPath, seedScript, "utf-8");

				try {
					// Ensure deps are installed (postgres package is needed)
					try {
						await execFileAsync("bun", ["install", "--frozen-lockfile"], {
							cwd: input.projectPath,
							env: shellEnv,
							timeout: 120_000,
						});
					} catch {
						await execFileAsync("bun", ["install"], {
							cwd: input.projectPath,
							env: shellEnv,
							timeout: 120_000,
						});
					}

					const { stdout } = await execFileAsync(
						"bun",
						["run", seedPath],
						{
							cwd: input.projectPath,
							env: {
								...shellEnv,
								DATABASE_URL: dbUrlMatch[1],
								SEED_NAME: input.name,
								SEED_EMAIL: input.email,
								SEED_PASSWORD_HASH: passwordHash,
								SEED_PROJECT_SLUG: input.projectSlug,
							},
							timeout: 30_000,
						},
					);

					await unlink(seedPath).catch(() => {});

					const result = JSON.parse(stdout.trim());
					return result as { success: boolean; userId: string; orgId: string };
				} catch (error) {
					await unlink(seedPath).catch(() => {});
					const msg = error instanceof Error ? error.message : String(error);
					return {
						success: false,
						userId: null,
						orgId: null,
						error: msg.slice(0, 500),
					};
				}
			}),
	});
