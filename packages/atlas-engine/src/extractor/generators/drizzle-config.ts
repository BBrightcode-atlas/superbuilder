import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { FeatureRegistry } from "../../registry/types";

/**
 * packages/features-db/drizzle.config.ts 재생성
 *
 * tablesFilter 배열에서 선택되지 않은 feature의 테이블을 제거
 */
export function generateDrizzleConfig(
  targetPath: string,
  selectedFeatures: string[],
  registry: FeatureRegistry,
): string {
  const filePath = join(targetPath, "packages/features-db/drizzle.config.ts");
  const original = readFileSync(filePath, "utf-8");

  // 선택된 feature들의 테이블 목록 수집
  const selectedTables = new Set<string>();
  for (const name of selectedFeatures) {
    const entry = registry.features[name];
    if (entry?.schema.tables) {
      for (const table of entry.schema.tables) {
        selectedTables.add(table);
      }
    }
  }

  // Core 테이블 (항상 포함) — features.json에 없는 테이블들
  // drizzle.config.ts의 core 섹션에 있는 테이블들
  const coreTables = [
    "profiles",
    "files",
    "reviews",
    "review_helpful",
    "review_reports",
    "review_summary",
    "rate_limits",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "terms",
  ];

  for (const table of coreTables) {
    selectedTables.add(table);
  }

  // tablesFilter 영역을 찾아서 교체
  // 전략: tablesFilter: [ ... ] 블록을 통째로 교체
  const tablesFilterStart = original.indexOf("tablesFilter:");
  if (tablesFilterStart === -1) {
    // tablesFilter가 없으면 원본 유지
    return filePath;
  }

  // tablesFilter: [ 시작부터 닫는 ] 까지 찾기
  let bracketDepth = 0;
  let arrayStart = -1;
  let arrayEnd = -1;

  for (let i = tablesFilterStart; i < original.length; i++) {
    if (original[i] === "[") {
      if (bracketDepth === 0) arrayStart = i;
      bracketDepth++;
    } else if (original[i] === "]") {
      bracketDepth--;
      if (bracketDepth === 0) {
        arrayEnd = i + 1;
        break;
      }
    }
  }

  if (arrayStart === -1 || arrayEnd === -1) {
    return filePath;
  }

  // 선택된 테이블로 새 배열 생성
  const sortedTables = [...selectedTables].sort();
  const tableEntries = sortedTables.map((t) => `    "${t}",`).join("\n");
  const newArray = `[\n${tableEntries}\n  ]`;

  const content =
    original.substring(0, arrayStart) + newArray + original.substring(arrayEnd);

  writeFileSync(filePath, content, "utf-8");
  return filePath;
}
