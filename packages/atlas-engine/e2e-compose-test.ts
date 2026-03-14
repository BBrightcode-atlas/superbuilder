/**
 * E2E Compose Pipeline Test
 *
 * Features: hello-world + comment
 * Flow: scaffold → neon → github → vercel → install → seed → login verify
 */
import { composePipeline } from "./src/pipeline/compose";

const PROJECT_NAME = `compose-e2e-${Date.now()}`;
const TARGET_PATH = "/tmp/compose-e2e-test";

async function main() {
	console.log(`\n🚀 E2E Compose Test: ${PROJECT_NAME}\n`);

	const result = await composePipeline(
		{
			features: ["hello-world", "comment"],
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

	console.log("\n📋 결과:");
	console.log(JSON.stringify(result, null, 2));

	// Checkpoint verification
	console.log("\n🔍 체크포인트 검증:");

	// 1. scaffold
	const { existsSync } = await import("node:fs");
	const { join } = await import("node:path");
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
	check(
		"comment 복사됨",
		existsSync(join(result.projectDir, "packages/features/comment")),
	);

	// 2. import transform
	const { execSync } = await import("node:child_process");
	const superbuilderRefs = execSync(
		`grep -rn 'from "@superbuilder' ${result.projectDir}/packages/features/ 2>/dev/null || true`,
	)
		.toString()
		.trim();
	check("import 변환 완료 (주석 제외)", superbuilderRefs === "");

	// 3. marker insertion
	const { readFileSync } = await import("node:fs");
	const appModule = readFileSync(
		join(result.projectDir, "apps/server/src/app.module.ts"),
		"utf-8",
	);
	check("HelloWorldModule 마커 삽입", appModule.includes("HelloWorldModule"));
	check("CommentModule 마커 삽입", appModule.includes("CommentModule"));

	// 4. neon
	check("Neon DB 생성", !!result.neon?.projectId);

	// 5. .env
	check(
		".env 존재",
		existsSync(join(result.projectDir, ".env")),
	);

	// 6. github
	check("GitHub repo 생성", !!result.github?.repoUrl);

	// 7. vercel
	check("Vercel 배포", !!result.vercel?.deploymentUrl);

	// 8. seed
	check("Owner seed 완료", !!result.seed?.systemOrgId);

	// 9. login test
	if (result.vercel?.deploymentUrl) {
		console.log("\n🔐 로그인 테스트...");
		// Wait for Vercel deployment to be ready
		await new Promise((r) => setTimeout(r, 10000));

		try {
			const loginRes = await fetch(
				`${result.vercel.deploymentUrl}/api/auth/sign-in/email`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: "admin@superbuilder.app",
						password: "changeme!!",
					}),
				},
			);
			check(`로그인 응답 (${loginRes.status})`, loginRes.ok);
			if (loginRes.ok) {
				const body = await loginRes.json();
				console.log("  🎉 로그인 성공!", JSON.stringify(body).slice(0, 200));
			} else {
				const text = await loginRes.text();
				console.log("  ⚠️ 로그인 실패:", text.slice(0, 200));
			}
		} catch (e) {
			console.log("  ⚠️ 로그인 요청 실패 (서버 미준비?):", (e as Error).message);
		}
	}

	// Output cleanup commands
	console.log("\n🧹 정리 명령어:");
	if (result.neon?.projectId) {
		console.log(
			`  curl -X DELETE "https://console.neon.tech/api/v2/projects/${result.neon.projectId}" -H "Authorization: Bearer $NEON_API_KEY"`,
		);
	}
	if (result.github?.repoUrl) {
		console.log(
			`  gh repo delete ${result.github.owner}/${result.github.repo} --yes`,
		);
	}
	if (result.vercel?.projectId) {
		console.log(
			`  curl -X DELETE "https://api.vercel.com/v9/projects/${result.vercel.projectId}" -H "Authorization: Bearer $VERCEL_TOKEN"`,
		);
	}
	console.log(`  rm -rf ${result.projectDir}`);
}

main().catch((e) => {
	console.error("\n💥 E2E 테스트 실패:", e);
	process.exit(1);
});
