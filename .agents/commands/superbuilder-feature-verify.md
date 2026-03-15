---
description: Feature Dev 파이프라인 E2E 검증 — 전체 파이프라인 자동 실행 + 체크포인트 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-verify: Feature Dev E2E 검증

## 개요

feature dev 파이프라인의 전체 흐름을 검증한다.
**현재 agent가 직접** spec/plan/코드를 작성하고, 파이프라인은 인프라(worktree, git, typecheck)만 담당한다.
**통과할 때까지 반복한다.**

## 테스트 설정

| 항목 | 값 |
|------|-----|
| Feature 이름 | `e2e-verify-{timestamp}` |
| 프롬프트 | 간단한 hello API + React 페이지 |
| Boilerplate | `$BOILERPLATE_PATH` 또는 `~/Projects/superbuilder-app-boilerplate` |
| 승인 게이트 | false (자동) |
| 등록 | 건너뛰기 (skipRegister: true) |

## 사전 조건

```bash
cd /Users/bbright/Projects/superbuilder
bun run typecheck --filter=@superbuilder/atlas-engine

BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
ls "$BOILERPLATE/superbuilder.json"
git -C "$BOILERPLATE" status --short  # 비어있어야 함
```

## 실행 절차

### Step 1: Worktree 생성

```bash
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
FEATURE_NAME="e2e-verify-$(date +%s)"
WORKTREE="$HOME/.superbuilder/worktrees/$FEATURE_NAME"

mkdir -p "$HOME/.superbuilder/worktrees"
git -C "$BOILERPLATE" worktree add "$WORKTREE" -b "feature/$FEATURE_NAME"
```

### Step 2: Spec 작성 (agent가 직접)

boilerplate의 기존 feature 구조를 파악하고, 간단한 hello 기능의 spec을 작성:

- Feature 이름, 설명
- GET /api/hello 엔드포인트 (NestJS)
- HelloPage React 페이지
- feature.json manifest

### Step 3: Plan 작성 (agent가 직접)

spec 기반으로 구현 계획:
- 정확한 파일 경로
- 각 파일의 코드 내용
- marker 삽입 위치

### Step 4: 구현 (agent가 직접)

worktree에서 Write/Edit 도구로 코드 작성:
1. `packages/features/{name}/` 디렉토리 생성
2. 서버 코드, 클라이언트 코드
3. `feature.json`
4. marker 블록에 connection 삽입
5. `git add -A && git commit`

### Step 5: 검증

```bash
cd $WORKTREE && bun run typecheck
cd $WORKTREE && bun run lint
```

### Step 6: 체크포인트 검증

| # | 체크포인트 | 검증 커맨드 | 통과 기준 |
|---|-----------|-----------|----------|
| 1 | worktree | `ls $WORKTREE/package.json` | 존재 |
| 2 | feature 디렉토리 | `ls $WORKTREE/packages/features/$FEATURE_NAME/` | 존재 |
| 3 | feature.json | `cat $WORKTREE/packages/features/$FEATURE_NAME/feature.json` | 유효한 JSON |
| 4 | 서버 코드 | `ls $WORKTREE/packages/features/$FEATURE_NAME/src/server/` | .ts 파일 |
| 5 | typecheck | `cd $WORKTREE && bun run typecheck` | 에러 없음 |
| 6 | lint | `cd $WORKTREE && bun run lint` | 에러 없음 |
| 7 | git commits | `git -C $WORKTREE log --oneline` | 1개 이상 |

**하나라도 실패하면 수정 → 재검증 반복.**

### Step 7: Cleanup

```bash
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
git -C "$BOILERPLATE" worktree remove "$WORKTREE" --force 2>/dev/null || true
git -C "$BOILERPLATE" branch -D "feature/$FEATURE_NAME" 2>/dev/null || true
```

## 실패 시 대응

| 실패 단계 | 확인 사항 |
|----------|----------|
| worktree | boilerplate에 uncommitted changes 확인 |
| feature 디렉토리 | agent가 올바른 경로에 파일 생성했는지 |
| feature.json | 필수 필드(id, name, provides) 확인 |
| typecheck | 에러 메시지 분석, import 경로 확인 |

## 기술 참조

- 파이프라인: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 스펙: `docs/superpowers/specs/2026-03-15-feature-dev-pipeline-design.md`

$ARGUMENTS
