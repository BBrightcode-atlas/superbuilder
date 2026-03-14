# Scaffold Feature-JSON 전면 전환

> **요약**: scaffold 방식을 "boilerplate 전체 clone → 불필요 제거"에서 "빈 템플릿 clone → superbuilder-features에서 선택 feature 복사 + 연결"로 전환한다.

**상태**: 설계 완료 (2026-03-15)

---

## 1. 배경

### 현재 (레거시)

```
boilerplate (30+ features 내장) → clone → removeFeatures() → 프로젝트
```

- Feature 코드가 boilerplate에 종속
- superbuilder.json에 connections를 수동 관리
- Feature 추가/수정 시 boilerplate에 직접 커밋 필요

### 변경 후

```
빈 템플릿 (auth + 마커만) → clone → copyFeatures() → transformImports() → applyConnections() → 프로젝트
```

- Feature 코드는 superbuilder-features에서 독립 관리
- feature.json의 provides에서 connections 자동 도출
- Import 경로 자동 변환

### 전제

- boilerplate만 설치해도 로그인 + 빈 대시보드가 동작한다 (auth/profile은 core 인프라)
- superbuilder-features에 30개 feature가 이미 feature.json과 함께 존재
- atlas-engine에 scanner, deriver, applier, transformer, path-mapping 모듈이 이미 구현됨

---

## 2. 새 Scaffold 흐름

```
scaffoldFromFeatures(input)
  │
  ├── 1. Clone 빈 템플릿
  │     gh repo clone superbuilder-app-boilerplate → targetDir (shallow)
  │     .git 삭제, package.json name 변경
  │
  ├── 2. Feature 소스 준비
  │     superbuilder-features/features/ 에서 선택된 feature의 소스 경로 해석
  │     (로컬 경로 또는 gh repo clone)
  │
  ├── 3. Feature 코드 복사
  │     각 feature의 src/{slot}/ → 템플릿의 대상 경로로 복사
  │     ├── src/server/  → packages/features/{name}/
  │     ├── src/client/  → apps/app/src/features/{name}/
  │     ├── src/admin/   → apps/system-admin/src/features/{name}/
  │     ├── src/schema/  → packages/drizzle/src/schema/features/{name}/
  │     └── src/widget/  → packages/widgets/src/{name}/
  │
  ├── 4. Import 변환
  │     복사된 모든 .ts/.tsx 파일에 transformImports() 적용
  │     @superbuilder/core-auth → @repo/core/auth
  │     @superbuilder/feature-blog → @repo/features/blog
  │     등등
  │
  ├── 5. Connection 삽입
  │     각 feature의 provides → deriveConnections() → insertAtMarker()
  │     [ATLAS:IMPORTS], [ATLAS:MODULES], [ATLAS:ROUTES] 등에 코드 삽입
  │
  ├── 6. Package exports 업데이트
  │     packages/features/package.json에 각 feature의 subpath export 추가
  │     packages/widgets/package.json에 widget export 추가 (해당 시)
  │
  └── 7. Git init + commit
```

---

## 3. 핵심 인터페이스

### ScaffoldInput (변경)

```typescript
interface ScaffoldInput {
  projectName: string;
  targetDir: string;
  /** 유지할 feature ID 목록 (resolved, 토폴로지 순서) */
  featuresToKeep: string[];
  /** 빈 템플릿 repo (default: superbuilder-app-boilerplate) */
  templateRepo?: string;
  /** feature 소스 경로 (로컬 superbuilder-features/features/) */
  featuresSourceDir?: string;
  /** feature 소스 repo (원격, featuresSourceDir 없을 때) */
  featuresRepo?: string;
}
```

### ScaffoldResult (유지)

```typescript
interface ScaffoldResult {
  projectDir: string;
  installedFeatures: string[];
  manifest: FeatureManifest[];
}
```

---

## 4. 신규 모듈

### copy-features.ts

```typescript
async function copyFeaturesToTemplate(opts: {
  templateDir: string;
  featuresSourceDir: string;
  featureIds: string[];
  manifests: FeatureManifest[];
}): Promise<void>
```

각 feature의 `provides`를 확인하여 존재하는 slot만 복사:
- `provides.server` 있으면 → server slot 복사
- `provides.client` 있으면 → client slot 복사
- `provides.admin` 있으면 → admin slot 복사
- `provides.schema` 있으면 → schema slot 복사
- `provides.widget` 있으면 → widget slot 복사

존재하지 않는 소스 디렉토리는 건너뛴다.

### transform-files.ts

```typescript
async function transformDirectory(dir: string): Promise<number>
```

디렉토리를 재귀 탐색하여 모든 `.ts`, `.tsx` 파일에 `transformImports()`를 적용.
변환된 파일 수를 반환.

### update-package-exports.ts

```typescript
async function updateFeatureExports(
  templateDir: string,
  featureIds: string[],
  manifests: FeatureManifest[],
): Promise<void>
```

`packages/features/package.json`의 exports 필드에 각 feature의 subpath 추가:
```json
{
  "exports": {
    "./hello-world": "./hello-world/index.ts",
    "./hello-world/server": "./hello-world/server/index.ts"
  }
}
```

---

## 5. 기존 모듈 변경

### scaffold.ts — 전면 재작성

기존 `removeFeatures()` 기반 로직 → 새 흐름으로 교체:

```typescript
export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
  // 1. Clone 빈 템플릿
  await cloneTemplate(input.templateRepo, input.targetDir);
  await updatePackageName(input.targetDir, input.projectName);

  // 2. Feature 소스 준비
  const featuresDir = await resolveFeaturesSource(input);
  const manifests = scanFeatureManifests(featuresDir);

  // 3. Feature 코드 복사
  const selectedManifests = manifests.filter(m => input.featuresToKeep.includes(m.id));
  await copyFeaturesToTemplate({
    templateDir: input.targetDir,
    featuresSourceDir: featuresDir,
    featureIds: input.featuresToKeep,
    manifests: selectedManifests,
  });

  // 4. Import 변환
  await transformDirectory(join(input.targetDir, "packages/features"));
  await transformDirectory(join(input.targetDir, "apps/app/src/features"));
  await transformDirectory(join(input.targetDir, "apps/system-admin/src/features"));

  // 5. Connection 삽입
  for (const manifest of selectedManifests) {
    applyConnections(input.targetDir, manifest);
  }

  // 6. Package exports 업데이트
  await updateFeatureExports(input.targetDir, input.featuresToKeep, selectedManifests);

  // 7. Git init
  await gitInit(input.targetDir);

  return {
    projectDir: input.targetDir,
    installedFeatures: input.featuresToKeep,
    manifest: selectedManifests,
  };
}
```

### compose.ts — scaffold 호출 업데이트

`composePipeline()`의 Step 2에서 새 `scaffold()` 호출. `featuresToKeep`에 resolved features 전달.

### feature-remover.ts — 유지 (하위 호환)

삭제하지 않음. 향후 프로젝트에서 feature를 제거할 때 여전히 사용 가능.

---

## 6. Boilerplate 정리

superbuilder-app-boilerplate에서 feature 코드를 제거하고 마커만 남긴다.

### 제거 대상

```
packages/features/*/          # 각 feature 디렉토리 (app-router.ts 제외)
apps/app/src/features/*/      # 클라이언트 feature 코드
apps/system-admin/src/features/*/  # 어드민 feature 코드
packages/drizzle/src/schema/features/*/  # feature 스키마
packages/widgets/src/*/       # widget 코드
```

### 유지 대상

```
packages/core/                # auth, trpc, logger 등 (Core Contract 구현체)
packages/drizzle/src/schema/core/  # users, profiles, auth 테이블
packages/features/app-router.ts    # [ATLAS:*] 마커 (빈 상태)
packages/ui/                  # shadcn 컴포넌트
apps/server/                  # NestJS + better-auth (마커만)
apps/app/                     # React 앱 셸 (마커만)
apps/system-admin/            # 관리자 셸 (마커만)
.env.example                  # 환경변수 템플릿
```

### 마커 블록 정리

각 마커 파일에서 feature 관련 내용을 제거하고 빈 마커만 남긴다:

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

### superbuilder.json

```json
{
  "version": "2.0.0",
  "features": {}
}
```

---

## 7. Feature 소스 해석

CLI에서 실행할 때 feature 소스를 어디서 가져올지:

```typescript
async function resolveFeaturesSource(input: ScaffoldInput): Promise<string> {
  // 1. 로컬 경로가 있으면 사용
  if (input.featuresSourceDir && existsSync(input.featuresSourceDir)) {
    return input.featuresSourceDir;
  }

  // 2. 환경변수 SUPERBUILDER_FEATURES_PATH
  const envPath = process.env.SUPERBUILDER_FEATURES_PATH;
  if (envPath && existsSync(join(envPath, "features"))) {
    return join(envPath, "features");
  }

  // 3. 원격 repo clone (임시 디렉토리)
  const repo = input.featuresRepo ?? "BBrightcode-atlas/superbuilder-features";
  const tmpDir = join(tmpdir(), `superbuilder-features-${Date.now()}`);
  await execFile("gh", ["repo", "clone", repo, tmpDir, "--", "--depth=1"]);
  return join(tmpDir, "features");
}
```

---

## 8. 환경변수

| 변수 | 용도 |
|------|------|
| `SUPERBUILDER_FEATURES_PATH` | superbuilder-features 로컬 경로 (선택) |

기존 환경변수 (NEON_API_KEY, VERCEL_TOKEN 등)는 변경 없음.
