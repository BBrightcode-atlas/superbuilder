# Composer Project Tracking (Neon DB)

> compose 파이프라인으로 생성한 프로젝트의 상태를 중앙 Neon DB에 저장하여 여러 사용자가 조회 가능하게 함.

---

## 개요

기존에는 compose 결과가 Desktop의 local SQLite(`atlasProjects`)에만 저장되어 해당 머신에서만 확인 가능했음.
이를 Neon PostgreSQL의 `composer_projects` 테이블로 이동하여 조직 내 모든 사용자가 Deployments 페이지에서 확인 가능하게 함.

---

## 테이블 스키마

```
composer_projects (Neon PostgreSQL)
├── id                      uuid PK
├── organization_id         uuid FK → organizations
├── created_by_id           uuid FK → users
├── name                    varchar(200)
├── status                  enum (scaffolding | provisioning | deploying | seeding | deployed | error)
├── features                jsonb (string[])
├── github_repo_url         text
├── neon_project_id         varchar(100)
├── vercel_project_id       varchar(100)
├── vercel_url              text
├── vercel_server_project_id varchar(100)
├── vercel_server_url       text
├── vercel_admin_project_id varchar(100)
├── vercel_admin_url        text
├── vercel_landing_project_id varchar(100)
├── vercel_landing_url      text
├── owner_email             varchar(255)
├── error_message           text
├── created_at              timestamp
├── updated_at              timestamp
```

파일: `packages/db/src/schema/composer.ts`
Enum: `packages/db/src/schema/enums.ts` → `composerProjectStatusValues`

---

## Status Enum 흐름

```
scaffolding → provisioning → deploying → seeding → deployed
                                                      ↑
                                            (어느 단계에서든) → error
```

| Status | 시점 | 설명 |
|--------|------|------|
| `scaffolding` | compose 시작 | 템플릿 clone + feature 복사 |
| `provisioning` | scaffold 완료 후 | Neon DB + GitHub repo 생성 |
| `deploying` | provisioning 완료 후 | Vercel 4개 프로젝트 배포 |
| `seeding` | deploying 완료 후 | DB migration + owner seed |
| `deployed` | 전체 완료 | 모든 단계 성공 |
| `error` | 어느 단계든 | 에러 발생 (error_message에 상세) |

---

## 데이터 흐름

### 1. 저장 경로

```
┌──────────────────────────┐     ┌──────────────────────────┐
│  Desktop Composer (UI)   │     │  CLI /compose            │
│                          │     │                          │
│  electronTrpc            │     │  composePipeline()       │
│  → atlas.composer.*      │     │  → onProjectSave cb      │
│  → apiTrpcClient         │     │  → HTTP API call          │
│    .composer.create/     │     │                          │
│    .composer.updateStatus│     │                          │
└──────────┬───────────────┘     └──────────┬───────────────┘
           │                                │
           │ HTTP POST /api/trpc            │ HTTP POST /api/trpc
           ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│  apps/api                                                │
│  └─ packages/trpc → composerRouter                       │
│     ├── create    → INSERT composer_projects             │
│     ├── update    → UPDATE composer_projects             │
│     ├── list      → SELECT * WHERE org_id = ?            │
│     ├── getById   → SELECT * WHERE id = ?                │
│     └── delete    → DELETE (+ Neon/Vercel cleanup)        │
│                                                          │
│  Neon PostgreSQL                                         │
│  └─ composer_projects 테이블                              │
└──────────────────────────────────────────────────────────┘
```

### 2. Desktop Composer 흐름

```
Step 0: Scaffold
  → apiTrpcClient.composer.create({ name, features, orgId })
  → 서버: INSERT status='scaffolding' → return projectId
  → composeMutation (electronTrpc, scaffold 실행)

Step 1: GitHub Push
  → pushToGitHub 완료 후
  → apiTrpcClient.composer.update({ id, status:'provisioning', githubRepoUrl })

Step 3: Neon
  → neonCreate 완료 후
  → apiTrpcClient.composer.update({ id, neonProjectId })

Step 4: Vercel
  → apiTrpcClient.composer.update({ id, status:'deploying', vercel* })
  → 배포 완료 후
  → apiTrpcClient.composer.update({ id, status:'deployed', vercelUrl })
```

### 3. CLI `/compose` 흐름

```
composePipeline({
  features, projectName, targetPath,
  callbacks: {
    onProjectSave: async (record) => {
      // HTTP API 호출로 Neon DB에 저장
      if (!projectId) {
        projectId = await api.composer.create(record);
      } else {
        await api.composer.update({ id: projectId, ...record });
      }
    }
  }
})
```

### 4. Deployments 페이지

```
// 기존 (local SQLite)
electronTrpc.atlas.deployments.list.useQuery()

// 변경 (Neon DB via API)
apiTrpc.composer.list.useQuery()
```

조직 내 모든 사용자가 같은 목록을 볼 수 있음.

---

## tRPC Router 구조

```
packages/trpc/src/router/composer/
├── composer.ts          — CRUD + 상태 업데이트 procedures
└── index.ts             — export

packages/trpc/src/root.ts
└── composer: composerRouter  (추가)
```

### Procedures

| Procedure | 타입 | Auth | 설명 |
|-----------|------|------|------|
| `create` | mutation | protected | 새 프로젝트 레코드 생성, ID 반환 |
| `update` | mutation | protected | status + 메타데이터 업데이트 |
| `list` | query | protected | 조직 내 프로젝트 목록 (최신순) |
| `getById` | query | protected | 단건 조회 |
| `delete` | mutation | protected | DB 삭제 (Neon/Vercel API cleanup은 선택) |

---

## 마이그레이션

```bash
# Neon 브랜치에서 마이그레이션 생성
bunx drizzle-kit generate --name="add_composer_projects"
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `packages/db/src/schema/composer.ts` | 테이블 정의 |
| `packages/db/src/schema/enums.ts` | status enum |
| `packages/trpc/src/router/composer/` | CRUD router |
| `packages/atlas-engine/src/pipeline/types.ts` | `onProjectSave` 콜백 |
| `packages/atlas-engine/src/pipeline/compose.ts` | 각 단계에서 콜백 호출 |
| `apps/desktop/src/renderer/lib/api-trpc-client.ts` | Desktop → API HTTP client |
| `apps/desktop/.../builder/deployments/page.tsx` | Deployments UI |
