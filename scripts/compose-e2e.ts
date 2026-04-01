/**
 * Compose E2E test script
 * Usage: bun run scripts/compose-e2e.ts
 */
import { composePipeline } from "../packages/atlas-engine/src/pipeline/compose";

const PROJECT_NAME = `compose-e2e-${Date.now().toString(36).slice(-6)}`;
const TARGET_PATH = "/tmp/superbuilder-e2e";
const FEATURES = ["hello-world", "kakao-me"];

console.log(`\n🚀 Compose E2E: ${PROJECT_NAME}`);
console.log(`   Features: ${FEATURES.join(", ")}`);
console.log(`   Target: ${TARGET_PATH}/${PROJECT_NAME}\n`);

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
    onStep: (step, status, message) => {
      const icon =
        status === "start" ? "⏳" :
        status === "done" ? "✅" :
        status === "skip" ? "⏭️" :
        "❌";
      console.log(`${icon} [${step}] ${message ?? status}`);
    },
    onLog: (message) => {
      console.log(`   📝 ${message}`);
    },
  },
);

console.log("\n═══════════════════════════════════════");
console.log("📊 Compose Result");
console.log("═══════════════════════════════════════");
console.log(`Project: ${result.projectDir}`);
console.log(`Features: ${result.installedFeatures.join(", ")}`);
console.log(`Neon: ${result.neon?.projectId ?? "N/A"}`);
console.log(`GitHub: ${result.github?.repoUrl ?? "N/A"}`);
console.log(`App: ${result.vercel?.deploymentUrl ?? "N/A"}`);
console.log(`API: ${result.vercelServer?.deploymentUrl ?? "N/A"}`);
console.log(`Admin: ${result.vercelAdmin?.deploymentUrl ?? "N/A"}`);
console.log(`Landing: ${result.vercelLanding?.deploymentUrl ?? "N/A"}`);
console.log(`Seed: ${result.seed?.ownerEmail ?? "N/A"} / ${result.seed?.ownerPassword ?? "N/A"}`);
console.log("═══════════════════════════════════════\n");

// Write result to JSON for E2E test consumption
const resultPath = `/tmp/compose-e2e-result-${PROJECT_NAME}.json`;
await Bun.write(resultPath, JSON.stringify(result, null, 2));
console.log(`📄 Result saved: ${resultPath}`);
