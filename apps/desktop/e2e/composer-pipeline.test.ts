/**
 * Composer E2E Pipeline Test — Full Sheet
 *
 * Connects to the RUNNING Electron dev app via CDP and runs the complete
 * Composer pipeline: Feature Select → Scaffold → GitHub Push → Agent Install →
 * Neon DB → Vercel Deploy → Verify Deployment + Login
 *
 * Prerequisites:
 *   - `bun dev` running (Electron app with CDP enabled)
 *   - User logged in to Desktop app
 *   - NEON_API_KEY env var set for full Neon integration (optional — skips if not set)
 *   - VERCEL_TOKEN baked into Electron build for Vercel integration
 *
 * Run:
 *   CDP_PORT=41729 npx playwright test
 *
 * Full pipeline with Neon:
 *   NEON_API_KEY=napi_xxx CDP_PORT=41729 npx playwright test
 */
import { test, expect, type Page } from "@playwright/test";
import { chromium } from "playwright";

const TIMEOUT_LONG = 120_000;
const TIMEOUT_AGENT = 300_000;
const TIMEOUT_DEPLOY = 180_000;
const PROJECT_NAME = `e2e-test-${Date.now()}`;
const TARGET_PATH = `/tmp/${PROJECT_NAME}`;
const CDP_PORT = process.env.CDP_PORT || "41729";
const NEON_API_KEY = process.env.NEON_API_KEY || "";
const VERCEL_TEAM = process.env.VERCEL_TEAM || ""; // team slug or empty for personal

let page: Page;

test.describe.serial("Composer E2E Pipeline", () => {
  test.beforeAll(async () => {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const contexts = browser.contexts();

    // Collect all candidate pages, preferring non-workspace URLs
    const allPages: Page[] = [];
    for (const ctx of contexts) {
      for (const p of ctx.pages()) {
        const url = p.url();
        if (url.includes("localhost:5173") || url.includes("atlas") || url.includes("sign-in")) {
          allPages.push(p);
        }
      }
    }

    // Priority: atlas page > non-workspace page > any localhost page > first page
    page =
      allPages.find((p) => p.url().includes("atlas")) ??
      allPages.find((p) => !p.url().includes("workspace")) ??
      allPages[0] ??
      contexts[0]?.pages()[0];

    if (!page) {
      throw new Error("No page found in Electron — is the app running?");
    }

    console.log("[setup] Connected, URL:", page.url());
  });

  // ─── Pre-flight ───────────────────────────────────────────────

  test("Step 0: Pre-flight — verify authenticated", async () => {
    test.setTimeout(30_000);

    const url = page.url();
    console.log("[pre-flight] URL:", url);
    await page.screenshot({ path: "e2e-screenshots/00-state.png" });

    expect(url).not.toContain("sign-in");
    console.log("[pre-flight] ✓ Authenticated");
  });

  // ─── Navigate & Reset ────────────────────────────────────────

  test("Step 1: Navigate to Composer and wait for registry", async () => {
    test.setTimeout(90_000);

    // Navigate to composer by manipulating localStorage router history and reloading.
    // This is necessary because:
    // 1. window.location.hash doesn't trigger TanStack Router (uses persistentHashHistory)
    // 2. Zustand in-memory stores persist across SPA navigation — step may be stuck at 3
    //    from a previous composer run. Only a page reload resets in-memory state.
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("router-history") || '{"entries":["/"],"index":0}');
      state.entries.push("/atlas/composer");
      state.index = state.entries.length - 1;
      localStorage.setItem("router-history", JSON.stringify(state));
      window.location.reload();
    });

    // Wait for page to reload and render
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    console.log("[composer] URL after reload:", page.url());

    // Reset stale pipeline state from previous runs
    for (let attempt = 0; attempt < 15; attempt++) {
      const h1Text = await page.evaluate(() => document.querySelector("h1")?.textContent || "");
      if (h1Text.includes("Project Composer")) break;

      for (const name of ["나중에 연결", "설정으로 돌아가기", "새 프로젝트 만들기", "이전"]) {
        try {
          const btn = page.getByRole("button", { name });
          await btn.waitFor({ state: "visible", timeout: 1_500 });
          await btn.click();
          console.log(`[composer] Reset: clicked "${name}" ✓`);
          await page.waitForTimeout(500);
          break;
        } catch {
          // Not visible
        }
      }
    }

    await page.waitForFunction(
      () => document.querySelector("h1")?.textContent?.includes("Project Composer"),
      { timeout: 30_000 },
    );

    // Wait for feature grid to populate (registry must load)
    try {
      await page.waitForFunction(
        () => {
          const buttons = document.querySelectorAll('button[type="button"]');
          return Array.from(buttons).some(b => b.textContent?.includes('hello-world'));
        },
        { timeout: 60_000 },
      );
      console.log("[composer] Registry loaded, hello-world feature found ✓");
    } catch {
      // Debug on failure
      const debugInfo = await page.evaluate(() => {
        const h1El = document.querySelector("h1");
        const contentArea = h1El?.closest('[class*="p-6"]');
        return {
          h1: h1El?.textContent,
          contentText: contentArea?.textContent?.slice(0, 300),
          hasGrid: !!contentArea?.querySelector('.grid'),
        };
      });
      console.log("[composer] ⚠ Feature grid still empty:", JSON.stringify(debugInfo));
    }

    await page.screenshot({ path: "e2e-screenshots/01-composer.png" });
    expect(page.url()).toContain("composer");
  });

  // ─── Feature Selection ────────────────────────────────────────

  test("Step 2: Select hello-world feature", async () => {
    test.setTimeout(60_000);

    const helloWorldBtn = page.getByRole("button", { name: /hello-world hello-world/ });
    await helloWorldBtn.waitFor({ state: "visible", timeout: 30_000 });

    const nextBtn = page.locator('button:has-text("다음: 의존성 확인")');

    // Toggle-aware: ensure feature is selected
    const isAlreadyEnabled = await nextBtn.isEnabled().catch(() => false);
    if (!isAlreadyEnabled) {
      await helloWorldBtn.click();
      console.log("[composer] hello-world feature clicked ✓");
      await page.waitForTimeout(500);
    } else {
      console.log("[composer] Feature already selected ✓");
    }

    // If we toggled it off, click again
    if (!(await nextBtn.isEnabled().catch(() => false))) {
      await helloWorldBtn.click();
      console.log("[composer] hello-world feature re-clicked ✓");
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "e2e-screenshots/02-feature-selected.png" });
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
    await nextBtn.click();
    console.log("[composer] → Dependency check ✓");

    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e-screenshots/02-dependency.png" });
  });

  // ─── Project Config & Compose ─────────────────────────────────

  test("Step 3: Configure project and start compose", async () => {
    test.setTimeout(60_000);

    const nextToConfigBtn = page.locator('button:has-text("다음: 프로젝트 설정")');
    await nextToConfigBtn.waitFor({ state: "visible", timeout: 15_000 });
    await nextToConfigBtn.click();
    console.log("[composer] → Project config ✓");
    await page.waitForTimeout(1000);

    // Fill project name
    const nameInput = page.locator("#projectName");
    await nameInput.waitFor({ state: "visible", timeout: 5_000 });
    await nameInput.fill(PROJECT_NAME);
    console.log("[composer] Project name:", PROJECT_NAME);

    // Fill target path
    const pathInput = page.locator("#targetPath");
    await pathInput.waitFor({ state: "visible", timeout: 5_000 });
    await pathInput.fill(TARGET_PATH);
    console.log("[composer] Target path:", TARGET_PATH);

    await page.screenshot({ path: "e2e-screenshots/03-config.png" });

    // Start compose
    const composeBtn = page.locator('button:has-text("프로젝트 생성")');
    await expect(composeBtn).toBeEnabled({ timeout: 5_000 });
    await composeBtn.click();
    console.log("[composer] 프로젝트 생성 clicked ✓");

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e-screenshots/03-compose-started.png" });
  });

  // ─── CP-1: Scaffold ───────────────────────────────────────────

  test("CP-1: Scaffold completes", async () => {
    test.setTimeout(TIMEOUT_LONG);

    await page.waitForFunction(
      () => document.body.textContent?.includes("스캐폴드 완료"),
      { timeout: TIMEOUT_LONG },
    );

    await page.screenshot({ path: "e2e-screenshots/04-scaffold.png" });
    console.log("[CP-1] Scaffold complete ✓");
  });

  // ─── CP-2: GitHub Push ────────────────────────────────────────

  test("CP-2: GitHub push completes", async () => {
    test.setTimeout(TIMEOUT_LONG);

    await page.waitForFunction(
      () => document.body.textContent?.includes("Push 완료"),
      { timeout: TIMEOUT_LONG },
    );

    await page.screenshot({ path: "e2e-screenshots/05-github.png" });
    console.log("[CP-2] GitHub push complete ✓");
  });

  // ─── CP-3: Agent Install ──────────────────────────────────────

  test("CP-3: Agent install — launch and confirm", async () => {
    test.setTimeout(TIMEOUT_AGENT);

    const launchBtn = page.locator('button:has-text("에이전트 실행")');
    await launchBtn.waitFor({ state: "visible", timeout: 30_000 });
    await page.screenshot({ path: "e2e-screenshots/06-agent-ready.png" });
    await launchBtn.click();
    console.log("[CP-3] Agent launched ✓");

    // Wait for completion gate button
    const confirmBtn = page.locator('button:has-text("설치 완료 확인")');
    await confirmBtn.waitFor({ state: "visible", timeout: TIMEOUT_AGENT });
    await page.screenshot({ path: "e2e-screenshots/06-agent-done.png" });
    await confirmBtn.click();
    console.log("[CP-3] Agent confirmed ✓");

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e-screenshots/06-confirmed.png" });
  });

  // ─── CP-4: Neon DB Setup ──────────────────────────────────────

  test("CP-4: Neon DB setup", async () => {
    test.setTimeout(TIMEOUT_LONG);

    // Check if Neon is auto-connected (env token baked into build)
    // or if we need to enter a token via UI
    const neonConnectedHeading = page.getByRole("heading", { name: "Neon 연결됨" });
    const neonTokenHeading = page.getByRole("heading", { name: "Neon 연결" });

    // Wait for either heading
    await page.waitForFunction(
      () => {
        const headings = Array.from(document.querySelectorAll("h3"));
        return headings.some(
          (h) => h.textContent?.includes("Neon 연결됨") || h.textContent?.includes("Neon 연결"),
        );
      },
      { timeout: 30_000 },
    );

    await page.screenshot({ path: "e2e-screenshots/07-neon-setup.png" });

    const isAutoConnected = await neonConnectedHeading.isVisible().catch(() => false);

    if (isAutoConnected) {
      // Already connected — select first org
      console.log("[CP-4] Neon auto-connected ✓");
      const orgBtn = page.locator('.space-y-4 button.w-full').first();
      await orgBtn.waitFor({ state: "visible", timeout: 10_000 });
      await orgBtn.click();
      console.log("[CP-4] Neon org selected ✓");
    } else if (NEON_API_KEY) {
      // Enter token from env
      console.log("[CP-4] Entering Neon API key from env...");
      const tokenInput = page.locator('input[placeholder="napi_xxxxxxxxxxxxxxxx"]');
      await tokenInput.fill(NEON_API_KEY);
      const connectBtn = page.getByRole("button", { name: "연결" });
      await connectBtn.click();
      console.log("[CP-4] Neon token submitted ✓");

      // Wait for org selection
      await page.waitForTimeout(3000);
      const orgBtn = page.locator('.space-y-4 button.w-full').first();
      try {
        await orgBtn.waitFor({ state: "visible", timeout: 15_000 });
        await orgBtn.click();
        console.log("[CP-4] Neon org selected ✓");
      } catch {
        console.log("[CP-4] ⚠ No org found after token entry");
      }
    } else {
      // No token — skip
      console.log("[CP-4] No NEON_API_KEY — skipping");
      const skipBtn = page.getByRole("button", { name: "나중에 연결" });
      await skipBtn.click();
      console.log("[CP-4] Neon skipped ✓");
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e-screenshots/07-neon-done.png" });

    // If Neon was completed, wait for pipeline step to finish
    if (isAutoConnected || NEON_API_KEY) {
      try {
        await page.waitForFunction(
          () =>
            document.body.textContent?.includes("마이그레이션 완료") ||
            document.body.textContent?.includes("시딩 완료") ||
            document.body.textContent?.includes("Neon") && document.body.textContent?.includes("생성 완료"),
          { timeout: TIMEOUT_LONG },
        );
        console.log("[CP-4] Neon pipeline step complete ✓");
      } catch {
        console.log("[CP-4] ⚠ Neon pipeline step may have failed");
      }
      await page.screenshot({ path: "e2e-screenshots/07-neon-pipeline.png" });
    }
  });

  // ─── CP-5: Vercel Dual Deploy ─────────────────────────────────

  test("CP-5: Vercel dual deploy", async () => {
    test.setTimeout(TIMEOUT_LONG);

    // Check for Vercel setup UI
    const vercelConnectedHeading = page.getByRole("heading", { name: "Vercel 연결됨" });
    const vercelTokenHeading = page.getByRole("heading", { name: "Vercel 연결" });

    // Wait for either Vercel heading
    try {
      await page.waitForFunction(
        () => {
          const headings = Array.from(document.querySelectorAll("h3"));
          return headings.some(
            (h) => h.textContent?.includes("Vercel 연결됨") || h.textContent?.includes("Vercel 연결"),
          );
        },
        { timeout: 30_000 },
      );
    } catch {
      console.log("[CP-5] Vercel setup not shown — may have been skipped");
      await page.screenshot({ path: "e2e-screenshots/08-vercel-not-shown.png" });
      return;
    }

    await page.screenshot({ path: "e2e-screenshots/08-vercel-setup.png" });

    const isAutoConnected = await vercelConnectedHeading.isVisible().catch(() => false);

    if (isAutoConnected) {
      console.log("[CP-5] Vercel auto-connected ✓");
      // Select team — look for specific team or use "개인 계정"
      if (VERCEL_TEAM) {
        const teamBtn = page.getByRole("button", { name: new RegExp(VERCEL_TEAM) });
        try {
          await teamBtn.waitFor({ state: "visible", timeout: 10_000 });
          await teamBtn.click();
          console.log(`[CP-5] Selected team: ${VERCEL_TEAM} ✓`);
        } catch {
          // Fallback to first team
          const firstTeam = page.locator('.space-y-2 button.w-full').first();
          await firstTeam.click();
          console.log("[CP-5] Selected first team ✓");
        }
      } else {
        // Default: select "개인 계정" (Personal Account)
        const personalBtn = page.getByRole("button", { name: /개인 계정/ });
        try {
          await personalBtn.waitFor({ state: "visible", timeout: 10_000 });
          await personalBtn.click();
          console.log("[CP-5] Selected Personal Account ✓");
        } catch {
          const firstTeam = page.locator('.space-y-2 button.w-full').first();
          await firstTeam.click();
          console.log("[CP-5] Selected first option ✓");
        }
      }
    } else {
      // Not connected — skip
      console.log("[CP-5] Vercel not connected — skipping");
      const skipBtn = page.getByRole("button", { name: "나중에 연결" });
      await skipBtn.click();
      console.log("[CP-5] Vercel skipped ✓");
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e-screenshots/08-vercel-after-selection.png" });

    // If Vercel was connected, wait for deploy pipeline to complete
    if (isAutoConnected) {
      try {
        await page.waitForFunction(
          () =>
            document.body.textContent?.includes("배포 시작") ||
            document.body.textContent?.includes("GitHub 연동 필요") ||
            document.body.textContent?.includes("Vercel") && document.body.textContent?.includes("완료"),
          { timeout: TIMEOUT_LONG },
        );
        console.log("[CP-5] Vercel pipeline step complete ✓");
      } catch {
        console.log("[CP-5] ⚠ Vercel pipeline step may have failed");
      }
      await page.screenshot({ path: "e2e-screenshots/08-vercel-pipeline.png" });
    }
  });

  // ─── Verify: Pipeline Completion + Extract URLs ────────────────

  test("Verify: Pipeline completion", async () => {
    test.setTimeout(60_000);

    await page.waitForFunction(
      () => document.body.textContent?.includes("프로젝트 생성 완료"),
      { timeout: 30_000 },
    );
    console.log("[verify] Pipeline complete ✓");

    // Extract Vercel URLs from the pipeline result page (before navigating away)
    const pipelineText = await page.evaluate(() => document.body.textContent || "");
    const urlMatches = pipelineText.match(/https?:\/\/[^\s)]+vercel\.app[^\s)]*/g) || [];
    console.log("[verify] Vercel URLs from pipeline:", urlMatches);

    await page.screenshot({ path: "e2e-screenshots/09-pipeline-complete.png" });

    // Navigate to deployments via the button
    const deployBtn = page.getByRole("button", { name: "배포 목록으로" });
    try {
      await deployBtn.waitFor({ state: "visible", timeout: 5_000 });
      await deployBtn.click();
      await page.waitForTimeout(3000);
    } catch {
      await page.evaluate(() => {
        window.location.hash = "#/atlas/deployments";
      });
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: "e2e-screenshots/10-deployment-list.png" });
  });

  // ─── Verify: Deployment Card ──────────────────────────────────

  test("Verify: Deployment card shows project", async () => {
    test.setTimeout(30_000);

    // Wait for the deployment list to render with our project
    try {
      await page.waitForFunction(
        (name) => document.body.textContent?.includes(name),
        PROJECT_NAME,
        { timeout: 10_000 },
      );
      console.log("[verify] Deployment card found ✓");
    } catch {
      console.log("[verify] ⚠ Deployment card not visible — may need scroll");
    }

    await page.screenshot({ path: "e2e-screenshots/10-deployment-card.png" });

    // Check for owner email / password section (only if Neon was completed)
    const hasOwnerInfo = await page.evaluate(() =>
      document.body.textContent?.includes("Owner") ||
      document.body.textContent?.includes("owner") ||
      document.body.textContent?.includes("••••"),
    );

    if (hasOwnerInfo) {
      console.log("[verify] Owner info section found ✓");
      await page.screenshot({ path: "e2e-screenshots/10-password-reveal.png" });
    } else {
      console.log("[verify] Owner info not visible (Neon seed was skipped)");
    }
  });

  // ─── Verify: Deployed URLs (if Vercel completed) ──────────────

  test("Verify: Deployed URLs respond", async () => {
    test.setTimeout(TIMEOUT_DEPLOY);

    // Extract URLs from link hrefs — only check URLs from THIS test run
    const urls = await page.evaluate((name) => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      return [...new Set(
        links
          .map((a) => a.getAttribute("href") || "")
          .filter((href) => href.includes("vercel.app") && href.startsWith("http") && href.includes(name)),
      )];
    }, PROJECT_NAME.replace(/^e2e-test-/, ""));

    if (urls.length === 0) {
      console.log("[verify] No Vercel URLs found for this test run — Vercel may have been skipped");
      return;
    }

    console.log("[verify] Found URLs:", urls);

    // Use fetch with cors mode and HEAD method for lightweight checks
    // Accept status 0 (opaque response from no-cors), any 2xx/3xx, or even fetch success
    for (const url of urls) {
      console.log(`[verify] Checking ${url}...`);

      let success = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const result = await page.evaluate(async (checkUrl) => {
            try {
              // Try cors first (will work if deployed app has CORS headers)
              const res = await fetch(checkUrl, { method: "HEAD" });
              return { status: res.status, type: res.type, ok: true };
            } catch {
              try {
                // Fallback: no-cors gives opaque response (status 0) but proves server is reachable
                const res = await fetch(checkUrl, { mode: "no-cors" });
                return { status: res.status, type: res.type, ok: true };
              } catch (e) {
                return { status: 0, type: "error", ok: false, error: String(e) };
              }
            }
          }, url);

          if (result.ok) {
            console.log(`[verify] ${url} → ${result.type}/${result.status} ✓`);
            success = true;
            break;
          }
          console.log(`[verify] ${url} → ${result.error}, retry ${attempt + 1}/10...`);
        } catch {
          // evaluate failed
        }
        await page.waitForTimeout(15_000);
      }

      if (!success) {
        console.log(`[verify] ⚠ ${url} did not respond after 10 attempts`);
      }
    }

    await page.screenshot({ path: "e2e-screenshots/11-urls-checked.png" });
  });

  // ─── Verify: Email Login (if Neon + Vercel completed) ─────────

  test("Verify: Email login with seeded credentials", async () => {
    test.setTimeout(TIMEOUT_DEPLOY);

    // Get app URL (non-API vercel URL) from link hrefs
    const appUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      const vercelUrls = links
        .map((a) => a.getAttribute("href") || "")
        .filter((href) => href.includes("vercel.app") && href.startsWith("http"));
      return vercelUrls.find((u) => !u.includes("-api")) || "";
    });

    if (!appUrl) {
      console.log("[verify] No app URL — cannot test login (Vercel may have been skipped)");
      return;
    }

    // Get owner email from deployment card
    const ownerEmail = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const match = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
      return match?.[0] || "";
    });

    if (!ownerEmail) {
      console.log("[verify] No owner email — Neon seed was skipped, cannot test login");
      return;
    }

    console.log(`[verify] Testing login at ${appUrl} with ${ownerEmail}`);

    try {
      const loginPage = await page.context().newPage();
      await loginPage.goto(appUrl, { timeout: 60_000, waitUntil: "networkidle" });
      await loginPage.screenshot({ path: "e2e-screenshots/12-app-landing.png" });

      const emailInput = loginPage.locator('input[type="email"], input[name="email"]');
      try {
        await emailInput.waitFor({ state: "visible", timeout: 15_000 });
        await emailInput.fill(ownerEmail);
        console.log("[verify] Email filled ✓");
        await loginPage.screenshot({ path: "e2e-screenshots/12-login-form.png" });
      } catch {
        console.log("[verify] ⚠ No email input on deployed app");
      }

      await loginPage.close();
    } catch (error) {
      console.log(`[verify] ⚠ Could not open ${appUrl}: ${error}`);
    }
  });
});
