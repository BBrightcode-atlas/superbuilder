import { describe, it, expect } from "bun:test";
import { transformImportPath, transformImports } from "./import-transformer";

describe("transformImportPath", () => {
  it("transforms static core imports", () => {
    expect(transformImportPath("@superbuilder/core-auth")).toBe(
      "@repo/core/auth",
    );
    expect(transformImportPath("@superbuilder/core-trpc")).toBe(
      "@repo/core/trpc",
    );
    expect(transformImportPath("@superbuilder/core-db")).toBe("@repo/drizzle");
    expect(transformImportPath("@superbuilder/core-schema")).toBe(
      "@repo/drizzle",
    );
    expect(transformImportPath("@superbuilder/core-logger")).toBe(
      "@repo/core/logger",
    );
    expect(transformImportPath("@superbuilder/core-ui")).toBe("@repo/ui");
  });

  it("transforms feature cross-reference imports", () => {
    expect(transformImportPath("@superbuilder/feature-blog")).toBe(
      "@repo/features/blog",
    );
    expect(transformImportPath("@superbuilder/feature-auth/widget")).toBe(
      "@repo/widgets/auth",
    );
    expect(transformImportPath("@superbuilder/feature-blog/schema")).toBe(
      "@repo/drizzle",
    );
    expect(transformImportPath("@superbuilder/feature-shop/common")).toBe(
      "@repo/features/shop",
    );
  });

  it("returns null for non-superbuilder imports", () => {
    expect(transformImportPath("react")).toBeNull();
    expect(transformImportPath("@tanstack/react-query")).toBeNull();
    expect(transformImportPath("./local-file")).toBeNull();
  });
});

describe("transformImports", () => {
  it("transforms import statements in TypeScript source", () => {
    const source = `import { auth } from "@superbuilder/core-auth";
import { trpc } from "@superbuilder/core-trpc";`;
    const result = transformImports(source);
    expect(result).toBe(`import { auth } from "@repo/core/auth";
import { trpc } from "@repo/core/trpc";`);
  });

  it("transforms both single and double quotes", () => {
    const source = `import { auth } from '@superbuilder/core-auth';
import { ui } from "@superbuilder/core-ui";`;
    const result = transformImports(source);
    expect(result).toBe(`import { auth } from '@repo/core/auth';
import { ui } from "@repo/ui";`);
  });

  it("transforms dynamic imports", () => {
    const source = `const ui = await import("@superbuilder/core-ui");`;
    const result = transformImports(source);
    expect(result).toBe(`const ui = await import("@repo/ui");`);
  });

  it("transforms feature cross-references", () => {
    const source = `import { BlogPost } from "@superbuilder/feature-blog";
import { BlogWidget } from "@superbuilder/feature-blog/widget";`;
    const result = transformImports(source);
    expect(result).toBe(`import { BlogPost } from "@repo/features/blog";
import { BlogWidget } from "@repo/widgets/blog";`);
  });

  it("transforms export * from with superbuilder paths", () => {
    const source = `export * from "@superbuilder/core-auth";`;
    const result = transformImports(source);
    expect(result).toBe(`export * from "@repo/core/auth";`);
  });

  it("transforms export { } from with superbuilder paths", () => {
    const source = `export { auth } from "@superbuilder/core-auth";`;
    const result = transformImports(source);
    expect(result).toBe(`export { auth } from "@repo/core/auth";`);
  });

  it("preserves non-superbuilder imports unchanged", () => {
    const source = `import React from "react";
import { useQuery } from "@tanstack/react-query";
import { helper } from "./utils";`;
    const result = transformImports(source);
    expect(result).toBe(source);
  });
});
