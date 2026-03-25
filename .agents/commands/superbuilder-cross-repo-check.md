---
description: superbuilder, superbuilder-features, superbuilder-app-template 3개 repo 간 정합성 검증
allowed-tools: Bash, Read, Edit, Glob, Grep
---

3개 레포(`superbuilder`, `superbuilder-features`, `superbuilder-app-template`) 간의 정합성을 종합 검증한다.

## 1. Repo 존재 확인

다음 3개 레포가 로컬에 존재하는지 확인한다. 기본 검색 경로는 `~/Projects/`이다.

| 레포 | 기본 경로 |
|---|---|
| superbuilder | `~/Projects/superbuilder` |
| superbuilder-features | `~/Projects/superbuilder-features` |
| superbuilder-app-template | `~/Projects/superbuilder-app-template` |

존재하지 않는 레포가 있으면 경고를 출력하고, 해당 레포 관련 검증은 SKIP 처리한다.

## 2. Submodule 상태

superbuilder 레포의 `features/` 서브모듈이 superbuilder-features 레포와 올바르게 연결되어 있는지 확인한다.

- `git submodule status` 실행
- 서브모듈 커밋이 superbuilder-features의 현재 HEAD와 일치하는지 비교
- 불일치 시 `git submodule update` 안내

## 3. Feature 카탈로그 일치

두 소스 간의 feature 목록을 비교한다:

### 소스 A: superbuilder-features
```bash
# features/*/feature.json 스캔
ls features/*/feature.json
```
각 `feature.json`에서 `id`, `version`, `type`, `group`을 추출한다.

### 소스 B: superbuilder-app-template
```bash
# superbuilder.json의 features 배열
cat superbuilder.json
```

### 비교 출력

| Feature | features repo | boilerplate | 상태 |
|---|---|---|---|
| blog | v0.3.0 | v0.3.0 | MATCH |
| payment | v0.2.0 | v0.1.0 | VERSION_MISMATCH |
| hello-world | v0.1.0 | - | ONLY_IN_FEATURES |
| legacy-auth | - | v0.5.0 | ONLY_IN_BOILERPLATE |

## 4. Core Contract 일치

superbuilder-features의 core 패키지와 boilerplate의 core 인터페이스가 호환되는지 확인한다.

### 확인 항목

1. **core 패키지 목록 비교**:
   - `superbuilder-features/core/*/package.json` 스캔 → 패키지명 목록
   - boilerplate의 `packages/core/` (또는 해당 경로) 스캔 → 패키지명 목록
   - 누락/추가 패키지 표시

2. **Export 호환성** (주요 패키지만):
   - `core-auth`: `createAuth`, `AuthProvider` 등 핵심 export 존재 확인
   - `core-db`: `db`, `schema` 등 핵심 export 존재 확인
   - `core-ui`: `Button`, `Input` 등 기본 UI 컴포넌트 존재 확인

## 5. Import 변환 규칙 검증

`atlas-engine`의 import 변환 규칙이 실제 패키지와 일치하는지 확인한다.

1. `packages/atlas-engine/`에서 `STATIC_IMPORT_MAP` 또는 import 변환 관련 설정을 찾는다
2. 설정에 정의된 모든 `@superbuilder/core-*` 패키지가 `superbuilder-features/core/`에 실제로 존재하는지 확인
3. 누락된 매핑이 있으면 WARN 표시

## 6. Workspace 설정 검증

모노레포 설정이 올바른지 확인한다.

### superbuilder root package.json
- `workspaces` 필드에 `features/*`가 포함되는지 (서브모듈 사용 시)

### turbo.json
- pipeline에 feature 패키지의 build/typecheck/test 태스크가 포함되는지

### bun workspace 설정
- `bun install`이 feature 패키지를 올바르게 해석하는지

## 결과 출력

각 섹션별로 상태를 표시한다:

```
=== Cross-Repo Consistency Check ===

1. Repo 존재 확인
   [PASS] superbuilder — ~/Projects/superbuilder
   [PASS] superbuilder-features — ~/Projects/superbuilder-features
   [PASS] superbuilder-app-template — ~/Projects/superbuilder-app-template

2. Submodule 상태
   [WARN] features/ 서브모듈이 2 커밋 뒤처져 있음

3. Feature 카탈로그 일치
   [FAIL] 3개 불일치 발견 (상세 테이블 참조)

4. Core Contract 일치
   [PASS] 모든 core 패키지 호환

5. Import 변환 규칙
   [WARN] @superbuilder/core-cache 매핑 있으나 패키지 미존재

6. Workspace 설정
   [PASS] 모든 설정 정상

=== 총 결과: 1 FAIL / 2 WARN / 3 PASS ===
```

$ARGUMENTS
