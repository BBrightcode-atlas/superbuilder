---
description: Sync superset upstream changes into develop branch safely, preserving superbuilder customizations
allowed-tools: Bash, Read, Grep, Glob, Agent
---

# Upstream Sync: superset → superbuilder

Sync the latest changes from the superset upstream (`upstream/main`) into the superbuilder `develop` branch.

## Branch Structure

```
upstream (superset-sh/superset)
  └── main ←── main_superset (tracking upstream/main)

origin (BBrightcode-atlas/superbuilder)
  ├── main ←── develop와 동일 (superbuilder의 안정 브랜치)
  └── develop ←── 작업 브랜치
```

| 브랜치 | 추적 대상 | 역할 |
|--------|----------|------|
| `main_superset` | `upstream/main` | superset 원본 추적 전용 |
| `main` | `origin/main` | superbuilder 안정 브랜치 (develop에서 머지) |
| `develop` | `origin/develop` | superbuilder 작업 브랜치 |

## Prerequisites

- Remote `upstream` must point to `https://github.com/superset-sh/superset.git`
- Remote `origin` must point to `https://github.com/BBrightcode-atlas/superbuilder.git`
- Current branch should be `develop` (or will switch to it)

## Procedure

### Step 1: Fetch upstream and update main_superset

```bash
git fetch upstream main
git checkout main_superset
git merge upstream/main --ff-only
git push origin main_superset
```

If `--ff-only` fails, STOP and alert the user — main_superset should never diverge from upstream.

### Step 2: Create sync branch from develop

```bash
git checkout develop
git checkout -b sync/upstream-$(date +%Y%m%d)
```

### Step 3: Merge main_superset into sync branch

```bash
git merge main_superset
```

### Step 4: Resolve conflicts

Apply these conflict resolution rules **in order of priority**:

| File/Pattern | Resolution | Reason |
|---|---|---|
| `.env*` | **Keep develop (ours)** | superbuilder 환경 설정 유지 |
| `bun.lock` | **Regenerate** — accept either, then run `bun install` | 자동 생성 파일 |
| `.superbuilder/**` | **Keep develop (ours)** | superbuilder 전용 설정 |
| `.agents/**` | **Keep develop (ours)** | superbuilder 에이전트 스킬 |
| `packages/atlas-engine/**` | **Keep develop (ours)** | superbuilder 전용 패키지 |
| `docs/architecture/**` | **Keep develop (ours)** | superbuilder 아키텍처 문서 |
| `docs/superpowers/**` | **Keep develop (ours)** | superbuilder 스펙/계획 |
| `AGENTS.md`, `CLAUDE.md` | **Keep develop (ours)** | superbuilder 에이전트 설정 |
| `apps/desktop/package.json` | **Merge carefully** — accept upstream version bumps but keep superbuilder additions |
| `package.json` (root) | **Merge carefully** — accept upstream deps but keep superbuilder workspace entries |
| `turbo.json` | **Merge carefully** — accept upstream changes but keep superbuilder task entries |
| Everything else | **Accept upstream (theirs)** — bug fixes, features from superset |

For each conflict:
1. Read the conflicted file
2. Apply the resolution rule above
3. `git add <file>`

After all conflicts resolved:
```bash
git commit  # merge commit
```

### Step 5: Regenerate lock file if needed

```bash
bun install
git add bun.lock
git commit -m "chore: regenerate bun.lock after upstream sync"
```

### Step 6: Quick validation

Run a quick typecheck to catch obvious breakage:
```bash
bun run typecheck
```

If typecheck fails, investigate and fix — these are likely import path or naming conflicts.

### Step 7: Merge to develop + push

```bash
git checkout develop
git merge sync/upstream-$(date +%Y%m%d)
git push origin develop
```

### Step 8: Report

Print a summary:
- Number of upstream commits merged
- Number of conflicts resolved (list files)
- Typecheck result
- develop push 완료 여부

## Conflict Resolution Tips

- If a file was **added by both branches** (e.g., both added a new config), keep both unless they conflict semantically
- If upstream **renamed/moved a file** that develop also modified, follow upstream's structure but keep develop's content changes
- If upstream **deleted a file** that develop modified, keep develop's version (superbuilder may still need it)
- When in doubt, **keep develop (ours)** — superbuilder customizations take priority over upstream defaults

## Post-sync

After sync is merged to develop, consider running `/ci-check` to validate everything.

**주의**: `main` 브랜치는 수정하지 않는다. `main`은 develop에서 PR/머지로만 업데이트.

$ARGUMENTS
