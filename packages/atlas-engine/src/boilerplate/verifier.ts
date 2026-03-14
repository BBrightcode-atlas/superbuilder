import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadManifest } from "../manifest/local";

const execFile = promisify(execFileCb);

export interface VerificationCheck {
	name: string;
	passed: boolean;
	details: string;
}

export interface VerificationResult {
	checks: VerificationCheck[];
	allPassed: boolean;
}

/**
 * Worktree에서 피처 검증을 수행합니다.
 *
 * 검증 항목:
 * 1. TypeScript typecheck
 * 2. Lint
 * 3. superbuilder.json에 피처 entry 존재
 * 4. Marker 파일에 connection entry 존재
 * 5. Git status clean (uncommitted changes 없음)
 * 6. Branch pushed to remote
 */
export async function runVerificationChecks(
	worktreePath: string,
	featureName: string,
): Promise<VerificationResult> {
	const checks: VerificationCheck[] = [];

	// 1. TypeScript typecheck
	checks.push(await checkTypeScript(worktreePath));

	// 2. Lint
	checks.push(await checkLint(worktreePath));

	// 3. superbuilder.json
	checks.push(await checkManifest(worktreePath, featureName));

	// 4. Marker connections
	checks.push(await checkMarkerConnections(worktreePath, featureName));

	// 5. Git status clean
	checks.push(await checkGitClean(worktreePath));

	// 6. Branch pushed
	checks.push(await checkBranchPushed(worktreePath, featureName));

	return {
		checks,
		allPassed: checks.every((c) => c.passed),
	};
}

async function checkTypeScript(
	worktreePath: string,
): Promise<VerificationCheck> {
	try {
		await execFile("bun", ["run", "typecheck"], {
			cwd: worktreePath,
			timeout: 120_000,
		});
		return { name: "typecheck", passed: true, details: "TypeScript 검증 통과" };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			name: "typecheck",
			passed: false,
			details: `TypeScript 에러: ${message.slice(0, 500)}`,
		};
	}
}

async function checkLint(worktreePath: string): Promise<VerificationCheck> {
	try {
		await execFile("bun", ["run", "lint"], {
			cwd: worktreePath,
			timeout: 60_000,
		});
		return { name: "lint", passed: true, details: "Lint 통과" };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			name: "lint",
			passed: false,
			details: `Lint 에러: ${message.slice(0, 500)}`,
		};
	}
}

async function checkManifest(
	worktreePath: string,
	featureName: string,
): Promise<VerificationCheck> {
	const manifest = await loadManifest(worktreePath);
	if (!manifest) {
		return {
			name: "manifest",
			passed: false,
			details: "superbuilder.json 파일을 찾을 수 없습니다",
		};
	}

	if (!manifest.features[featureName]) {
		return {
			name: "manifest",
			passed: false,
			details: `superbuilder.json에 "${featureName}" 항목이 없습니다`,
		};
	}

	const entry = manifest.features[featureName];
	if (!entry.paths.server) {
		return {
			name: "manifest",
			passed: false,
			details: `"${featureName}" 항목에 server 경로가 없습니다`,
		};
	}

	return {
		name: "manifest",
		passed: true,
		details: `superbuilder.json에 "${featureName}" 항목 확인됨`,
	};
}

async function checkMarkerConnections(
	worktreePath: string,
	featureName: string,
): Promise<VerificationCheck> {
	// Check key marker files for feature's import/module entries
	const filesToCheck = [
		{
			path: "apps/atlas-server/src/app.module.ts",
			search: `@repo/features/${featureName}`,
		},
		{
			path: "apps/atlas-server/src/trpc/router.ts",
			search: `@repo/features/${featureName}`,
		},
		{
			path: "packages/features/app-router.ts",
			search: `./${featureName}`,
		},
	];

	const missing: string[] = [];

	for (const { path, search } of filesToCheck) {
		try {
			const content = await readFile(join(worktreePath, path), "utf-8");
			if (!content.includes(search)) {
				missing.push(path);
			}
		} catch {
			missing.push(`${path} (파일 없음)`);
		}
	}

	if (missing.length > 0) {
		return {
			name: "marker_connections",
			passed: false,
			details: `다음 파일에 marker entry 누락: ${missing.join(", ")}`,
		};
	}

	return {
		name: "marker_connections",
		passed: true,
		details: "모든 marker 파일에 connection entry 확인됨",
	};
}

async function checkGitClean(worktreePath: string): Promise<VerificationCheck> {
	try {
		const { stdout } = await execFile("git", ["status", "--porcelain"], {
			cwd: worktreePath,
		});
		if (stdout.trim().length > 0) {
			return {
				name: "git_clean",
				passed: false,
				details: `커밋되지 않은 변경사항 존재:\n${stdout.trim().slice(0, 300)}`,
			};
		}
		return {
			name: "git_clean",
			passed: true,
			details: "모든 변경사항이 커밋됨",
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			name: "git_clean",
			passed: false,
			details: `Git 상태 확인 실패: ${message}`,
		};
	}
}

async function checkBranchPushed(
	worktreePath: string,
	featureName: string,
): Promise<VerificationCheck> {
	try {
		const branchName = `feature/${featureName}`;
		const { stdout } = await execFile(
			"git",
			["log", `origin/${branchName}..HEAD`, "--oneline"],
			{ cwd: worktreePath },
		);
		if (stdout.trim().length > 0) {
			return {
				name: "branch_pushed",
				passed: false,
				details: `Push되지 않은 커밋 존재: ${stdout.trim()}`,
			};
		}
		return {
			name: "branch_pushed",
			passed: true,
			details: "모든 커밋이 remote에 push됨",
		};
	} catch {
		// remote branch가 없을 수 있음
		return {
			name: "branch_pushed",
			passed: false,
			details: `Remote branch "feature/${featureName}"를 찾을 수 없습니다. push가 필요합니다.`,
		};
	}
}
