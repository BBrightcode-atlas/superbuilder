import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface SourceConfig {
  name: string;
  repo?: string;
  branch?: string;
  localPath: string;
  registry: string;
}

export interface SuperbuilderConfig {
  sources: SourceConfig[];
}

export function loadConfig(projectRoot: string): SuperbuilderConfig {
  const configPath = join(projectRoot, ".superbuilder", "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as SuperbuilderConfig;
  if (!config.sources || config.sources.length === 0) {
    throw new Error("No sources configured in .superbuilder/config.json");
  }
  return config;
}
