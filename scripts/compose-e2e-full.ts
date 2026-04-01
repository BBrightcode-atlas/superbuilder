/**
 * Full Compose E2E — scaffold → install → db push → seed → git push → wait deploy → verify
 * Usage: RUN_ID=1 bun run scripts/compose-e2e-full.ts
 */
import { composePipeline } from "../packages/atlas-engine/src/pipeline/compose";
import { seedInitialData } from "../packages/atlas-engine/src/pipeline/seed";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const RUN_ID = process.env.RUN_ID || "1";
const PROJECT_NAME = `ce2e-${Date.now().toString(36).slice(-5)}-r${RUN_ID}`;
const TARGET_PATH = "/tmp/superbuilder-e2e";
const FEATURES = ["hello-world", "kakao-me"];
const TEAM_ID = "team_0RU3AcmUqBUmhPdUAsEelRWz";

function log(msg: string) {
  console.log(`[R${RUN_ID}] ${msg}`);
}

function exec(cmd: string, opts?: { cwd?: string; timeout?: number }): string {
  try {
    return execSync(cmd, {
      cwd: opts?.cwd,
      timeout: opts?.timeout ?? 120_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
  } catch (e: any) {
    const stdout = e.stdout?.toString?.() ?? "";
    const stderr = e.stderr?.toString?.() ?? "";
    throw new Error(`Exit ${e.status ?? "?"} | stdout: ${stdout.slice(-300)} | stderr: ${stderr.slice(-300)}`);
  }
}

async function cleanup(result: any) {
  log("🧹 Cleaning up resources...");
  const token = process.env.VERCEL_TOKEN ?? "";
  const neonKey = process.env.NEON_API_KEY ?? "";

  // Delete Vercel projects
  for (const key of ["vercel", "vercelServer", "vercelAdmin", "vercelLanding"]) {
    const proj = result?.[key];
    if (proj?.projectId) {
      try {
        await fetch(`https://api.vercel.com/v9/projects/${proj.projectId}?teamId=${TEAM_ID}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
  }

  // Delete Neon project
  if (result?.neon?.projectId) {
    try {
      await fetch(`https://console.neon.tech/api/v2/projects/${result.neon.projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${neonKey}` },
      });
    } catch {}
  }

  // Delete local dir
  const dir = `${TARGET_PATH}/${PROJECT_NAME}`;
  if (existsSync(dir)) {
    exec(`rm -rf ${dir}`);
  }

  log("🧹 Cleanup done");
}

async function run(): Promise<{ success: boolean; error?: string }> {
  log(`🚀 Starting: ${PROJECT_NAME} [${FEATURES.join(", ")}]`);

  // ── Step 1: Compose Pipeline ──
  log("📦 Step 1: composePipeline...");
  const result = await composePipeline(
    {
      features: FEATURES,
      projectName: PROJECT_NAME,
      targetPath: TARGET_PATH,
      options: {
        neon: true,
        github: true,
        vercel: true,
        install: false,
        neonApiKey: process.env.NEON_API_KEY,
        neonOrgId: process.env.NEON_ORG_ID,
        vercelToken: process.env.VERCEL_TOKEN,
        vercelTeamId: process.env.VERCEL_TEAM_ID,
        featuresSourceDir: "/Users/papert/Projects/superbuilder-features/features",
        ownerEmail: "admin@superbuilder.app",
        ownerPassword: "changeme!!",
        githubOrg: "BBrightcode-atlas",
        private: true,
      },
    },
    {
      onStep: (step, status, msg) => {
        if (status === "error") log(`  ❌ [${step}] ${msg}`);
        else if (status === "done") log(`  ✅ [${step}] ${msg}`);
      },
      onLog: (msg) => log(`  📝 ${msg}`),
    },
  );

  if (!result.vercel || !result.neon || !result.github) {
    await cleanup(result);
    return { success: false, error: "Pipeline missing vercel/neon/github" };
  }

  const projectDir = result.projectDir;

  // ── Step 2: pnpm install ──
  log("📦 Step 2: pnpm install...");
  try {
    exec("pnpm install --no-frozen-lockfile", { cwd: projectDir, timeout: 180_000 });
  } catch (e: any) {
    await cleanup(result);
    return { success: false, error: `pnpm install failed: ${e.message?.slice(0, 200)}` };
  }

  // ── Step 3: drizzle-kit push ──
  log("📦 Step 3: drizzle-kit push...");
  try {
    const pushOut = exec("pnpm exec drizzle-kit push --force 2>&1", {
      cwd: `${projectDir}/packages/drizzle`,
      timeout: 120_000,
    });
    const hasApplied = pushOut.includes("Changes applied") || pushOut.includes("No changes");
    log(`  ${hasApplied ? "✅" : "⚠️"} drizzle push: ${pushOut.slice(-100).trim()}`);
  } catch (e: any) {
    await cleanup(result);
    return { success: false, error: `drizzle-kit push failed: ${e.message?.slice(0, 300)}` };
  }

  // ── Step 4: Seed ──
  log("📦 Step 4: Seed...");
  let seedResult;
  try {
    seedResult = await seedInitialData({
      projectDir,
      ownerEmail: "admin@superbuilder.app",
      ownerPassword: "changeme!!",
    });
    log(`  ✅ Seed: ${seedResult.ownerEmail}`);
  } catch (e: any) {
    await cleanup(result);
    return { success: false, error: `Seed failed: ${e.message?.slice(0, 200)}` };
  }

  // ── Step 5: Git push ──
  log("📦 Step 5: Git push...");
  try {
    exec("git add -A && git commit -m 'chore: add lockfile and seed'", { cwd: projectDir });
    exec("git push origin main", { cwd: projectDir });
  } catch (e: any) {
    await cleanup(result);
    return { success: false, error: `Git push failed: ${e.message?.slice(0, 200)}` };
  }

  // ── Step 6: Wait for deployments ──
  log("⏳ Step 6: Waiting for deployments (90s)...");
  await new Promise((r) => setTimeout(r, 90_000));

  // Check deployment statuses
  const token = process.env.VERCEL_TOKEN ?? "";
  const deployChecks = [
    { name: "app", proj: PROJECT_NAME },
    { name: "api", proj: `${PROJECT_NAME}-api` },
    { name: "admin", proj: `${PROJECT_NAME}-admin` },
    { name: "landing", proj: `${PROJECT_NAME}-landing` },
  ];

  for (const check of deployChecks) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?app=${check.proj}&teamId=${TEAM_ID}&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as any;
      const state = data?.deployments?.[0]?.state;
      log(`  ${state === "READY" ? "✅" : "❌"} ${check.name}: ${state}`);
      if (state !== "READY") {
        // Wait more if still building
        if (state === "BUILDING") {
          log("  ⏳ Still building, waiting 60s more...");
          await new Promise((r) => setTimeout(r, 60_000));
          const res2 = await fetch(
            `https://api.vercel.com/v6/deployments?app=${check.proj}&teamId=${TEAM_ID}&limit=1`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const data2 = (await res2.json()) as any;
          const state2 = data2?.deployments?.[0]?.state;
          log(`  ${state2 === "READY" ? "✅" : "❌"} ${check.name} (retry): ${state2}`);
          if (state2 !== "READY") {
            await cleanup(result);
            return { success: false, error: `${check.name} deploy failed: ${state2}` };
          }
        } else {
          await cleanup(result);
          return { success: false, error: `${check.name} deploy failed: ${state}` };
        }
      }
    } catch (e: any) {
      await cleanup(result);
      return { success: false, error: `Deploy check failed: ${e.message?.slice(0, 100)}` };
    }
  }

  // ── Step 7: API login test ──
  log("🔐 Step 7: API login test...");
  try {
    const loginRes = await fetch(`${result.vercelServer!.deploymentUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@superbuilder.app", password: "changeme!!" }),
    });
    const loginData = (await loginRes.json()) as any;
    if (loginData?.user?.email) {
      log(`  ✅ API login success: ${loginData.user.email}`);
    } else {
      await cleanup(result);
      return { success: false, error: `API login failed: ${JSON.stringify(loginData).slice(0, 200)}` };
    }
  } catch (e: any) {
    await cleanup(result);
    return { success: false, error: `API login error: ${e.message?.slice(0, 200)}` };
  }

  // ── Step 8: Landing page check ──
  log("🌐 Step 8: Landing page check...");
  try {
    const landingRes = await fetch(result.vercelLanding!.deploymentUrl);
    if (landingRes.ok) {
      log(`  ✅ Landing: ${landingRes.status}`);
    } else {
      await cleanup(result);
      return { success: false, error: `Landing failed: ${landingRes.status}` };
    }
  } catch (e: any) {
    await cleanup(result);
    return { success: false, error: `Landing error: ${e.message?.slice(0, 200)}` };
  }

  // ── Cleanup ──
  await cleanup(result);

  return { success: true };
}

// Execute
const startTime = Date.now();
try {
  const result = await run();
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  if (result.success) {
    log(`✅ PASS (${elapsed}s)`);
    process.exit(0);
  } else {
    log(`❌ FAIL (${elapsed}s): ${result.error}`);
    process.exit(1);
  }
} catch (e: any) {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log(`💥 CRASH (${elapsed}s): ${e.message?.slice(0, 300)}`);
  process.exit(1);
}
