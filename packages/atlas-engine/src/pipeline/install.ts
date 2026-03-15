import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCb);

/** Detect package manager from project's package.json */
async function detectPM(
	projectDir: string,
): Promise<{ cmd: string; runner: string }> {
	try {
		const raw = await readFile(join(projectDir, "package.json"), "utf-8");
		const pkg = JSON.parse(raw);
		const pm = pkg.packageManager ?? "";
		if (pm.startsWith("pnpm")) return { cmd: "pnpm", runner: "pnpm" };
		if (pm.startsWith("yarn")) return { cmd: "yarn", runner: "yarn" };
	} catch {}
	return { cmd: "bun", runner: "bunx" };
}

export async function installFeatures(opts: {
	projectDir: string;
}): Promise<{ installed: boolean; migrated: boolean }> {
	const { projectDir } = opts;
	const pm = await detectPM(projectDir);

	// Step 1: Install dependencies
	try {
		await execFileAsync(pm.cmd, ["install", "--frozen-lockfile"], {
			cwd: projectDir,
			timeout: 120_000,
		});
	} catch {
		await execFileAsync(pm.cmd, ["install"], {
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
			const drizzleDir = join(projectDir, "packages", "drizzle");
			const runnerArgs =
				pm.cmd === "pnpm"
					? ["exec", "drizzle-kit", "push", "--force"]
					: ["drizzle-kit", "push", "--force"];
			await execFileAsync(
				pm.cmd === "pnpm" ? "pnpm" : pm.runner,
				runnerArgs,
				{
					cwd: drizzleDir,
					timeout: 60_000,
					env: { ...process.env, DATABASE_URL: dbUrlMatch[1] },
				},
			);
			migrated = true;
		}
	} catch {
		// drizzle-kit push 실패 — non-fatal, 수동 실행 안내
	}

	return { installed: true, migrated };
}
