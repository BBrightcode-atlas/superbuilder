# Scaffold Feature-JSON Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** scaffold를 "boilerplate clone → feature 제거" 방식에서 "빈 템플릿 clone → superbuilder-features에서 feature 복사 + 연결" 방식으로 전면 전환한다.

**Architecture:** 3개 신규 모듈(copy-features, transform-files, update-package-exports) 생성 → scaffold.ts 재작성 → compose.ts 업데이트 → boilerplate 정리 → E2E 검증

**Tech Stack:** TypeScript, Bun, Node.js fs APIs, GitHub CLI (gh)

**Spec:** docs/superpowers/specs/2026-03-15-scaffold-feature-json-migration-design.md

| 항목 | 값 |
|------|-----|
| **작업 레포** | superbuilder (Task 1-8, 10-11) + superbuilder-app-boilerplate (Task 9) |
| **브랜치** | develop |
| **사전 조건** | atlas-engine의 manifest/connection/transform 모듈 구현 완료 |
| **완료 기준** | E2E: hello-world + comment scaffold → Vercel 배포 → 로그인 성공, `/spec-verify` 통과 |

---

## 에이전트 실행 가이드

### 레포별 작업 범위

```
superbuilder (packages/atlas-engine/)
├── Task 1-4:   신규 모듈 (copy-features, transform-files, update-package-exports, barrel export)
├── Task 5-6:   scaffold.ts 재작성 + types.ts 변경
├── Task 7-8:   pipeline/compose.ts 통합 + Desktop 호환성
├── Task 10:    spec-verify + 빌드 검증
└── Task 11:    E2E 테스트

superbuilder-app-boilerplate
└── Task 9:     feature 코드 제거, 빈 템플릿 마커만 남기기
```

---

## File Structure

### 신규 파일 (packages/atlas-engine/src/scaffold/)

```
packages/atlas-engine/src/scaffold/
├── copy-features.ts            # Task 1: feature 코드 복사
├── copy-features.test.ts       # Task 1: 테스트
├── transform-files.ts          # Task 2: import 변환 (디렉토리 단위)
├── transform-files.test.ts     # Task 2: 테스트
├── update-package-exports.ts   # Task 3: package.json exports 업데이트
├── update-package-exports.test.ts  # Task 3: 테스트
├── index.ts                    # Task 4: 배럴 export 업데이트
├── types.ts                    # Task 5: ScaffoldInput/Result 변경
└── scaffold.ts                 # Task 6: 전면 재작성
```

### 수정 파일

```
packages/atlas-engine/src/
├── connection/apply-connections.ts  # Task 6: MARKER_MAP 경로 수정 (atlas-server → server)
└── pipeline/
    ├── compose.ts              # Task 7: 새 scaffold() 호출 + scanFeatureManifests 사용
    └── types.ts                # Task 7: ComposeOptions에 featuresSourceDir 추가
```

---

## Chunk 1: 신규 모듈 (Task 1-4)

### Task 1: scaffold/copy-features.ts — Feature 코드 복사

> Feature 소스 디렉토리에서 선택된 feature의 코드를 템플릿 프로젝트로 복사하는 함수 구현

- [ ] `copy-features.test.ts` 작성 (TDD)
  - `bun:test`, `import.meta.dir` 사용
  - 임시 디렉토리에 가짜 feature 소스 구조 생성
  - server/client/schema slot 복사 검증
  - 존재하지 않는 slot은 skip 검증
  - provides에 없는 slot이라도 src 디렉토리가 있으면 복사 검증
- [ ] `copy-features.ts` 구현
  - `copyFeaturesToTemplate({templateDir, featuresSourceDir, featureIds, manifests})` 함수
  - 각 feature의 `provides`를 확인하여 존재하는 slot만 복사
  - `path-mapping.ts`의 `resolveFeatureJsonSourcePath()` → 소스 경로 결정
  - `path-mapping.ts`의 `resolveFeatureJsonTargetPath()` → 타겟 경로 결정
  - `node:fs/promises`의 `cp(src, dest, {recursive: true})` 사용
  - 소스 디렉토리 없으면 skip (`existsSync` 체크)
  - 복사할 slot 목록: `server`, `client`, `admin`, `schema`, `widgets`
  - provides에 해당 slot이 없어도 `src/{slot}` 디렉토리가 있으면 복사 (common 파일 등)
- [ ] 테스트 통과 확인: `bun test packages/atlas-engine/src/scaffold/copy-features.test.ts`

### Task 2: scaffold/transform-files.ts — Import 변환

> 복사된 feature 코드의 `@superbuilder/*` import를 `@repo/*`로 일괄 변환하는 디렉토리 단위 함수 구현

- [ ] `transform-files.test.ts` 작성 (TDD)
  - 임시 디렉토리에 `@superbuilder/core-auth` import가 포함된 .ts 파일 생성
  - 변환 후 `@repo/core/auth`로 변경되었는지 검증
  - .tsx 파일도 변환 검증
  - .json 등 비대상 파일은 변환하지 않는지 검증
  - 변환된 파일 수 반환값 검증
- [ ] `transform-files.ts` 구현
  - `transformDirectory(dir: string): Promise<number>` 함수
  - 재귀적으로 `.ts`, `.tsx` 파일 탐색
  - 각 파일에 `import-transformer.ts`의 `transformImports()` 적용
  - 변환된 파일만 다시 쓰기 (원본과 다를 때만)
  - 변환된 파일 수 반환
- [ ] 테스트 통과 확인: `bun test packages/atlas-engine/src/scaffold/transform-files.test.ts`

### Task 3: scaffold/update-package-exports.ts — Package exports 업데이트

> `packages/features/package.json`과 `packages/widgets/package.json`의 exports 필드를 feature 목록에 맞게 업데이트

- [ ] `update-package-exports.test.ts` 작성 (TDD)
  - 임시 디렉토리에 기본 package.json 생성
  - server provides가 있는 feature의 export 추가 검증
  - widget provides가 있는 feature의 widget export 추가 검증
  - types/dto 디렉토리가 있을 때 types subpath 추가 검증
- [ ] `update-package-exports.ts` 구현
  - `updateFeatureExports(templateDir, featureIds, manifests)` 함수
  - `packages/features/package.json`의 exports에 각 feature 추가
    - server → `./{id}`: `./{id}/index.ts`
    - types/dto → `./{id}/types`: `./{id}/types/index.ts` (존재 시)
  - `packages/widgets/package.json`에 widget export 추가 (widget provides가 있는 경우)
- [ ] 테스트 통과 확인: `bun test packages/atlas-engine/src/scaffold/update-package-exports.test.ts`

### Task 4: scaffold/index.ts 업데이트 — 배럴 export

> 신규 모듈의 public API를 배럴 export에 추가

- [ ] `index.ts`에 추가:
  ```typescript
  export { copyFeaturesToTemplate } from "./copy-features";
  export { transformDirectory } from "./transform-files";
  export { updateFeatureExports } from "./update-package-exports";
  ```
- [ ] 기존 exports 유지 확인 (`removeFeatures`, `scaffold`, `registerToBoilerplate`, path-mapping 등)

---

## Chunk 2: Scaffold 재작성 (Task 5-6)

### Task 5: scaffold/types.ts 업데이트

> ScaffoldInput과 ScaffoldResult 타입을 새 방식에 맞게 변경

- [ ] `ScaffoldInput` 변경:
  ```typescript
  export interface ScaffoldInput {
    projectName: string;
    targetDir: string;
    featuresToKeep: string[];
    /** 빈 템플릿 repo (default: superbuilder-app-boilerplate) */
    templateRepo?: string;
    /** feature 소스 경로 (로컬 superbuilder-features/features/) */
    featuresSourceDir?: string;
    /** feature 소스 repo (원격, featuresSourceDir 없을 때) */
    featuresRepo?: string;
  }
  ```
  - `boilerplateRepo` 제거 → `templateRepo` + `featuresSourceDir` + `featuresRepo` 추가
- [ ] `ScaffoldResult` 변경:
  ```typescript
  export interface ScaffoldResult {
    projectDir: string;
    installedFeatures: string[];
    manifest: FeatureManifest[];
  }
  ```
  - `manifest` 타입: `BoilerplateManifest` → `FeatureManifest[]`
  - `removedFeatures` + `keptFeatures` → `installedFeatures`
- [ ] 기존 `RemoveInput`/`RemoveResult` 유지 (feature-remover 하위 호환용)

### Task 6: scaffold/scaffold.ts 전면 재작성

> 기존 "boilerplate clone → feature 제거" 로직을 "빈 템플릿 clone → feature 복사 + 연결" 로직으로 교체

- [ ] **CRITICAL FIX**: `connection/apply-connections.ts`의 `MARKER_MAP` 경로 수정
  - `apps/atlas-server/src/app.module.ts` → `apps/server/src/app.module.ts`
  - `apps/atlas-server/src/trpc/router.ts` → `apps/server/src/trpc/router.ts`
  - Boilerplate는 `apps/server/`를 사용하므로 반드시 일치시켜야 함
- [ ] `resolveFeaturesSource(input)` 함수 구현:
  1. `input.featuresSourceDir`이 존재하면 사용
  2. 환경변수 `SUPERBUILDER_FEATURES_PATH` 확인
  3. 원격 repo clone fallback (`gh repo clone`)
- [ ] `scaffold()` 함수 재작성 (스펙 Section 2의 7단계):
  1. Clone 빈 템플릿 (`gh repo clone` → `.git` 삭제 → `updatePackageName`)
  2. Feature 소스 준비 (`resolveFeaturesSource`)
  3. Feature manifest 스캔 (`scanFeatureManifests`)
  4. Feature 코드 복사 (`copyFeaturesToTemplate`)
  5. Import 변환 (`transformDirectory` — packages/features, apps/app/src/features, apps/system-admin/src/features)
  6. Connection 삽입 (`applyConnections` — 각 manifest별)
  7. Package exports 업데이트 (`updateFeatureExports`)
  8. `.claude/settings.json` 생성 (`writeClaudeSettings` 재사용)
  9. Git init + commit
- [ ] 기존 `removeFeatures` import 제거 (레거시)
- [ ] 기존 `updatePackageName`, `writeClaudeSettings` 함수 유지 (재사용)
- [ ] typecheck 통과: `cd packages/atlas-engine && bun run typecheck`

---

## Chunk 3: Pipeline 통합 (Task 7-8)

### Task 7: pipeline/compose.ts 업데이트

> composePipeline()이 새 scaffold()를 호출하도록 수정

- [ ] `pipeline/types.ts` — `ComposeOptions`에 추가:
  ```typescript
  /** Feature 소스 로컬 경로 */
  featuresSourceDir?: string;
  /** Feature 소스 repo (원격) */
  featuresRepo?: string;
  ```
- [ ] `pipeline/types.ts` — `ComposeResult` 변경:
  - `removedFeatures` + `keptFeatures` → `installedFeatures: string[]`
- [ ] Step 1 (resolve) 변경:
  - `fetchRemoteManifest` 대신 `scanFeatureManifests` 사용
  - features source를 먼저 resolve (로컬/환경변수/원격)
  - scan 후 `resolveFeatures` 호출 (기존 resolver 재사용, manifest를 FeatureRegistry로 변환 필요 시 adapter 사용)
- [ ] Step 2 (scaffold) 변경:
  - 새 `scaffold()` 호출: `templateRepo`, `featuresSourceDir` 전달
  - `featuresToKeep: resolved.resolved`
- [ ] scaffold 완료 콜백 메시지 변경:
  - `${scaffoldResult.installedFeatures.length}개 피처 설치 완료`
- [ ] compose 반환값 매핑 업데이트:
  - `installedFeatures: scaffoldResult.installedFeatures`
- [ ] `fetchRemoteManifest` import 제거 (더 이상 사용 안 함)

### Task 8: Desktop composer.ts 호환성 확인

> Desktop tRPC router가 composePipeline() 변경에 영향받지 않는지 확인

- [ ] `apps/desktop/src/lib/trpc/routers/atlas/composer.ts` 확인
  - `composePipeline()` 호출부가 `ComposeInput` 형식에 맞는지 검증
  - `ComposeResult`의 `removedFeatures`/`keptFeatures` 참조 → `installedFeatures`로 수정
- [ ] Desktop은 neon/github/vercel 전부 false이므로 scaffold 부분만 영향
- [ ] 필요 시 `featuresSourceDir` 옵션 추가 (Desktop에서 로컬 경로 지정)
- [ ] typecheck 통과: `cd apps/desktop && bun run typecheck`

---

## Chunk 4: Boilerplate 정리 (Task 9)

### Task 9: superbuilder-app-boilerplate 정리

> Boilerplate에서 모든 feature 코드를 제거하고, 마커만 남긴 빈 템플릿으로 만들기

- [ ] 작업 레포: `/Users/bbright/Projects/superbuilder-app-boilerplate`
- [ ] 브랜치: `develop`
- [ ] Feature 코드 제거:
  - `packages/features/*` (app-router.ts 제외)
  - `apps/app/src/features/*`
  - `apps/system-admin/src/features/*`
  - `packages/drizzle/src/schema/features/*`
  - `packages/widgets/src/*` (index.ts 제외)
- [ ] 마커 블록 정리: 각 마커 파일에서 feature 관련 내용 제거, 빈 마커만 남김
  ```typescript
  // [ATLAS:IMPORTS]
  // [/ATLAS:IMPORTS]

  @Module({
    imports: [
      // [ATLAS:MODULES]
      // [/ATLAS:MODULES]
    ],
  })
  ```
- [ ] `superbuilder.json` 초기화:
  ```json
  {
    "version": "2.0.0",
    "features": {}
  }
  ```
- [ ] `packages/features/package.json` exports: 빈 상태 (app-router만)
- [ ] 빌드 통과 확인: `cd /Users/bbright/Projects/superbuilder-app-boilerplate && bun install && bun run typecheck`
- [ ] 커밋: `refactor: strip feature code, keep empty template with markers`

---

## Chunk 5: spec-verify + 빌드 검증 (Task 10)

### Task 10: spec-verify + 빌드 검증

> 스펙 대비 구현 완전성 확인 + 전체 빌드/테스트/린트 통과

- [ ] `/spec-verify docs/superpowers/specs/2026-03-15-scaffold-feature-json-migration-design.md` 실행
- [ ] typecheck: `cd packages/atlas-engine && bun run typecheck`
- [ ] test: `bun test packages/atlas-engine/`
- [ ] lint: `bun run lint:fix`
- [ ] 모두 통과할 때까지 반복

---

## Chunk 6: E2E 테스트 (Task 11)

### Task 11: E2E 테스트 실행

> 전체 파이프라인을 실제 실행하여 검증

- [ ] `/compose-e2e-test` 스킬 실행
- [ ] hello-world + comment feature로 프로젝트 생성
- [ ] 전체 체크포인트 통과 확인:
  - scaffold 완료 (feature 코드 복사됨)
  - import 변환 완료 (`@superbuilder` 잔여 없음)
  - 마커 삽입 완료 (Module/Router 등록됨)
  - Neon DB 생성됨
  - GitHub repo 생성됨
  - Vercel 배포됨
  - Owner seed 완료
  - 로그인 성공
- [ ] 실패 시 원인 분석 → 수정 → 재실행
