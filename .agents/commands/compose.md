---
description: 프로젝트 생성 파이프라인 — feature 선택 → scaffold → Neon DB → GitHub → Vercel 배포를 한 번에 실행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# compose: 프로젝트 생성 파이프라인

Desktop UI 없이 CLI에서 직접 프로젝트를 생성한다.
`@superbuilder/atlas-engine`의 `composePipeline()` 함수를 호출하여 8단계를 순차 실행.

## 사용법

### 대화형 모드 (인자 없음)

```
/compose
```

### 비대화형 모드 (인자 전달)

```
/compose --features blog,comment,payment --name my-app --path ~/Projects
/compose --config compose.json
```

## 대화형 흐름

### Step 1: Feature 목록 조회

`fetchRemoteManifest()`로 boilerplate의 superbuilder.json을 조회하여 사용 가능한 feature 목록을 가져온다.

### Step 2: Feature 선택

그룹별로 feature를 표시하고 사용자에게 선택을 요청한다:

```
사용 가능한 Features:

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

🤖 AI
  [ ] ai    [ ] ai-image    [ ] agent-desk

사용할 feature 이름을 입력하세요 (콤마 구분):
```

### Step 3: 의존성 확인

`resolveFeatures()`로 의존성을 해결하고 결과를 표시한다:

```
의존성 해결 결과:
  선택: blog, comment, payment
  자동 포함: profile, role-permission (core), reaction (blog 의존)
  총 6개 feature
```

### Step 4: 프로젝트 설정

프로젝트 이름, 저장 경로, 소유자 이메일을 질문한다:

```
프로젝트 이름: my-saas-app
저장 경로 (기본: ~/Projects):
소유자 이메일 (admin 접근용): admin@mycompany.com
```

### Step 5: 파이프라인 실행

`composePipeline()`을 호출한다. 모든 옵션을 true로 설정 (install: true 포함).

각 단계 진행 상황을 출력한다:

```
🚀 프로젝트 생성 중...
  ✅ 의존성 해결 (6개 feature)
  ✅ Scaffold 완료 (34개 feature 제거)
  ✅ Neon DB 생성
  ✅ GitHub repo 생성
  ✅ Vercel 배포
  ✅ .env 생성
  ✅ Feature 설치 완료
  ✅ 초기 시딩 완료
     System Org: org_xxxxxxxxxxxx
     Owner: admin@mycompany.com
     Password: changeme!! (초기 비밀번호 — 로그인 후 변경하세요)

프로젝트 준비 완료: ~/Projects/my-saas-app
Admin: https://my-saas-app.vercel.app/admin
```

## 비대화형 흐름

인자가 전달되면 질문 없이 바로 실행한다.

### CLI 인자 형식

| 인자 | 설명 | 필수 |
|------|------|------|
| `--features` | 콤마 구분 feature 이름 | 필수 |
| `--name` | 프로젝트 이름 | 필수 |
| `--path` | 저장 경로 (기본: ~/Projects) | 선택 |
| `--email` | 소유자 이메일 (기본: admin@superbuilder.app) | 선택 |
| `--no-neon` | Neon DB 생성 건너뛰기 | 선택 |
| `--no-github` | GitHub push 건너뛰기 | 선택 |
| `--no-vercel` | Vercel 배포 건너뛰기 | 선택 |
| `--no-install` | Feature 설치 건너뛰기 | 선택 |
| `--config` | JSON config 파일 경로 | 선택 |

### compose.json 형식

```json
{
  "features": ["blog", "comment", "payment"],
  "projectName": "my-saas-app",
  "targetPath": "~/Projects",
  "options": {
    "neon": true,
    "github": true,
    "vercel": true,
    "install": true,
    "ownerEmail": "admin@mycompany.com"
  }
}
```

## 환경변수 요구사항

| 변수 | 용도 | 필요 시점 |
|------|------|----------|
| `NEON_API_KEY` | Neon DB 프로젝트 생성 | `--no-neon` 미사용 시 |
| `GITHUB_TOKEN` | gh CLI 인증 (자동) | `--no-github` 미사용 시 |
| `VERCEL_TOKEN` | Vercel API 인증 | `--no-vercel` 미사용 시 |
| `NEON_ORG_ID` | Neon organization (선택) | Neon org 사용 시 |

## 에러 대응

| 에러 | 원인 | 해결 |
|------|------|------|
| scaffold 실패 | boilerplate repo 접근 불가 | `gh auth status` 확인, `gh auth login` 실행 |
| Neon 실패 | API key 없거나 잘못됨 | `NEON_API_KEY` 환경변수 확인 |
| GitHub 실패 | 인증 또는 권한 문제 | `gh auth status` 확인 |
| Vercel 실패 | 토큰 없거나 만료 | `VERCEL_TOKEN` 환경변수 확인 |
| install 실패 | 의존성 문제 | 프로젝트에서 수동 `bun install` 실행 |
| seed 실패 | DB 연결 문제 | `.env`의 `DATABASE_URL` 확인, 서버 실행 후 수동 가입 |

## 기술 참조

- 파이프라인 함수: `@superbuilder/atlas-engine`의 `composePipeline()`
- 스펙: `docs/superpowers/specs/2026-03-15-headless-compose-pipeline-design.md`
- 파이프라인 문서: `docs/architecture/subsystems/composer-scaffold-pipeline.md`

$ARGUMENTS
