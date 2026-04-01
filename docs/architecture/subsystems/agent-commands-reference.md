# Agent Commands & Skills 레퍼런스

> `.agents/commands/` 디렉토리의 모든 슬래시 커맨드 목록과 용도.
> Claude Code, Codex, Cursor 등에서 `/커맨드명`으로 실행 가능.

---

## 핵심 파이프라인

| 커맨드 | 설명 | 주요 함수 |
|--------|------|----------|
| `/superbuilder-compose` | **프로젝트 생성 파이프라인** — feature 선택 → scaffold → Neon DB → GitHub → Vercel 배포를 한 번에 실행 | `composePipeline()` |
| `/superbuilder-compose-e2e-test` | Composer E2E 테스트 — feature 선택부터 Vercel 배포 + 로그인 성공까지 전체 파이프라인 검증 | `composePipeline()` |

### `/superbuilder-compose` 상세

Desktop UI 없이 CLI에서 직접 프로젝트를 생성한다. `@superbuilder/atlas-engine`의 `composePipeline()` 8단계를 순차 실행.

**대화형 모드:**
```
/superbuilder-compose
```

**비대화형 모드:**
```
/superbuilder-compose --features blog,comment,payment --name my-app --path ~/Projects
/superbuilder-compose --config superbuilder-compose.json
```

**8단계 파이프라인:**
1. **resolve** — feature 의존성 해결
2. **scaffold** — 빈 템플릿 clone → feature 복사 → import 변환 → connection 삽입
3. **neon** — Neon DB 프로젝트 생성
4. **github** — GitHub repo 생성 + push
5. **vercel** — app + server + admin + landing 4개 Vercel 프로젝트 배포
6. **env** — .env 파일 생성 (DATABASE_URL, BETTER_AUTH_SECRET 등)
7. **dbMigrate** — `pnpm exec drizzle-kit push --force`
8. **seed** — owner 사용자 + organization 생성

**필수 환경변수:** `NEON_API_KEY`, `VERCEL_TOKEN`, `gh` CLI 인증

**상세 스펙:** `docs/superpowers/specs/2026-03-15-headless-compose-pipeline-design.md`
**파이프라인 문서:** `docs/architecture/subsystems/composer-scaffold-pipeline.md`

---

## Feature 라이프사이클

| 커맨드 | 설명 |
|--------|------|
| `/superbuilder-feature-scaffold` | 새 feature 패키지를 처음부터 생성 (scaffold) |
| `/superbuilder-feature-dev` | Feature 개발 파이프라인 — spec → plan → worktree → 구현 → 검증 → 등록 |
| `/superbuilder-feature-verify` | Feature Dev E2E 검증 — 전체 파이프라인 자동 실행 + 체크포인트 검증 |
| `/superbuilder-feature-validate` | Feature 패키지의 정합성을 종합 검증 |
| `/superbuilder-feature-migrate` | Feature를 boilerplate에서 superbuilder-features로 마이그레이션 |

---

## Boilerplate 관리

| 커맨드 | 설명 |
|--------|------|
| `/superbuilder-boilerplate-sync` | Boilerplate의 마커 상태를 확인하고 feature를 수동으로 등록/제거 |
| `/superbuilder-boilerplate-stabilize` | Boilerplate 서버 Vercel 배포 안정화 — NestJS serverless 호환성 수정 + 배포 검증 |

---

## Cross-Repo & Upstream

| 커맨드 | 설명 |
|--------|------|
| `/superbuilder-cross-repo-check` | superbuilder, superbuilder-features, superbuilder-app-template 3개 repo 간 정합성 검증 |
| `/superbuilder-sync-upstream` | superset upstream 변경을 develop 브랜치에 안전하게 병합 (superbuilder 커스텀 보존) |

---

## 팀 조직

| 커맨드 | 설명 |
|--------|------|
| `/superbuilder-tech-lead` | Tech Lead — 아키텍처 결정, ADR, 팀 간 정렬 |
| `/superbuilder-desktop-team` | Desktop Team — Electron UI, 렌더러, tRPC 라우터 |
| `/superbuilder-engine-team` | Engine Team — atlas-engine, compose pipeline, 배포 |
| `/superbuilder-ecosystem-team` | Ecosystem Team — features, template, 크로스레포 정합성 |

각 팀은 Design / Build / Quality 디비전 + SENTINEL(Codex 독립 검증) 구조.
상세: `docs/superpowers/specs/2026-04-01-team-organization-design.md`

---

## 코드 품질 & CI

| 커맨드 | 설명 |
|--------|------|
| `/ci-check` | lint:fix, typecheck, test, sherif 실행하여 push 전 프로젝트 검증 |
| `/superbuilder-spec-verify` | 스펙 문서 대비 구현 완전성 검증 — 누락된 함수/타입/필드/에러 처리 자동 감지 + 수정 |
| `/deslop` | 불필요한 주석 제거, 코드 단순화 (clean code) |

---

## PR & 리뷰

| 커맨드 | 설명 |
|--------|------|
| `/create-pr` | PR 생성 |
| `/respond-to-pr-comments` | PR 리뷰 코멘트를 가져와서 우선순위별로 처리 |

---

## 작업 관리

| 커맨드 | 설명 |
|--------|------|
| `/task` | Superset MCP를 통해 태스크 생성 + 할당 |
| `/task-run` | 태스크 + 워크스페이스 생성 후 AI agent 세션 시작 |
| `/create-plan` | Superset Execution Plan 생성 |

---

## 인프라

| 커맨드 | 설명 |
|--------|------|
| `/superbuilder-clean-neon-branches` | 오늘 이전에 생성된 Neon DB 브랜치 삭제 (프로덕션 보존) |

---

## 커맨드 vs 스킬

| 구분 | 위치 | 호출 방식 | 용도 |
|------|------|----------|------|
| **커맨드** | `.agents/commands/` | `/커맨드명` | 특정 워크플로우 실행 (대화형/비대화형) |
| **스킬** | `.agents/skills/` 또는 Superpowers plugin | 자동 감지 또는 명시 호출 | 작업 방식/프로세스 가이드 |

주요 Superpowers 스킬:
- `brainstorming` — 아이디어 → 설계 스펙
- `writing-plans` — 스펙 → 구현 계획
- `subagent-driven-development` — 계획 → 서브에이전트 병렬 실행
- `executing-plans` — 계획 → 순차 실행
- `test-driven-development` — TDD 사이클
- `systematic-debugging` — 체계적 디버깅
- `finishing-a-development-branch` — 브랜치 마무리 (merge/PR)
