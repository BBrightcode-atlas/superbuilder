import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { FeatureRegistry } from "../../registry/types";

/**
 * apps/app/src/router.tsx 재생성
 *
 * 선택된 feature만의 route import + spread를 유지
 *
 * 접근 방식: feature 디렉토리 경로를 기반으로 import/spread 라인 필터링
 * - import에서 "./features/{name}" 패턴 감지
 * - ...createXxxRoutes() spread 라인에서 함수명으로 관련 feature 판별
 */
export function generateClientRouter(
  targetPath: string,
  selectedFeatures: string[],
  registry: FeatureRegistry,
): string {
  const filePath = join(targetPath, "apps/app/src/router.tsx");
  const original = readFileSync(filePath, "utf-8");

  const selectedSet = new Set(selectedFeatures);

  // client.app 경로가 있는 feature의 디렉토리 이름 수집
  // "apps/app/src/features/blog/" → "blog"
  const appFeatureDirs = new Map<string, string>();
  for (const [name, entry] of Object.entries(registry.features)) {
    if (entry.client.app) {
      const match = entry.client.app.match(/features\/([^/]+)\/?$/);
      if (match) {
        appFeatureDirs.set(match[1], name);
      }
    }
  }

  const lines = original.split("\n");
  const result: string[] = [];

  // 추적: 현재까지 제거한 feature의 create 함수명 (spread 라인 필터용)
  const removedImportNames = new Set<string>();
  const keptImportNames = new Set<string>();

  for (const line of lines) {
    // Feature import 라인 감지: import { createXxx } from "./features/{dir}"
    const importMatch = line.match(
      /import\s+\{([^}]+)\}\s+from\s+["']\.\/features\/([^"']+)["']/,
    );
    if (importMatch) {
      const importedNames = importMatch[1].split(",").map((s) => s.trim());
      const featureDir = importMatch[2].replace(/\/.*$/, ""); // "payment/routes" → "payment"
      const featureName = appFeatureDirs.get(featureDir);

      if (featureName !== undefined) {
        if (selectedSet.has(featureName)) {
          result.push(line);
          for (const n of importedNames) keptImportNames.add(n);
        } else {
          for (const n of importedNames) removedImportNames.add(n);
        }
        continue;
      }
    }

    // Spread 라인 감지: ...createXxxRoutes(parentRoute),
    const spreadMatch = line.match(/\.\.\.(create\w+)\(/);
    if (spreadMatch) {
      const funcName = spreadMatch[1];
      if (removedImportNames.has(funcName)) {
        continue; // 제거된 feature의 route spread → 스킵
      }
    }

    // 주석 처리된 import/spread도 유지 (원본 그대로)
    result.push(line);
  }

  const content = result.join("\n");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}
