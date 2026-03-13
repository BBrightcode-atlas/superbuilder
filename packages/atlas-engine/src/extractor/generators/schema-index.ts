import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { FeatureRegistry } from "../../registry/types";

/**
 * packages/features-db/src/schema/index.ts 재생성
 *
 * Core exports는 항상 유지하고, feature exports만 선택된 feature로 필터링
 */
export function generateSchemaIndex(
  targetPath: string,
  selectedFeatures: string[],
  registry: FeatureRegistry,
): string {
  const filePath = join(targetPath, "packages/features-db/src/schema/index.ts");
  const original = readFileSync(filePath, "utf-8");

  const selectedSet = new Set(selectedFeatures);
  const lines = original.split("\n");
  const result: string[] = [];

  // feature name → schema directory name 매핑 빌드
  // e.g. "ai" → "agent" (schema.path = "packages/features-db/src/schema/features/agent/")
  const featureToSchemaDir = new Map<string, string>();
  for (const [name, entry] of Object.entries(registry.features)) {
    if (entry.schema.path) {
      // "packages/features-db/src/schema/features/agent/" → "agent"
      const match = entry.schema.path.match(/features\/([^/]+)\/?$/);
      if (match) {
        featureToSchemaDir.set(name, match[1]);
      }
    }
  }

  // 역매핑: schema dir name → feature name
  const schemaDirToFeature = new Map<string, string>();
  for (const [featureName, dirName] of featureToSchemaDir) {
    schemaDirToFeature.set(dirName, featureName);
  }

  for (const line of lines) {
    // Feature schema export line 감지: export * from "./features/{name}"
    const featureMatch = line.match(
      /export\s+\*\s+from\s+["']\.\/features\/([^"']+)["']/,
    );

    if (featureMatch) {
      const schemaDir = featureMatch[1].replace(/\/$/, "");
      // schema dir → feature name 역참조
      const featureName = schemaDirToFeature.get(schemaDir);
      if (featureName && selectedSet.has(featureName)) {
        result.push(line);
      }
      // 선택되지 않은 feature: 제거 (줄 추가 안 함)
    } else {
      // Core export나 주석 등 비-feature 라인은 항상 유지
      result.push(line);
    }
  }

  const content = result.join("\n");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}
