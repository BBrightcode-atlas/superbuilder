# Upstream Sync Strategy: superset → superbuilder

**Date**: 2026-03-13
**Status**: Active

## Context

superbuilder는 superset(`superset-sh/superset`)의 fork이다. superset의 버그 수정과 기능 추가를 지속적으로 받아오면서, superbuilder 자체 커스텀 작업(atlas engine, feature studio, 아키텍처 변경 등)을 유지해야 한다.

### Branch Model

| Branch | Role | Updates |
|--------|------|---------|
| `main` | superset upstream mirror | `upstream/main` fast-forward only |
| `develop` | superbuilder development | All PRs target here |
| `sync/upstream-YYYYMMDD` | Temporary merge branch | Created per sync, deleted after PR merge |

### Remotes

| Remote | URL |
|--------|-----|
| `origin` | `github.com/BBrightcode-atlas/superbuilder.git` |
| `upstream` | `github.com/superset-sh/superset.git` |

## Sync Procedure

1. **Fetch + fast-forward main**: `git fetch upstream main` → `git checkout main` → `git merge upstream/main --ff-only` → `git push origin main`
2. **Branch from develop**: `git checkout develop` → `git checkout -b sync/upstream-YYYYMMDD`
3. **Merge main into sync**: `git merge main`
4. **Resolve conflicts** per priority rules (see below)
5. **Regenerate lockfile**: `bun install` → commit `bun.lock`
6. **Typecheck**: `bun run typecheck`
7. **PR to develop**: `gh pr create --base develop`

## Conflict Resolution Priority

### Always keep develop (ours)

- `.env*` — superbuilder 환경 설정
- `.superbuilder/**` — superbuilder 전용 설정
- `AGENTS.md`, `CLAUDE.md` — 에이전트 설정
- `packages/atlas-engine/**` — superbuilder 전용
- `packages/features-*/**` — superbuilder 전용
- `packages/widgets/**` — superbuilder 전용
- `packages/drizzle/**` — superbuilder 전용
- `apps/features-*/**` — superbuilder 전용
- `apps/feature-admin/**` — superbuilder 전용
- `apps/agent-server/**` — superbuilder 전용
- `docs/architecture/**` — superbuilder 문서

### Merge carefully (both sides matter)

- `apps/desktop/package.json` — upstream version bumps + superbuilder additions
- `package.json` (root) — upstream deps + superbuilder workspace entries
- `turbo.json` — upstream tasks + superbuilder tasks
- `bun.lock` — regenerate via `bun install`

### Accept upstream (theirs)

- Everything else: bug fixes, features, desktop improvements from superset

## Frequency

주기적으로 (1~2주 간격 권장) `/sync-upstream` 스킬로 실행.

## Skill

`/sync-upstream` — `.agents/commands/sync-upstream.md`에 정의된 자동화 스킬.
