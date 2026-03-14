import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCb);

export async function installFeatures(opts: {
	projectDir: string;
}): Promise<{ installed: boolean; migrated: boolean }> {
	const { projectDir } = opts;

	// Step 1: bun install (try --frozen-lockfile first, fallback to bun install)
	try {
		await execFileAsync("bun", ["install", "--frozen-lockfile"], {
			cwd: projectDir,
			timeout: 120_000,
		});
	} catch {
		await execFileAsync("bun", ["install"], {
			cwd: projectDir,
			timeout: 120_000,
		});
	}

	// Step 2: Run drizzle-kit push if DATABASE_URL exists in .env
	let migrated = false;
	const envPath = join(projectDir, ".env");
	try {
		const envContent = await readFile(envPath, "utf-8");
		const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
		if (dbUrlMatch) {
			const drizzleDir = join(projectDir, "packages/drizzle");
			await execFileAsync("bunx", ["drizzle-kit", "push", "--force"], {
				cwd: drizzleDir,
				env: {
					...process.env,
					DATABASE_URL: dbUrlMatch[1],
				},
				timeout: 60_000,
			});
			migrated = true;
		}
	} catch {
		// .env missing or migration failed — non-fatal for install step
	}

	return { installed: true, migrated };
}
