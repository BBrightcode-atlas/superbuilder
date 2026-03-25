---
description: Boilerplate의 마커 상태를 확인하고 feature를 수동으로 등록/제거
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

Boilerplate 레포의 `[ATLAS:*]` 마커 상태를 확인하고, feature를 수동으로 등록하거나 제거한다.

## 입력

`$ARGUMENTS`에서 모드와 feature 이름을 추출한다:

- **모드 없음** 또는 `status`: 마커 상태만 확인
- `register {name}`: feature 등록
- `remove {name}`: feature 제거

## 1. 마커 상태 확인

boilerplate 레포(`superbuilder-app-template`)의 모든 소스 파일에서 `[ATLAS:*]` 마커 블록을 스캔한다.

### 스캔 대상 마커

```
[ATLAS:IMPORTS] / [/ATLAS:IMPORTS]
[ATLAS:MODULES] / [/ATLAS:MODULES]
[ATLAS:ROUTES] / [/ATLAS:ROUTES]
[ATLAS:PROVIDERS] / [/ATLAS:PROVIDERS]
[ATLAS:SCHEMA] / [/ATLAS:SCHEMA]
[ATLAS:ADMIN_IMPORTS] / [/ATLAS:ADMIN_IMPORTS]
[ATLAS:ADMIN_ROUTES] / [/ATLAS:ADMIN_ROUTES]
```

### 스캔 방법

1. boilerplate 전체에서 `\[ATLAS:` 패턴을 grep하여 마커 파일 목록을 구한다
2. 각 마커 파일을 읽고 블록 내용을 파싱한다
3. 블록 내용에서 feature 이름을 추출한다 (import 경로, 모듈 이름 등에서)

### 출력

feature별 등록 상태를 매트릭스로 출력한다:

| Feature | IMPORTS | MODULES | ROUTES | SCHEMA | ADMIN_IMPORTS | ADMIN_ROUTES |
|---|---|---|---|---|---|---|
| blog | O | O | O | O | O | O |
| payment | O | O | O | O | X | X |
| hello-world | O | O | X | X | X | X |

- `O`: 해당 마커에 등록됨
- `X`: 해당 마커에 미등록

또한 `superbuilder.json`의 features 목록과 실제 마커 등록 상태를 비교하여 불일치를 표시한다.

## 2. Feature 등록 (수동)

`register {name}` 모드일 때 실행한다.

### 사전 조건
- `superbuilder-features/features/{name}/feature.json` 존재 확인
- 이미 등록되어 있는지 확인 (중복 방지)

### 등록 절차

1. **feature.json 읽기**: `provides` 필드에서 어떤 마커에 삽입해야 하는지 결정한다

2. **마커 삽입**: 각 마커 파일의 닫는 태그 (`[/ATLAS:*]`) 바로 앞에 코드를 삽입한다

   ```typescript
   // [ATLAS:IMPORTS]
   // ... 기존 내용 ...
   import { {Name}Module } from "@repo/features/{name}";  // ← 삽입
   // [/ATLAS:IMPORTS]
   ```

3. **superbuilder.json 업데이트**: features 배열에 feature 메타데이터를 추가한다

4. **feature 소스 복사**: `superbuilder-features/features/{name}/src/` 내용을 boilerplate의 적절한 위치로 복사한다
   - `src/server/` → `packages/features/{name}/`
   - `src/client/` → `apps/app/src/features/{name}/`
   - `src/admin/` → `apps/system-admin/src/features/{name}/`
   - `src/schema/` → `packages/drizzle/src/schema/features/{name}/`

5. **검증**: `bun run typecheck`로 타입 체크 통과 확인

## 3. Feature 제거 (수동)

`remove {name}` 모드일 때 실행한다.

### 사전 조건
- 해당 feature가 등록되어 있는지 확인
- **역의존성 확인**: 이 feature에 의존하는 다른 feature가 있는지 확인
  - 있으면 경고를 출력하고 사용자에게 확인을 구한다
  - 강제 제거 시 의존하는 feature도 함께 제거 (cascade)

### 제거 절차

1. **마커 내용 제거**: 각 마커 블록에서 해당 feature 관련 줄을 정확히 매칭하여 삭제한다

   ```typescript
   // 제거 대상: {name} 관련 import/module/route 줄
   ```

2. **코드 디렉토리 삭제**:
   - `packages/features/{name}/`
   - `apps/app/src/features/{name}/`
   - `apps/system-admin/src/features/{name}/`
   - `packages/drizzle/src/schema/features/{name}/`

3. **superbuilder.json 업데이트**: features 배열에서 해당 feature 제거

4. **검증**: `bun run typecheck`로 타입 체크 통과 확인

## 4. 정합성 검증

마커 상태 확인 후 추가로 다음을 검증한다:

1. **superbuilder.json ↔ 마커 일치**: superbuilder.json에 있는 feature가 모든 필요한 마커에 등록되어 있는지
2. **마커 ↔ 디렉토리 일치**: 마커에 등록된 feature의 소스 디렉토리가 실제로 존재하는지
3. **고아 마커**: 마커에는 있지만 superbuilder.json에 없는 feature 항목

불일치가 발견되면 상세 목록과 수정 제안을 출력한다.

$ARGUMENTS
