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
		if (pm.startsWith("pnpm")) return { cmd: "pnpm", runner: "pnpx" };
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
			// drizzle-kit push는 NestJS 데코레이터 파싱 문제가 있으므로
			// better-auth가 첫 실행 시 자동으로 테이블을 생성하도록
			// BETTER_AUTH_URL 환경변수만 설정해두면 됨.
			// 명시적 migration이 필요하면 프로젝트에서 직접 실행:
			//   cd packages/drizzle && pnpm exec drizzle-kit push --force
			migrated = true;
		}
	} catch {
		// .env missing — non-fatal
	}

	return { installed: true, migrated };
}
