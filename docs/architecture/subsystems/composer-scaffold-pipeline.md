# Composer → Scaffold 파이프라인

> Composer UI에서 사용자가 feature를 선택하고 프로젝트를 생성하는 전체 흐름.

---

## 전체 파이프라인 개요

```
Desktop UI (React + Zustand)
  │
  ├── Step 1: Feature 선택
  ├── Step 2: 의존성 확인
  ├── Step 3: 프로젝트 설정
  ├── Step 4: 프로젝트 생성 (scaffold)
  ├── Step 5: Neon DB 생성
  └── Step 6: Vercel 배포
```

---

## UI 스텝 (6단계)

| Step | 이름 | 설명 | 관련 컴포넌트 |
|------|------|------|--------------|
| 1 | Feature 선택 | 사용할 Feature를 토글 선택 | `FeatureGrid`, `FeatureCard`, `GroupFilter` |
| 2 | 의존성 확인 | 자동 포함되는 Feature 확인 | `ResolutionPreview`, `DependencyGraph` |
| 3 | 프로젝트 설정 | 이름, 저장 경로 입력 | `ProjectConfig` |
| 4 | 프로젝트 생성 | boilerplate clone → feature 제거 → git init | `ComposerStepper` |
| 5 | Neon | PostgreSQL 데이터베이스 프로젝트 생성 | `NeonSetup` |
| 6 | Vercel | GitHub push → Vercel 배포 | `VercelSetup` |

UI 상태 관리: `useAtlasComposerStore` (Zustand)
- `step`: 현재 단계 (0-5)
- `selectedFeatures`: 사용자가 선택한 feature ID 배열
- `projectName`: 프로젝트 이름
- `targetPath`: 저장 경로 (localStorage에 persist)

파일: `apps/desktop/src/renderer/stores/atlas-state.ts`

---

## 데이터 흐름 상세

### Step 1: Feature 선택

```
registry.ts router
  → fetchRemoteManifest()
    → GitHub API로 superbuilder-app-boilerplate/superbuilder.json 조회
    → BoilerplateManifest 반환 (features, groups, dependencies)
  → UI에 feature 카드 렌더링
  → 사용자가 feature 토글 → selectedFeatures[] 업데이트
```

### Step 2: 의존성 확인

```
resolver.ts router
  → resolveFeatures(manifest, selected)
    ├── 1. core features 자동 포함 (group === "core")
    ├── 2. selected features 추가
    ├── 3. dependencies 재귀 탐색
    │     - 순환 의존성 감지 (visiting set으로 cycle detection)
    │     - 누락 의존성 에러 (missing_dependency)
    ├── 4. 토폴로지 정렬 (Kahn's algorithm)
    └── 5. optional dependencies 목록 반환
  → ResolvedFeatures 반환:
    {
      selected: ["blog", "comment"],        // 사용자 선택
      autoIncluded: ["profile", "auth"],     // 자동 포함 (core + deps)
      resolved: ["auth", "profile", ...],    // 토폴로지 순서
      availableOptional: ["reaction"],       // 선택 가능한 optional
    }
```

파일: `packages/atlas-engine/src/resolver/resolver.ts`

### Step 3: 프로젝트 설정

사용자 입력:
- `projectName`: 프로젝트 이름 (package.json name으로 사용)
- `targetPath`: 로컬 저장 경로

### Step 4: 프로젝트 생성 (핵심)

tRPC mutation: `atlas.composer.compose`

```
Input:
{
  selected: string[],         // 선택된 feature IDs
  projectName: string,        // 프로젝트 이름
  targetPath: string,         // 저장 경로
  config?: {
    database: { provider: "neon" },
    auth: { provider: "better-auth", features: ["email"] },
    deploy: { provider: "vercel" | "none" },
  }
}
```

**실행 순서:**

```
composer.ts (Desktop tRPC router)
  │
  ├── 1. loadRegistry() — 레지스트리 로드
  ├── 2. resolveFeatures() — 의존성 해결
  │
  └── 3. scaffold(input) ─────────────────────────────────────────
        │
        │  atlas-engine/scaffold/scaffold.ts
        │
        ├── (a) gh repo clone (shallow, depth=1)
        │     BBrightcode-atlas/superbuilder-app-boilerplate → targetDir
        │
        ├── (b) .git 삭제
        │     rm -rf targetDir/.git
        │
        ├── (c) package.json name 변경
        │     "name": projectName
        │
        ├── (d) superbuilder.json 로드
        │     loadManifest(targetDir)
        │
        ├── (e) 유지할 feature 계산
        │     keepSet = selected ∪ core ∪ dependencies(재귀)
        │     featuresToRemove = 전체features - keepSet
        │
        ├── (f) removeFeatures() ── 불필요 feature 제거 (아래 상세)
        │
        ├── (g) .claude/settings.json 생성
        │     { permissions: { allow: ["Bash(*)", "Read(*)", ...] } }
        │
        └── (h) git init + "Initial commit from Superbuilder Composer"
  │
  └── 4. localDb.insert(atlasProjects) — 프로젝트 메타 저장
        { name, localPath, features, status: "created" }
```

### Step 5: Neon DB 생성

```
neon.ts router
  → Neon API로 PostgreSQL 프로젝트 생성
  → DATABASE_URL을 .env에 기록
  → localDb에 neonProjectId 업데이트
```

### Step 6: Vercel 배포

```
composer.ts → pushToGitHub()
  → gh repo create BBrightcode-atlas/{repoName} --private --source --push
  → localDb에 gitRemoteUrl 업데이트

vercel.ts router
  → Vercel API로 프로젝트 연결
  → 환경변수 설정 (DATABASE_URL 등)
  → 배포 트리거
```

---

## Feature 제거 로직 상세 (removeFeatures)

scaffold의 핵심: **"전체 clone → 불필요 제거"** 방식.

파일: `packages/atlas-engine/src/scaffold/feature-remover.ts`

### 제거 순서

```
removeFeatures(input)
  │
  ├── 1. resolveRemovalSet() — 역의존성 캐스케이드
  │     요청: [comment] 제거
  │     → comment에 의존하는 blog, community도 자동 제거
  │     → 재귀적으로 전파 (while changed)
  │
  ├── 2. core feature 제거 방지
  │     group === "core"인 feature는 제거 불가 (에러 throw)
  │
  ├── 3. feature 디렉토리 삭제
  │     manifest.features[name].paths 순회:
  │     ├── rm -rf packages/features/{name}/        (server)
  │     ├── rm -rf apps/app/src/features/{name}/    (client)
  │     ├── rm -rf apps/system-admin/src/features/{name}/ (admin)
  │     └── rm -rf packages/drizzle/src/schema/features/{name}/ (schema)
  │
  ├── 4. 마커 connection 정리
  │     manifest.features[name].connections 순회:
  │     각 connection = { file, marker, content }
  │     ├── file 읽기
  │     ├── [ATLAS:{marker}] ~ [/ATLAS:{marker}] 블록 내에서
  │     │   content.trim()과 일치하는 줄 삭제
  │     └── file 다시 쓰기
  │
  └── 5. superbuilder.json 업데이트
        ├── 제거된 feature 엔트리 삭제
        ├── 남은 feature의 dependents 배열에서 제거된 이름 제거
        └── saveManifest()
```

### 마커 정리 예시

**제거 전** (`apps/server/src/app.module.ts`):
```typescript
// [ATLAS:IMPORTS]
import { ProfileModule } from '@repo/features/profile';
import { BlogModule } from '@repo/features/blog';
import { CommentModule } from '@repo/features/comment';
// [/ATLAS:IMPORTS]

@Module({
  imports: [
    // [ATLAS:MODULES]
    ProfileModule,
    BlogModule,
    CommentModule,
    // [/ATLAS:MODULES]
  ],
})
```

**blog, comment 제거 후:**
```typescript
// [ATLAS:IMPORTS]
import { ProfileModule } from '@repo/features/profile';
// [/ATLAS:IMPORTS]

@Module({
  imports: [
    // [ATLAS:MODULES]
    ProfileModule,
    // [/ATLAS:MODULES]
  ],
})
```

### 역의존성 캐스케이드 예시

```
feature 의존성 그래프:
  blog → [comment, reaction]
  community → [comment, reaction]
  comment → []
  reaction → []

사용자가 comment 제거 요청:
  → comment에 의존하는 blog 자동 제거
  → comment에 의존하는 community 자동 제거
  → 최종 제거: [comment, blog, community]
  → reaction은 유지 (comment에 의존하지 않음)
```

---

## 핵심 함수 체인

| 단계 | 함수 | 파일 |
|------|------|------|
| Feature 목록 조회 | `fetchRemoteManifest()` | `atlas-engine/manifest/remote.ts` |
| 의존성 해결 | `resolveFeatures(manifest, selected)` | `atlas-engine/resolver/resolver.ts` |
| 토폴로지 정렬 | `topologicalSort()` | `resolver.ts` 내부 |
| 프로젝트 생성 | `scaffold(input)` | `atlas-engine/scaffold/scaffold.ts` |
| Feature 제거 | `removeFeatures(input)` | `atlas-engine/scaffold/feature-remover.ts` |
| 역의존성 계산 | `resolveRemovalSet()` | `feature-remover.ts` 내부 |
| 마커 코드 삭제 | `removeFromMarkerBlock()` | `feature-remover.ts` 내부 |
| Manifest 로드/저장 | `loadManifest()`, `saveManifest()` | `atlas-engine/manifest/local.ts` |
| GitHub push | `gh repo create --push` | `atlas/composer.ts` |
| CLI agent 실행 | `spawn("claude", [...])` | `atlas/composer.ts` |

---

## tRPC Router 구조

```
atlas/ (Desktop tRPC)
├── registry.ts     — feature 카탈로그 조회 (manifest 캐시)
├── resolver.ts     — 의존성 해결
├── composer.ts     — 프로젝트 생성 (scaffold + GitHub push + CLI agent)
├── neon.ts         — Neon DB 프로젝트 생성/관리
├── vercel.ts       — Vercel 배포
└── deployments.ts  — 배포 상태 조회
```

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `SUPERBUILDER_PATH` | superbuilder 레포 로컬 경로 |
| `ATLAS_PATH` | atlas 레지스트리 경로 |
| `NEON_API_KEY` | Neon API 인증 |
| `VERCEL_TOKEN` | Vercel API 인증 |

---

## 부록: CLI Agent 후처리

프로젝트 생성 후, `launchInstallAgent` mutation으로 CLI agent를 실행할 수 있다:

```typescript
// composer.ts
spawn("claude", ["--dangerously-skip-permissions", "-p", prompt], {
  cwd: projectDir,
  detached: true,
});
```

agent는 `.claude/commands/install-features.md` 워크플로우를 따라 추가 설정 (DB 마이그레이션, 환경 변수 등)을 자동 수행한다.

---

## 향후 변경 예정 (feature.json 전환 후)

현재 scaffold는 **boilerplate 내부의 superbuilder.json**을 source of truth로 사용한다.
feature.json 전환이 완료되면:

1. `fetchRemoteManifest()` 대신 `scanFeatureManifests()` 사용
2. `removeFeatures()` 대신 **"빈 템플릿 + feature 설치"** 방식으로 전환
3. `connections` 필드를 수동 관리 대신 `deriveConnections()`로 자동 도출
4. Import 변환: `transformImports()`로 `@superbuilder/*` → `@repo/*`

상세: `docs/superpowers/specs/2026-03-14-backstage-feature-plugin-system-design.md` Section 7
