/**
 * E2E Compose Pipeline Test
 * Feature: hello-world
 * Vercel: app + server + admin + landing (4 projects)
 * Final: login success
 */
import { composePipeline } from "./src/pipeline/compose";

const PROJECT_NAME = `compose-e2e-${Date.now()}`;
const TARGET_PATH = "/tmp/compose-e2e-test";

async function main() {
	console.log(`\n🚀 E2E Compose Test: ${PROJECT_NAME}\n`);

	const result = await composePipeline(
		{
			features: ["hello-world"],
			projectName: PROJECT_NAME,
			targetPath: TARGET_PATH,
			options: {
				neon: true,
				github: true,
				vercel: true,
				install: true,
				ownerEmail: "admin@superbuilder.app",
				ownerPassword: "changeme!!",
				featuresSourceDir:
					"/Users/bbright/Projects/superbuilder-features/features",
			},
		},
		{
			onStep: (step, status, msg) => {
				const icon =
					status === "done"
						? "✅"
						: status === "error"
							? "❌"
							: status === "skip"
								? "⏭️"
								: "⏳";
				console.log(`  ${icon} [${step}] ${status}${msg ? `: ${msg}` : ""}`);
			},
			onLog: (msg) => console.log(`  💬 ${msg}`),
		},
	);

	console.log("\n📋 결과:", JSON.stringify(result, null, 2));

	// ── Checkpoint verification ──
	console.log("\n🔍 체크포인트 검증:");
	const { existsSync, readFileSync } = await import("node:fs");
	const { join } = await import("node:path");
	const { execSync } = await import("node:child_process");
	const check = (name: string, ok: boolean) =>
		console.log(`  ${ok ? "✅" : "❌"} ${name}`);

	check(
		"scaffold 완료",
		existsSync(join(result.projectDir, "packages/features")),
	);
	check(
		"hello-world 복사됨",
		existsSync(join(result.projectDir, "packages/features/hello-world")),
	);

	const refs = execSync(
		`grep -rn 'from "@superbuilder' ${result.projectDir}/packages/features/ 2>/dev/null || true`,
	)
		.toString()
		.trim();
	check("import 변환 완료", refs === "");

	const appModule = readFileSync(
		join(result.projectDir, "apps/server/src/app.module.ts"),
		"utf-8",
	);
	check("HelloWorldModule 마커 삽입", appModule.includes("HelloWorldModule"));

	check("Neon DB 생성", !!result.neon?.projectId);
	check(".env 존재", existsSync(join(result.projectDir, ".env")));
	check("GitHub repo 생성", !!result.github?.repoUrl);
	check("Vercel 앱 생성", !!result.vercel?.projectId);
	check("Vercel 서버 생성", !!result.vercelServer?.projectId);
	check("Vercel Admin 생성", !!result.vercelAdmin?.projectId);
	check("Vercel Landing 생성", !!result.vercelLanding?.projectId);
	check("Owner seed 완료", !!result.seed?.systemOrgId);

	// ── Wait for all Vercel deployments ──
	console.log("\n⏳ Vercel 배포 대기 중...");
	const projects = [
		{
			name: "앱",
			id: result.vercel?.projectId,
			url: result.vercel?.deploymentUrl,
		},
		{
			name: "서버",
			id: result.vercelServer?.projectId,
			url: result.vercelServer?.deploymentUrl,
		},
		{
			name: "Admin",
			id: result.vercelAdmin?.projectId,
			url: result.vercelAdmin?.deploymentUrl,
		},
		{
			name: "Landing",
			id: result.vercelLanding?.projectId,
			url: result.vercelLanding?.deploymentUrl,
		},
	].filter((p) => p.id);

	const VERCEL_TOKEN = process.env.VERCEL_TOKEN ?? "";
	for (let attempt = 1; attempt <= 30; attempt++) {
		await new Promise((r) => setTimeout(r, 15000));
		let allReady = true;
		const statuses: string[] = [];
		for (const p of projects) {
			try {
				const res = await fetch(
					`https://api.vercel.com/v6/deployments?projectId=${p.id}&limit=1`,
					{
						headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
					},
				);
				const data = (await res.json()) as any;
				const state = data.deployments?.[0]?.readyState ?? "?";
				statuses.push(`${p.name}=${state}`);
				if (state !== "READY") allReady = false;
			} catch {
				statuses.push(`${p.name}=?`);
				allReady = false;
			}
		}
		console.log(`  시도 ${attempt}/30: ${statuses.join(" | ")}`);
		if (allReady) {
			console.log("  ✅ 모든 Vercel 프로젝트 배포 완료!");
			break;
		}
		if (attempt === 30) console.log("  ⚠️ 일부 프로젝트 배포 미완료");
	}

	// ── Verify each deployment ──
	console.log("\n🌐 배포 확인:");
	await new Promise((r) => setTimeout(r, 5000));
	for (const p of projects) {
		if (!p.url) continue;
		try {
			const res = await fetch(p.url, { method: "GET" });
			check(`${p.name} (${p.url}) HTTP ${res.status}`, res.status === 200);
		} catch (_e) {
			check(`${p.name} 접근 실패`, false);
		}
	}

	// ── Login test on server ──
	if (result.vercelServer?.deploymentUrl) {
		console.log("\n🔐 로그인 테스트:");
		try {
			const loginRes = await fetch(
				`${result.vercelServer.deploymentUrl}/api/auth/sign-in/email`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: "admin@superbuilder.app",
						password: "changeme!!",
					}),
				},
			);
			check(`로그인 HTTP ${loginRes.status}`, loginRes.ok);
			if (loginRes.ok) {
				const body = (await loginRes.json()) as any;
				console.log(
					`  🎉 로그인 성공! token: ${body.token?.slice(0, 10)}... email: ${body.user?.email}`,
				);
			} else {
				const text = await loginRes.text();
				console.log(`  ⚠️ 실패: ${text.slice(0, 200)}`);
			}
		} catch (e) {
			console.log(`  ⚠️ 요청 실패: ${(e as Error).message}`);
		}
	}

	// ── Cleanup commands ──
	console.log("\n🧹 정리 명령어:");
	if (result.neon?.projectId)
		console.log(
			`  curl -X DELETE "https://console.neon.tech/api/v2/projects/${result.neon.projectId}" -H "Authorization: Bearer $NEON_API_KEY"`,
		);
	if (result.github?.repoUrl)
		console.log(
			`  gh repo delete ${result.github.owner}/${result.github.repo} --yes`,
		);
	for (const p of [
		result.vercel,
		result.vercelServer,
		result.vercelAdmin,
		result.vercelLanding,
	]) {
		if (p?.projectId)
			console.log(
				`  curl -X DELETE "https://api.vercel.com/v9/projects/${p.projectId}" -H "Authorization: Bearer $VERCEL_TOKEN"`,
			);
	}
	console.log(`  rm -rf ${result.projectDir}`);
}

main().catch((e) => {
	console.error("\n💥 E2E 테스트 실패:", e);
	process.exit(1);
});
