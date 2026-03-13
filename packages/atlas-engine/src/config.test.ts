import { describe, expect, it } from "bun:test";
import { loadConfig } from "./config";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  it("loads valid config from .superbuilder/config.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "sb-config-"));
    mkdirSync(join(dir, ".superbuilder"));
    writeFileSync(
      join(dir, ".superbuilder/config.json"),
      JSON.stringify({
        sources: [{
          name: "feature-atlas",
          localPath: "/some/path",
          registry: "registry/features.json",
        }],
      }),
    );
    const config = loadConfig(dir);
    expect(config.sources).toHaveLength(1);
    expect(config.sources[0].name).toBe("feature-atlas");
  });

  it("throws if config file missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "sb-config-"));
    expect(() => loadConfig(dir)).toThrow();
  });

  it("returns default source path from config", () => {
    const dir = mkdtempSync(join(tmpdir(), "sb-config-"));
    mkdirSync(join(dir, ".superbuilder"));
    writeFileSync(
      join(dir, ".superbuilder/config.json"),
      JSON.stringify({
        sources: [{
          name: "feature-atlas",
          localPath: "/my/atlas",
          registry: "registry/features.json",
        }],
      }),
    );
    const config = loadConfig(dir);
    expect(config.sources[0].localPath).toBe("/my/atlas");
  });
});
