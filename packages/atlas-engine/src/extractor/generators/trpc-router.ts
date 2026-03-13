import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { FeatureRegistry } from "../../registry/types";

/**
 * apps/atlas-server/src/trpc/router.ts 재생성
 *
 * 선택된 feature의 router만 import + router 객체에 포함
 */
export function generateTrpcRouter(
  targetPath: string,
  selectedFeatures: string[],
  registry: FeatureRegistry,
): string {
  const filePath = join(
    targetPath,
    "apps/atlas-server/src/trpc/router.ts",
  );
  const original = readFileSync(filePath, "utf-8");

  const selectedSet = new Set(selectedFeatures);

  // router import 이름 → feature name 매핑
  const importToFeature = new Map<string, string>();
  for (const [name, entry] of Object.entries(registry.features)) {
    importToFeature.set(entry.router.import, name);
  }

  // router key → feature name 매핑
  const keyToFeature = new Map<string, string>();
  for (const [name, entry] of Object.entries(registry.features)) {
    keyToFeature.set(entry.router.key, name);
  }

  const lines = original.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    // Feature router import 라인 감지: import { xxxRouter } from '@repo/features/yyy'
    const importMatch = line.match(
      /import\s+\{\s*(\w+)\s*\}\s+from\s+['"]@repo\/features\/([^'"]+)['"]/,
    );
    if (importMatch) {
      const importName = importMatch[1];
      const featureName = importToFeature.get(importName);
      if (featureName !== undefined) {
        if (selectedSet.has(featureName)) {
          result.push(line);
        }
        continue;
      }
    }

    // router 객체 키 라인 감지: "  key: value," 형식
    const keyMatch = line.match(/^\s+(\w+):\s*(\w+),?\s*$/);
    if (keyMatch) {
      const key = keyMatch[1];
      const featureName = keyToFeature.get(key);
      if (featureName !== undefined) {
        if (selectedSet.has(featureName)) {
          result.push(line);
        }
        continue;
      }
    }

    // 그 외 라인은 항상 유지
    result.push(line);
  }

  const content = result.join("\n");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}
