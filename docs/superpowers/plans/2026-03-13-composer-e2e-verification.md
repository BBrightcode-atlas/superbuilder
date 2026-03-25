# Composer Scaffold Pipeline E2E Verification Plan

> **목표:** Electron Desktop Composer를 통해 프로젝트를 3회 순차 생성하며, 전체 파이프라인(Feature Selection → Scaffold → GitHub Push → Agent Install → Neon → Vercel)이 정상 동작하는지 검증한다.

**인증:** OAuth 로그인은 사용자가 직접 수행. Skip 금지.

---

## 환경 사전 조건

| 항목 | 값 | 상태 |
|------|-----|------|
| `SUPERBUILDER_PATH` | `/Users/bright/Projects/superbuilder` | .env에 설정됨 |
| `ATLAS_PATH` | `/Users/bright/Projects/feature-atlas` | .env에 설정됨 |
| Registry | `{ATLAS_PATH}/registry/features.json` | 존재 확인됨 |
| Template repo | `BBrightcode-atlas/superbuilder-app-template` | GitHub에 존재 |
| `gh` CLI | 인증 완료 | 확인 필요 |
| Neon API Key | encrypted in local-db 또는 env | 확인 필요 |
| Vercel Token | encrypted in local-db 또는 env | 확인 필요 |
| Desktop dev server | `bun dev` in `apps/desktop` | 실행 필요 |

---

## 파이프라인 단계 (각 실행 당)

### Step 1: Desktop 앱 접속 및 인증
- Electron 앱 실행 및 로그인 (OAuth — 사용자 직접)
- Atlas Composer 페이지 이동

### Step 2: Feature Selection (스텝 1/6)
- Registry에서 feature 목록 로딩 확인
- Feature 선택 (예: blog, auth)
- **검증:** feature 카드 표시, 선택 상태 반영

### Step 3: Dependency Resolution (스텝 2/6)
- 선택한 feature의 의존성 자동 해석
- auto-included features 표시 확인
- **검증:** resolved feature 목록에 의존성 포함

### Step 4: Project Config (스텝 3/6)
- 프로젝트 이름 입력 (예: `test-project-1`, `test-project-2`, `test-project-3`)
- DB provider: neon
- Auth provider: better-auth
- Deploy provider: vercel
- **검증:** config 값 정상 입력

### Step 5: Project Creation — Scaffold (스텝 4/6)
- Compose 버튼 클릭 → scaffold 파이프라인 실행
  1. Template Clone (`gh repo clone BBrightcode-atlas/superbuilder-app-template`)
  2. Spec Write (superbuilder.json)
  3. Workflow Write (INSTALL_FEATURES.md)
  4. Git Init (main branch, initial commit)
- **검증:**
  - 프로젝트 디렉토리 생성됨
  - `superbuilder.json` 존재 및 내용 정확
  - `INSTALL_FEATURES.md` 존재 및 feature 목록 포함
  - `.git` 초기화됨
  - 파이프라인 UI 상태 → done

### Step 6: GitHub Push (스텝 4/6 연속)
- GitHub Push 버튼 클릭
- `gh repo create BBrightcode-atlas/{project-name}` 실행
- **검증:**
  - GitHub 레포 생성됨
  - 코드 push됨
  - UI에 repo URL 표시

### Step 7: Agent Install (스텝 4/6 연속)
- Launch Agent 버튼 클릭
- Workspace 생성 → Claude Code 실행 with `/install-features`
- **검증:**
  - Claude Code 터미널 열림
  - `/install-features` 명령 전달
  - Agent가 feature 설치 시작 (결과는 비동기)

### Step 8: Neon Setup (스텝 5/6)
- Neon API key 입력 또는 기존 연결 확인
- Organization 선택
- Neon 프로젝트 생성
- `.env`에 `DATABASE_URL` 기록
- **검증:**
  - Neon 프로젝트 생성됨
  - `.env` 파일에 DATABASE_URL 존재
  - UI 완료 상태

### Step 9: Vercel Setup (스텝 6/6)
- Vercel token 입력 또는 기존 연결 확인
- Team/Personal 선택
- Vercel 프로젝트 생성 (GitHub 연결 포함)
- **검증:**
  - Vercel 프로젝트 생성됨
  - GitHub repo 연결됨
  - UI 완료 상태

---

## 3회 실행 매트릭스

| Run | 프로젝트 이름 | Feature 선택 | 예상 결과 |
|-----|--------------|-------------|----------|
| 1 | `e2e-test-1` | blog | auth + blog resolved |
| 2 | `e2e-test-2` | blog, community | auth + blog + community |
| 3 | `e2e-test-3` | auth (minimal) | auth only |

---

## 오류 대응 절차

1. 오류 발견 시 즉시 중단
2. 에러 로그/메시지 캡처
3. 코드 수정
4. 해당 실행 처음부터 재시작
5. 이전 성공한 실행은 유지

---

## 정리 (3회 완료 후)

- GitHub에 생성된 테스트 레포 목록 확인
- Neon에 생성된 테스트 프로젝트 확인
- Vercel에 생성된 테스트 프로젝트 확인
- (선택) 테스트 리소스 정리
