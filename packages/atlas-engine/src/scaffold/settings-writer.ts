import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface SettingsFile {
  attribution: {
    commit: string;
    pr: string;
  };
  enabledPlugins: {
    "superpowers@claude-plugins-official": boolean;
  };
}

export function buildSettingsFile(): SettingsFile {
  return {
    attribution: {
      commit: "",
      pr: "",
    },
    enabledPlugins: {
      "superpowers@claude-plugins-official": true,
    },
  };
}

export async function writeSettingsFile(projectDir: string): Promise<void> {
  const claudeDir = join(projectDir, ".claude");
  await mkdir(claudeDir, { recursive: true });

  const settings = buildSettingsFile();
  const settingsPath = join(claudeDir, "settings.json");
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}
