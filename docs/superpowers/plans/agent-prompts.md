# Feature Plugin System - 에이전트 실행 프롬프트

> 2개의 터미널에서 동시에 실행. 완전 병렬 가능 (서로 다른 레포, 의존성 없음).

---

## 실행 방법

```bash
# 터미널 1 — 에이전트 1 (Plan A+C: features 레포)
cd /Users/bright/Projects/superbuilder
claude -p "$(cat docs/superpowers/plans/agent-prompts.md | sed -n '/^## 에이전트 1 프롬프트$/,/^## 에이전트 2 프롬프트$/p' | head -n -1)"

# 터미널 2 — 에이전트 2 (Plan B: atlas-engine + boilerplate)
cd /Users/bright/Projects/superbuilder
claude -p "$(cat docs/superpowers/plans/agent-prompts.md | sed -n '/^## 에이전트 2 프롬프트$/,/^---$/p' | head -n -1)"
```

또는 아래 프롬프트를 각각 복사하여 `claude` 세션에 붙여넣기.

---

## 에이전트 1 프롬프트

```
당신은 Backstage-style Feature Plugin System의 에이전트 1입니다.
한글로만 응답하세요.

## 임무

superbuilder-features 레포를 새로 생성하고 (Plan A), 이어서 hello-world 파일럿 마이그레이션 (Plan C)을 완료합니다.

## 실행 순서

### Phase 1: Plan A 실행
- Plan 문서: docs/superpowers/plans/2026-03-14-plan-a-superbuilder-features-repo-bootstrap.md
- 설계 스펙: docs/superpowers/specs/2026-03-14-backstage-feature-plugin-system-design.md
- 작업 레포: superbuilder-features (새로 생성, GitHub org: bbright-code)
- 브랜치: main
- superpowers:executing-plans skill을 사용하여 Plan A의 Task 1-12를 순서대로 실행하세요.

### Phase 2: Plan C 실행 (Plan A 완료 후)
- Plan 문서: docs/superpowers/plans/2026-03-14-plan-c-hello-world-pilot-migration.md
- 작업 레포: superbuilder-features (features/hello-world/)
- 브랜치: main
- superpowers:executing-plans skill을 사용하여 Plan C의 Task 1-13을 순서대로 실행하세요.

## 완료 기준

1. superbuilder-features 레포가 GitHub에 push됨
2. core/* 6개 패키지 + dev-kit 스텁이 존재하고 bun install 성공
3. features/hello-world/ 패키지가 typecheck + test 통과
4. superbuilder 레포의 develop 브랜치에 submodule 포인터가 업데이트됨

## 품질 관리

모든 Task 완료 후, ralph-loop skill을 실행하여 5회 반복 검증하세요:
- 각 반복에서 typecheck, test, lint를 실행하고 실패하는 항목을 수정
- 코드 품질 개선 (불필요한 any 제거, 누락된 타입 추가, 테스트 커버리지 보완)
- 최종 반복에서 모든 검증이 통과해야 함

## 규칙

- superpowers:executing-plans skill을 반드시 사용할 것
- 각 Task 완료 시 커밋할 것 (conventional commits)
- 다른 레포 (superbuilder-app-template, superbuilder/packages/atlas-engine)는 절대 수정하지 않을 것
- Plan 문서에 명시된 코드를 정확히 따를 것
- 스펙 문서를 참조하여 의도를 이해할 것
```

## 에이전트 2 프롬프트

```
당신은 Backstage-style Feature Plugin System의 에이전트 2입니다.
한글로만 응답하세요.

## 임무

Atlas Engine에 feature.json 통합 모듈을 추가하고 (Plan B Task 1-15, 20-22), boilerplate에 [ATLAS:*] 마커를 삽입합니다 (Plan B Task 16-19).

## 실행 정보

- Plan 문서: docs/superpowers/plans/2026-03-14-plan-b-atlas-engine-feature-json-integration.md
- 설계 스펙: docs/superpowers/specs/2026-03-14-backstage-feature-plugin-system-design.md

### 작업 범위

| Task 범위 | 레포 | 디렉토리 | 브랜치 |
|-----------|------|----------|--------|
| Task 1-15 | superbuilder | packages/atlas-engine/ | develop |
| Task 16-19 | superbuilder-app-template | (루트) | main |
| Task 20-22 | superbuilder | packages/atlas-engine/ | develop |

## 실행 순서

superpowers:executing-plans skill을 사용하여 Plan B의 Task 1-22를 순서대로 실행하세요.

### 주의사항
- Task 1-15: superbuilder/packages/atlas-engine/ 에서 작업 (엔진 모듈)
- Task 16-19: superbuilder-app-template/ 로 이동하여 작업 (마커 삽입)
- Task 20-22: 다시 superbuilder/packages/atlas-engine/ 로 돌아와서 작업 (통합 테스트)
- 레포 전환 시 디렉토리 확인 필수

## 완료 기준

1. packages/atlas-engine에 6개 모듈 추가: scanner, adapter, deriver, transformer, applier, applyConnections
2. 모든 단위 테스트 통과 (scanner 7개, adapter 4개, deriver 10개, transformer 12개, applier 6개, applyConnections 5개)
3. superbuilder-app-template의 6개 파일에 [ATLAS:*] 마커 삽입
4. 통합 테스트 통과
5. packages/atlas-engine 배럴 export에 새 모듈 포함

## 품질 관리

모든 Task 완료 후, ralph-loop skill을 실행하여 5회 반복 검증하세요:
- 각 반복에서 typecheck, test, lint를 실행하고 실패하는 항목을 수정
- 코드 품질 개선 (불필요한 any 제거, 누락된 타입 추가, 테스트 커버리지 보완)
- edge case 테스트 추가 (빈 입력, 잘못된 형식, 경계값 등)
- 최종 반복에서 모든 검증이 통과해야 함

## 규칙

- superpowers:executing-plans skill을 반드시 사용할 것
- 각 Task 완료 시 커밋할 것 (conventional commits)
- superbuilder-features 레포는 절대 수정하지 않을 것
- Plan 문서에 명시된 코드를 정확히 따를 것 (특히 MARKER_MAP, STATIC_IMPORT_MAP)
- TDD: 테스트 먼저 작성 → 실패 확인 → 구현 → 통과 확인 순서
- 스펙 문서를 참조하여 의도를 이해할 것
```

---
