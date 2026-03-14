# Headless Compose Pipeline

> **요약**: Composer → Scaffold → 배포 파이프라인을 Desktop UI 없이도 CLI agent (claude/codex)에서 직접 실행 가능하게 만든다.
> 공통 오케스트레이션 함수를 `atlas-engine/pipeline`에 추출하고, Desktop UI와 CLI 양쪽에서 동일한 함수를 호출한다.

**상태**: 설계 완료 (2026-03-15)

---

## 1. 배경

### 현재 상태

Composer 파이프라인은 Desktop tRPC router(`atlas/composer.ts`)에 오케스트레이션 로직이 직접 구현되어 있다:

```
Desktop UI → composer.ts (tRPC) → scaffold() + pushToGitHub() + neon + vercel
                                   ↑ 로직이 Desktop에 종속
```

- feature 선택, 의존성 해결, scaffold, GitHub push, Neon DB 생성, Vercel 배포가 모두 tRPC mutation 안에서 실행됨
- CLI agent가 이 흐름을 실행하려면 Desktop을 거쳐야 함
- Feature 설치(`launchInstallAgent`)는 Desktop에서 별도 CLI 프로세스를 spawn하는 방식

### 문제

1. **Desktop 없이 프로젝트 생성 불가** — CLI에서 바로 scaffold + 배포할 수 없음
2. **로직 중복 위험** — CLI용으로 별도 구현하면 두 곳에서 관리해야 함
3. **Feature 설치가 분리됨** — scaffold 후 별도 agent를 실행해야 하는 2단계 구조

### 목표

1. `composePipeline()` 공통 함수로 전체 흐름을 추출
2. Desktop UI와 CLI agent 양쪽에서 동일한 함수 호출
3. CLI에서 대화형/비대화형 모두 지원
4. Feature 설치까지 파이프라인 내에서 완료 (CLI 실행 시)

---

## 2. 아키텍처

### 변경 전

```
Desktop UI ──→ composer.ts (tRPC) ──→ scaffold()
                                  ──→ gh repo create (직접)
                                  ──→ Neon API (직접)
                                  ──→ Vercel API (직접)
                                  ──→ launchInstallAgent() → spawn("claude")
```

### 변경 후

```
Desktop UI ─┐
             ├──→ composePipeline(input, callbacks)
CLI agent ──┘       │
                    ├── 1. resolveFeatures()         — 의존성 해결
                    ├── 2. scaffold()                — clone + feature 제거
                    ├── 3. createNeonProject()       — DB 생성 + DATABASE_URL
                    ├── 4. pushToGitHub()            — repo 생성 + push
                    ├── 5. deployToVercel()           — Vercel 연결 + 배포
                    ├── 6. writeEnvFile()            — .env 생성
                    └── 7. installFeatures()         — bun install + DB push (opt-in)
```

### 호출자별 차이

| 호출자 | 진입점 | install 기본값 | 진행 콜백 |
|--------|--------|---------------|----------|
| **Desktop UI** | tRPC mutation (thin wrapper) | `false` (이후 UI에서 별도 실행) | UI progress bar |
| **CLI agent** | `.agents/commands/compose.md` | `true` (파이프라인 내에서 직접) | 텍스트 출력 |
| **스크립트/자동화** | `composePipeline()` 직접 호출 | 설정에 따름 | 커스텀 콜백 |

---

## 3. 핵심 인터페이스

### ComposeInput

```typescript
interface ComposeInput {
  /** 선택된 feature IDs */
  features: string[];
  /** 프로젝트 이름 (package.json name) */
  projectName: string;
  /** 프로젝트 생성 경로 */
  targetPath: string;
  /** 선택적 옵션 */
  options?: ComposeOptions;
}

interface ComposeOptions {
  /** Neon DB 프로젝트 생성 (default: true) */
  neon?: boolean;
  /** GitHub repo 생성 + push (default: true) */
  github?: boolean;
  /** Vercel 배포 (default: true) */
  vercel?: boolean;
  /** GitHub organization (default: "BBrightcode-atlas") */
  githubOrg?: string;
  /** Private repo (default: true) */
  private?: boolean;
  /** Feature 설치 실행 — bun install + DB push + env 설정 (default: false) */
  install?: boolean;
  /** Boilerplate repo override */
  boilerplateRepo?: string;
}
```

### ComposeResult

```typescript
interface ComposeResult {
  /** 생성된 프로젝트 경로 */
  projectDir: string;
  /** 프로젝트 이름 */
  projectName: string;
  /** 의존성 해결 결과 */
  resolved: ResolvedFeatures;
  /** 제거된 feature 목록 */
  removedFeatures: string[];
  /** 유지된 feature 목록 */
  keptFeatures: string[];
  /** Neon 결과 (옵션 활성화 시) */
  neon?: {
    projectId: string;
    databaseUrl: string;
  };
  /** GitHub 결과 (옵션 활성화 시) */
  github?: {
    repoUrl: string;
    owner: string;
    repo: string;
  };
  /** Vercel 결과 (옵션 활성화 시) */
  vercel?: {
    projectId: string;
    deploymentUrl: string;
  };
  /** 설치 완료 여부 */
  installed: boolean;
}
```

### ComposeCallbacks

진행 상황을 호출자에게 전달하는 콜백. Desktop UI는 progress bar, CLI agent는 텍스트 출력에 사용.

```typescript
interface ComposeCallbacks {
  /** 단계 시작/완료/에러 알림 */
  onStep?: (step: ComposeStep, status: "start" | "done" | "skip" | "error", message?: string) => void;
  /** 상세 로그 */
  onLog?: (message: string) => void;
}

type ComposeStep =
  | "resolve"
  | "scaffold"
  | "neon"
  | "github"
  | "vercel"
  | "env"
  | "install";
```

---

## 4. 파이프라인 실행 흐름

### composePipeline() 상세

```typescript
async function composePipeline(
  input: ComposeInput,
  callbacks?: ComposeCallbacks,
): Promise<ComposeResult> {
  const opts = { neon: true, github: true, vercel: true, install: false, ...input.options };

  // Step 1: Feature 의존성 해결
  callbacks?.onStep?.("resolve", "start");
  const manifest = await fetchManifestForCompose(opts.boilerplateRepo);
  const resolved = resolveFeatures(manifest, input.features);
  callbacks?.onStep?.("resolve", "done");

  // Step 2: Scaffold (clone + feature 제거)
  callbacks?.onStep?.("scaffold", "start");
  const projectDir = join(input.targetPath, input.projectName);
  const scaffoldResult = await scaffold({
    projectName: input.projectName,
    targetDir: projectDir,
    featuresToKeep: resolved.resolved,
    boilerplateRepo: opts.boilerplateRepo,
  });
  callbacks?.onStep?.("scaffold", "done");

  // Step 3: Neon DB
  let neonResult;
  if (opts.neon) {
    callbacks?.onStep?.("neon", "start");
    neonResult = await createNeonProject({
      projectName: input.projectName,
    });
    callbacks?.onStep?.("neon", "done");
  } else {
    callbacks?.onStep?.("neon", "skip");
  }

  // Step 4: GitHub push
  let githubResult;
  if (opts.github) {
    callbacks?.onStep?.("github", "start");
    githubResult = await pushToGitHub({
      projectDir,
      repoName: input.projectName,
      org: opts.githubOrg ?? "BBrightcode-atlas",
      private: opts.private ?? true,
    });
    callbacks?.onStep?.("github", "done");
  } else {
    callbacks?.onStep?.("github", "skip");
  }

  // Step 5: Vercel 배포
  let vercelResult;
  if (opts.vercel && githubResult) {
    callbacks?.onStep?.("vercel", "start");
    vercelResult = await deployToVercel({
      repoUrl: githubResult.repoUrl,
      projectName: input.projectName,
      envVars: {
        DATABASE_URL: neonResult?.databaseUrl,
      },
    });
    callbacks?.onStep?.("vercel", "done");
  } else {
    callbacks?.onStep?.("vercel", "skip");
  }

  // Step 6: .env 파일 생성
  callbacks?.onStep?.("env", "start");
  await writeEnvFile(projectDir, {
    DATABASE_URL: neonResult?.databaseUrl,
    // 기타 환경변수
  });
  callbacks?.onStep?.("env", "done");

  // Step 7: Feature 설치 (opt-in)
  let installed = false;
  if (opts.install) {
    callbacks?.onStep?.("install", "start");
    await installFeatures({
      projectDir,
      features: resolved.resolved,
    });
    installed = true;
    callbacks?.onStep?.("install", "done");
  } else {
    callbacks?.onStep?.("install", "skip");
  }

  return {
    projectDir,
    projectName: input.projectName,
    resolved,
    removedFeatures: scaffoldResult.removedFeatures,
    keptFeatures: scaffoldResult.keptFeatures,
    neon: neonResult,
    github: githubResult,
    vercel: vercelResult,
    installed,
  };
}
```

### installFeatures() 상세

```typescript
interface InstallInput {
  projectDir: string;
  features: string[];
}

async function installFeatures(input: InstallInput): Promise<void> {
  const { projectDir } = input;

  // 1. 의존성 설치
  await execFile("bun", ["install"], { cwd: projectDir });

  // 2. DB 마이그레이션 (Neon 연결된 경우)
  const envPath = join(projectDir, ".env");
  if (existsSync(envPath)) {
    await execFile("bunx", ["drizzle-kit", "push"], { cwd: projectDir });
  }

  // 3. 기타 post-scaffold 설정
  // - AUTH_SECRET 생성
  // - 초기 데이터 시딩 (있는 경우)
}
```

---

## 5. CLI Agent 스킬

### `.agents/commands/compose.md`

두 가지 모드를 지원한다.

#### (a) 대화형 모드 — 인자 없이 실행

```
사용자: /compose
```

agent가 수행하는 흐름:
1. `fetchRemoteManifest()` 또는 `scanFeatureManifests()`로 feature 목록 조회
2. 그룹별로 feature 목록 표시 (core, content, commerce, community, system, template)
3. 사용자에게 선택 요청 (번호 또는 이름)
4. `resolveFeatures()`로 의존성 해결 → 자동 포함 feature 표시
5. 프로젝트 이름 질문
6. 저장 경로 질문 (기본값: ~/Projects)
7. `composePipeline()` 실행 (install: true)
8. 결과 출력

대화 예시:
```
Agent: 사용 가능한 Features:

📦 Core (자동 포함)
  ✅ profile, role-permission

📝 Content
  [ ] blog    [ ] board    [ ] community
  [ ] marketing    [ ] content-studio

💰 Commerce
  [ ] payment    [ ] booking    [ ] coupon

💬 Community
  [ ] comment    [ ] reaction    [ ] review    [ ] bookmark

🔧 System
  [ ] notification    [ ] email    [ ] file-manager    [ ] scheduled-job

사용할 feature 이름을 입력하세요 (콤마 구분):
> blog, comment, payment

의존성 해결 결과:
  선택: blog, comment, payment
  자동 포함: profile, role-permission (core), reaction (blog 의존)
  총 6개 feature

프로젝트 이름:
> my-saas-app

저장 경로 (기본: ~/Projects):
> (엔터)

🚀 프로젝트 생성 중...
  ✅ 의존성 해결 (6개 feature)
  ✅ Scaffold 완료 (34개 feature 제거)
  ✅ Neon DB 생성
  ✅ GitHub repo 생성
  ✅ Vercel 배포
  ✅ .env 생성
  ✅ Feature 설치 완료

프로젝트 준비 완료: ~/Projects/my-saas-app
```

#### (b) 비대화형 모드 — 인자 전달

```
사용자: /compose --features blog,comment,payment --name my-saas-app --path ~/Projects
```

또는 config 파일:
```
사용자: /compose --config compose.json
```

`compose.json`:
```json
{
  "features": ["blog", "comment", "payment"],
  "projectName": "my-saas-app",
  "targetPath": "~/Projects",
  "options": {
    "neon": true,
    "github": true,
    "vercel": true,
    "install": true
  }
}
```

바로 `composePipeline()` 실행 → 결과 출력.

---

## 6. Desktop tRPC 변경

`apps/desktop/src/lib/trpc/routers/atlas/composer.ts`를 thin wrapper로 리팩토링:

```typescript
export const createAtlasComposerRouter = () =>
  router({
    compose: publicProcedure
      .input(composeInputSchema)
      .mutation(async ({ input }) => {
        // composePipeline() 호출 (install: false — Desktop은 별도 실행)
        const result = await composePipeline({
          features: input.selected,
          projectName: input.projectName,
          targetPath: input.targetPath,
          options: {
            neon: input.config?.database?.provider === "neon",
            vercel: input.config?.deploy?.provider === "vercel",
            install: false,  // Desktop은 이후 launchInstallAgent로 별도 실행
          },
        });

        // localDb에 프로젝트 메타데이터 저장 (Desktop 전용)
        const [project] = await localDb
          .insert(atlasProjects)
          .values({
            name: input.projectName,
            localPath: result.projectDir,
            features: result.resolved.resolved,
            neonProjectId: result.neon?.projectId ?? null,
            gitRemoteUrl: result.github?.repoUrl ?? null,
            status: "created",
          })
          .returning();

        return { ...result, projectId: project.id };
      }),

    // launchInstallAgent는 기존 유지 (Desktop UI 전용)
    launchInstallAgent: publicProcedure
      .input(z.object({ projectDir: z.string(), agent: z.enum(["claude", "codex"]).default("claude") }))
      .mutation(async ({ input }) => {
        // 기존 spawn 로직 유지
      }),
  });
```

---

## 7. 파일 구조

### 신규 파일

```
packages/atlas-engine/src/
├── pipeline/                    # NEW — 공통 오케스트레이션
│   ├── index.ts                 # barrel export
│   ├── compose.ts               # composePipeline() 메인 오케스트레이터
│   ├── types.ts                 # ComposeInput, ComposeResult, ComposeCallbacks
│   ├── neon.ts                  # createNeonProject()
│   ├── github.ts                # pushToGitHub()
│   ├── vercel.ts                # deployToVercel()
│   ├── env.ts                   # writeEnvFile()
│   └── install.ts               # installFeatures()

.agents/commands/
└── compose.md                   # CLI agent 스킬
```

### 수정 파일

```
apps/desktop/src/lib/trpc/routers/atlas/composer.ts  # thin wrapper로 리팩토링
packages/atlas-engine/src/index.ts                    # pipeline export 추가
packages/atlas-engine/package.json                    # "./pipeline" subpath 추가
```

---

## 8. 환경변수

| 변수 | 용도 | 필수 |
|------|------|------|
| `NEON_API_KEY` | Neon DB 프로젝트 생성 | neon 옵션 사용 시 |
| `GITHUB_TOKEN` | gh CLI가 자동 사용 | github 옵션 사용 시 |
| `VERCEL_TOKEN` | Vercel API 인증 | vercel 옵션 사용 시 |
| `NEON_ORG_ID` | Neon organization | neon 옵션 사용 시 |

> `SUPERBUILDER_PATH`, `ATLAS_PATH`는 더 이상 필요 없음 — `composePipeline()`이 boilerplate를 직접 clone하고, manifest를 clone된 프로젝트에서 로드함.

---

## 9. 에러 처리

| 단계 | 실패 시 동작 |
|------|-------------|
| resolve | 즉시 에러 반환 (순환 의존성, 누락 feature) |
| scaffold | 즉시 에러 반환 (clone 실패, manifest 없음) |
| neon | 경고 출력 + 계속 진행 (DB 없이도 프로젝트 생성 가능) |
| github | 경고 출력 + 계속 진행 (로컬에만 프로젝트 유지) |
| vercel | 경고 출력 + 계속 진행 (github 없으면 자동 skip) |
| env | 경고 출력 + 계속 진행 |
| install | 에러 출력 + 수동 안내 ("bun install && bunx drizzle-kit push 실행하세요") |

Neon/GitHub/Vercel은 **비필수 단계**로, 실패해도 프로젝트 scaffold 자체는 완료된 상태를 보장한다.

---

## 10. 기존 코드와의 관계

### Desktop Neon/Vercel 라우터에서 추출

현재 `neon.ts`, `vercel.ts` Desktop tRPC 라우터에 있는 로직을 `pipeline/neon.ts`, `pipeline/vercel.ts`로 추출한다. Desktop 라우터는 이 함수들을 import하여 사용.

| 현재 위치 | 추출 위치 |
|----------|----------|
| `atlas/neon.ts` (tRPC) | `pipeline/neon.ts` (순수 함수) |
| `atlas/vercel.ts` (tRPC) | `pipeline/vercel.ts` (순수 함수) |
| `atlas/composer.ts` → `pushToGitHub` 로직 | `pipeline/github.ts` (순수 함수) |
| `atlas/composer.ts` → scaffold 호출 로직 | `pipeline/compose.ts` (오케스트레이터) |

### 하위 호환성

- Desktop UI의 동작은 변하지 않음
- tRPC router의 input/output 스키마는 기존과 동일
- `launchInstallAgent()`는 Desktop 전용으로 유지

---

## 부록: 향후 확장

### feature.json 전환 후

현재 `fetchRemoteManifest()`로 boilerplate의 `superbuilder.json`을 읽지만, feature.json 전환 완료 후:

1. `scanFeatureManifests()`로 `superbuilder-features/features/*/feature.json` 스캔
2. `manifestsToRegistry()`로 FeatureRegistry 변환
3. scaffold 방식 변경: "전체 clone → 제거" → "빈 템플릿 + feature 설치"
4. `deriveConnections()` + `applyConnections()`로 마커 자동 삽입
5. `transformImports()`로 `@superbuilder/*` → `@repo/*` 변환

`composePipeline()`의 인터페이스는 동일하게 유지. 내부 구현만 변경.
