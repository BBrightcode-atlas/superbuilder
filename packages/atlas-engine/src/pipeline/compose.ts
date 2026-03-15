import { join } from "node:path";
import { scaffold } from "../scaffold/scaffold";
import { writeEnvFile } from "./env";
import { pushToGitHub } from "./github";
import { installFeatures } from "./install";
import { createNeonProject } from "./neon";
import { seedInitialData } from "./seed";
import type {
	ComposeCallbacks,
	ComposeInput,
	ComposeOptions,
	ComposeResult,
	GitHubResult,
	NeonResult,
	SeedResult,
	VercelResult,
} from "./types";
import { deployToVercel } from "./vercel";

const DEFAULT_OPTS: Required<
	Pick<
		ComposeOptions,
		"neon" | "github" | "vercel" | "install" | "private" | "githubOrg"
	>
> = {
	neon: true,
	github: true,
	vercel: true,
	install: false,
	private: true,
	githubOrg: "BBrightcode-atlas",
};

/**
 * Headless compose pipeline orchestrator.
 *
 * Resolves features, scaffolds a project, and optionally provisions
 * Neon DB, GitHub repo, Vercel deployment, env file, install, and seed.
 *
 * Fatal steps (resolve, scaffold) throw on failure.
 * Non-fatal steps log errors and continue.
 */
export async function composePipeline(
	input: ComposeInput,
	callbacks?: ComposeCallbacks,
): Promise<ComposeResult> {
	const opts = { ...DEFAULT_OPTS, ...input.options };
	const cb = callbacks ?? input.callbacks;
	const projectDir = join(input.targetPath, input.projectName);

	// ── Step 1+2: resolve + scaffold (FATAL) ─────────────────────
	// scaffold()가 내부에서 features source resolve → manifest scan → copy → transform → connections 수행
	// compose에서는 feature IDs를 전달하고 scaffold에 위임
	cb?.onStep?.("resolve", "start", "피처 의존성 해석 중...");
	cb?.onStep?.("scaffold", "start", "프로젝트 스캐폴딩 중...");
	const scaffoldResult = await scaffold({
		projectName: input.projectName,
		targetDir: projectDir,
		featuresToKeep: input.features,
		templateRepo: opts.boilerplateRepo,
		featuresSourceDir: opts.featuresSourceDir,
		featuresRepo: opts.featuresRepo,
	});
	cb?.onStep?.("resolve", "done", `${input.features.length}개 피처 요청`);
	cb?.onStep?.(
		"scaffold",
		"done",
		`${scaffoldResult.installedFeatures.length}개 피처 설치 완료`,
	);

	// ── Step 3: neon (NON-FATAL, opt-in) ─────────────────────────
	let neonResult: NeonResult | undefined;
	if (opts.neon) {
		cb?.onStep?.("neon", "start", "Neon DB 프로젝트 생성 중...");
		try {
			neonResult = await createNeonProject({
				projectName: input.projectName,
				orgId: opts.neonOrgId,
				apiKey: opts.neonApiKey,
			});
			cb?.onStep?.(
				"neon",
				"done",
				`Neon DB 생성 완료: ${neonResult.projectId}`,
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("neon", "error", msg);
			cb?.onLog?.("Neon DB 생성 실패 — DB 없이 계속 진행합니다");
		}
	} else {
		cb?.onStep?.("neon", "skip");
	}

	// ── Step 4: github (NON-FATAL, opt-in) ───────────────────────
	let githubResult: GitHubResult | undefined;
	if (opts.github) {
		cb?.onStep?.("github", "start", "GitHub 레포 생성 및 푸시 중...");
		try {
			githubResult = await pushToGitHub({
				projectDir,
				repoName: input.projectName,
				org: opts.githubOrg,
				private: opts.private,
			});
			cb?.onStep?.(
				"github",
				"done",
				`GitHub 레포 생성 완료: ${githubResult.repoUrl}`,
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("github", "error", msg);
			cb?.onLog?.("GitHub 레포 생성 실패 — 계속 진행합니다");
		}
	} else {
		cb?.onStep?.("github", "skip");
	}

	// ── Step 5: vercel (NON-FATAL, opt-in, requires github) ──────
	// Monorepo 배포: app (프론트엔드) + server (API) 2개 프로젝트
	let vercelResult: VercelResult | undefined;
	let vercelServerResult: VercelResult | undefined;
	// BETTER_AUTH_SECRET을 미리 생성 (Vercel env + .env 양쪽에 동일 값 사용)
	const { randomBytes } = await import("node:crypto");
	const betterAuthSecret = randomBytes(32).toString("base64");

	if (opts.vercel && githubResult) {
		cb?.onStep?.("vercel", "start", "Vercel 프로젝트 배포 중...");
		try {
			const envVars: Record<string, string> = {
				BETTER_AUTH_SECRET: betterAuthSecret,
			};
			if (neonResult?.databaseUrl) {
				envVars.DATABASE_URL = neonResult.databaseUrl;
			}

			// 1) App (프론트엔드) — apps/app, Vite (먼저 생성하여 URL 확보)
			cb?.onLog?.("Vercel: 앱(프론트엔드) 프로젝트 생성 중...");
			vercelResult = await deployToVercel({
				repoUrl: githubResult.repoUrl,
				projectName: input.projectName,
				envVars,
				token: opts.vercelToken,
				teamId: opts.vercelTeamId,
				rootDirectory: "apps/app",
			});
			cb?.onLog?.(`앱 배포: ${vercelResult.deploymentUrl}`);

			// 2) Server (API) — apps/server, NestJS
			// 서버에 앱 URL을 CORS + AUTH URL로 전달
			const serverEnvVars: Record<string, string> = {
				...envVars,
				CORS_ORIGINS: vercelResult.deploymentUrl,
				BETTER_AUTH_URL: vercelResult.deploymentUrl,
			};
			cb?.onLog?.("Vercel: 서버(API) 프로젝트 생성 중...");
			vercelServerResult = await deployToVercel({
				repoUrl: githubResult.repoUrl,
				projectName: `${input.projectName}-api`,
				envVars: serverEnvVars,
				token: opts.vercelToken,
				teamId: opts.vercelTeamId,
				framework: null,
				rootDirectory: "apps/server",
				buildCommand: "",
				outputDirectory: ".",
			});
			cb?.onLog?.(`서버 배포: ${vercelServerResult.deploymentUrl}`);

			cb?.onStep?.(
				"vercel",
				"done",
				`앱: ${vercelResult.deploymentUrl} | API: ${vercelServerResult.deploymentUrl}`,
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("vercel", "error", msg);
			cb?.onLog?.("Vercel 배포 실패 — 계속 진행합니다");
		}
	} else if (opts.vercel && !githubResult) {
		cb?.onStep?.("vercel", "skip", "GitHub 레포가 없어 건너뜀");
	} else {
		cb?.onStep?.("vercel", "skip");
	}

	// ── Step 6: env (NON-FATAL) ──────────────────────────────────
	cb?.onStep?.("env", "start", ".env 파일 생성 중...");
	try {
		await writeEnvFile(projectDir, {
			DATABASE_URL: neonResult?.databaseUrl,
			NEON_PROJECT_ID: neonResult?.projectId,
			VERCEL_URL: vercelResult?.deploymentUrl,
			BETTER_AUTH_URL: vercelServerResult?.deploymentUrl,
			BETTER_AUTH_SECRET: betterAuthSecret,
			VITE_API_URL: vercelServerResult?.deploymentUrl,
		});
		cb?.onStep?.("env", "done", ".env 파일 생성 완료");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("env", "error", msg);
	}

	// ── Step 7: install (NON-FATAL, opt-in) ──────────────────────
	let installed = false;
	if (opts.install) {
		cb?.onStep?.("install", "start", "의존성 설치 중...");
		try {
			await installFeatures({ projectDir });
			installed = true;
			cb?.onStep?.("install", "done", "의존성 설치 완료");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("install", "error", msg);
			cb?.onLog?.(
				"설치 실패 — bun install && bunx drizzle-kit push 를 수동 실행하세요",
			);
		}
	} else {
		cb?.onStep?.("install", "skip");
	}

	// ── Step 8: seed (NON-FATAL, opt-in, requires install+neon) ──
	let seedResult: SeedResult | undefined;
	if (installed && neonResult) {
		cb?.onStep?.("seed", "start", "초기 데이터 시딩 중...");
		try {
			seedResult = await seedInitialData({
				projectDir,
				ownerEmail: opts.ownerEmail,
				ownerPassword: opts.ownerPassword,
			});
			cb?.onStep?.("seed", "done", `시딩 완료: ${seedResult.ownerEmail}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("seed", "error", msg);
			cb?.onLog?.(
				"시딩 실패 — 서버 실행 후 /api/auth/sign-up으로 수동 등록하세요",
			);
		}
	} else {
		cb?.onStep?.("seed", "skip");
	}

	// ── Done ─────────────────────────────────────────────────────
	cb?.onLog?.("파이프라인 완료");

	return {
		projectDir,
		projectName: input.projectName,
		installedFeatures: scaffoldResult.installedFeatures,
		neon: neonResult,
		github: githubResult,
		vercel: vercelResult,
		vercelServer: vercelServerResult,
		installed,
		seed: seedResult,
	};
}
