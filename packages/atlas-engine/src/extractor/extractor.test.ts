import { describe, expect, test, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadRegistry } from "../registry/loader";
import { resolveFeatures } from "../resolver/resolver";
import { extract } from "./extractor";
import type { ExtractorConfig } from "./types";

const ATLAS_PATH =
  process.env.ATLAS_PATH ?? "/Users/bright/Projects/feature-atlas";

describe("extractor", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "atlas-extract-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // 정리 실패 무시
      }
    }
    tempDirs.length = 0;
  });

  test("should extract hello-world feature to temp directory", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["hello-world"]);
    const targetPath = createTempDir();

    const config: ExtractorConfig = {
      sourcePath: ATLAS_PATH,
      targetPath,
      registry,
      resolved,
    };

    const result = extract(config);

    // 결과 검증
    expect(result.targetPath).toBe(targetPath);
    expect(result.features).toContain("hello-world");
    expect(result.features).toContain("profile"); // core
    expect(result.features).toContain("role-permission"); // core

    // 선택된 feature 디렉토리 존재 확인
    expect(
      existsSync(join(targetPath, "packages/features/hello-world")),
    ).toBe(true);
    expect(
      existsSync(join(targetPath, "packages/features/profile")),
    ).toBe(true);

    // 선택되지 않은 feature 디렉토리 제거 확인
    expect(
      existsSync(join(targetPath, "packages/features/blog")),
    ).toBe(false);
    expect(
      existsSync(join(targetPath, "packages/features/community")),
    ).toBe(false);
    expect(
      existsSync(join(targetPath, "packages/features/payment")),
    ).toBe(false);

    // superbuilder.json 존재 확인
    expect(existsSync(join(targetPath, "superbuilder.json"))).toBe(true);
  });

  test("should extract blog + payment features with dependencies", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog", "payment"]);
    const targetPath = createTempDir();

    const config: ExtractorConfig = {
      sourcePath: ATLAS_PATH,
      targetPath,
      registry,
      resolved,
    };

    const result = extract(config);

    // 선택된 feature 포함 확인
    expect(result.features).toContain("blog");
    expect(result.features).toContain("payment");
    expect(result.features).toContain("profile"); // dependency

    // 디렉토리 존재 확인
    expect(existsSync(join(targetPath, "packages/features/blog"))).toBe(true);
    expect(existsSync(join(targetPath, "packages/features/payment"))).toBe(
      true,
    );
    expect(existsSync(join(targetPath, "packages/features/profile"))).toBe(
      true,
    );

    // 선택되지 않은 feature 제거 확인
    expect(existsSync(join(targetPath, "packages/features/community"))).toBe(
      false,
    );
    expect(existsSync(join(targetPath, "packages/features/marketing"))).toBe(
      false,
    );
  });

  test("should remove unselected feature schema directories", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["hello-world"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    // hello-world has no schema, but core features should exist
    // blog schema should be removed
    expect(
      existsSync(
        join(targetPath, "packages/drizzle/src/schema/features/blog"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(targetPath, "packages/drizzle/src/schema/features/community"),
      ),
    ).toBe(false);
  });

  test("should regenerate schema index with only selected features", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    const schemaIndex = readFileSync(
      join(targetPath, "packages/drizzle/src/schema/index.ts"),
      "utf-8",
    );

    // Core exports should remain
    expect(schemaIndex).toContain('export * from "./core/auth"');
    expect(schemaIndex).toContain('export * from "./core/profiles"');

    // Blog schema should be present
    expect(schemaIndex).toContain('export * from "./features/blog"');

    // Non-selected feature schemas should be removed
    expect(schemaIndex).not.toContain('export * from "./features/community"');
    expect(schemaIndex).not.toContain('export * from "./features/marketing"');
  });

  test("should regenerate drizzle config with only selected tables", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    const drizzleConfig = readFileSync(
      join(targetPath, "packages/drizzle/drizzle.config.ts"),
      "utf-8",
    );

    // Core tables should be present
    expect(drizzleConfig).toContain('"profiles"');
    expect(drizzleConfig).toContain('"files"');

    // Blog tables should be present
    expect(drizzleConfig).toContain('"blog_posts"');
    expect(drizzleConfig).toContain('"blog_tags"');

    // Community tables should NOT be present
    expect(drizzleConfig).not.toContain('"community_communities"');
    expect(drizzleConfig).not.toContain('"community_posts"');
  });

  test("should regenerate app-router.ts with only selected features", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog", "hello-world"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    const appRouter = readFileSync(
      join(targetPath, "packages/features/app-router.ts"),
      "utf-8",
    );

    // Selected features should remain
    expect(appRouter).toContain("blogRouter");
    expect(appRouter).toContain("helloWorldRouter");

    // Core features (always included)
    expect(appRouter).toContain("profileRouter");
    expect(appRouter).toContain("rolePermissionRouter");

    // Non-selected should be removed
    expect(appRouter).not.toContain("communityMainRouter");
    expect(appRouter).not.toContain("paymentRouter");
    expect(appRouter).not.toContain("marketingMainRouter");
  });

  test("should regenerate trpc router with only selected features", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    const trpcRouter = readFileSync(
      join(targetPath, "apps/atlas-server/src/trpc/router.ts"),
      "utf-8",
    );

    // Selected + core
    expect(trpcRouter).toContain("blogRouter");
    expect(trpcRouter).toContain("profileRouter");

    // Non-selected
    expect(trpcRouter).not.toContain("communityMainRouter");
    expect(trpcRouter).not.toContain("marketingMainRouter");
  });

  test("should regenerate app.module.ts with only selected features", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    const appModule = readFileSync(
      join(targetPath, "apps/atlas-server/src/app.module.ts"),
      "utf-8",
    );

    // Selected + core modules
    expect(appModule).toContain("BlogModule");
    expect(appModule).toContain("ProfileModule");

    // Core infrastructure should remain
    expect(appModule).toContain("ConfigModule");
    expect(appModule).toContain("ThrottlerModule");
    expect(appModule).toContain("DatabaseModule");

    // Non-selected
    expect(appModule).not.toContain("CommunityModule");
    expect(appModule).not.toContain("MarketingModule");
  });

  test("should generate superbuilder.json with correct metadata", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["blog"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    const metadata = JSON.parse(
      readFileSync(join(targetPath, "superbuilder.json"), "utf-8"),
    );

    expect(metadata.source).toBe(registry.source);
    expect(metadata.createdBy).toBe("superbuilder");
    expect(metadata.features).toEqual(["blog"]);
    expect(metadata.resolvedFeatures).toContain("blog");
    expect(metadata.resolvedFeatures).toContain("profile");
    expect(metadata.createdAt).toBeTruthy();
    expect(metadata.env).toBeDefined();
    expect(metadata.env.infrastructure).toBeInstanceOf(Array);
    expect(metadata.env.feature).toBeInstanceOf(Array);
  });

  test("should not copy .git and node_modules directories", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["hello-world"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    expect(existsSync(join(targetPath, ".git"))).toBe(false);
    expect(existsSync(join(targetPath, "node_modules"))).toBe(false);
  });

  test("should report removed directories in result", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["hello-world"]);
    const targetPath = createTempDir();

    const result = extract({
      sourcePath: ATLAS_PATH,
      targetPath,
      registry,
      resolved,
    });

    // 제거된 디렉토리 목록에 blog 포함
    expect(result.removedDirs).toContain("packages/features/blog");
    expect(result.removedDirs).toContain("packages/features/community");

    // 선택된 feature는 제거 목록에 없음
    expect(result.removedDirs).not.toContain("packages/features/hello-world");
    expect(result.removedDirs).not.toContain("packages/features/profile");
  });

  test("should report regenerated files in result", () => {
    const registry = loadRegistry(ATLAS_PATH);
    const resolved = resolveFeatures(registry, ["hello-world"]);
    const targetPath = createTempDir();

    const result = extract({
      sourcePath: ATLAS_PATH,
      targetPath,
      registry,
      resolved,
    });

    expect(result.regeneratedFiles).toContain(
      "packages/drizzle/src/schema/index.ts",
    );
    expect(result.regeneratedFiles).toContain(
      "packages/drizzle/drizzle.config.ts",
    );
    expect(result.regeneratedFiles).toContain(
      "packages/features/app-router.ts",
    );
    expect(result.regeneratedFiles).toContain(
      "apps/atlas-server/src/trpc/router.ts",
    );
    expect(result.regeneratedFiles).toContain(
      "apps/atlas-server/src/app.module.ts",
    );
  });

  test("should handle widget features correctly", () => {
    const registry = loadRegistry(ATLAS_PATH);
    // comment is a widget feature
    const resolved = resolveFeatures(registry, ["comment"]);
    const targetPath = createTempDir();

    extract({ sourcePath: ATLAS_PATH, targetPath, registry, resolved });

    // comment server feature should exist
    expect(existsSync(join(targetPath, "packages/features/comment"))).toBe(
      true,
    );

    // bookmark (not selected, widget) should be removed
    const bookmarkWidgetDir = join(
      targetPath,
      "packages/widgets/src/bookmark",
    );
    expect(existsSync(bookmarkWidgetDir)).toBe(false);

    // comment widget should exist
    const commentWidgetDir = join(
      targetPath,
      "packages/widgets/src/comment",
    );
    expect(existsSync(commentWidgetDir)).toBe(true);
  });
});
