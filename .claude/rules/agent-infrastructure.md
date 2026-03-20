# Agent Infrastructure Rules

## CLI 에이전트 직접 spawn 금지

`child_process.spawn("claude", ...)`, `spawn("codex", ...)` 등 CLI 에이전트를 직접 프로세스로 실행하지 않는다. 반드시 기존 에이전트 세션 인프라를 사용한다.

## 에이전트 실행 인프라 개요

```
launchAgentSession(request, context)           // renderer 오케스트레이터
  → launchTerminalAdapter(request, context)    // kind: "terminal"
    → launchCommandInPane(opts)
      → terminal.createOrAttach()              // PTY 세션 생성 (main process)
      → terminal.write()                       // 명령어 전송

terminal.stream subscription (observable)       // 실시간 출력 수신
  → { type: "data", data: string }
  → { type: "exit", exitCode, signal?, reason? }
  → { type: "disconnect", reason }
  → { type: "error", error, code? }
```

## 핵심 파일

### 오케스트레이션 (Renderer)
- `apps/desktop/src/renderer/lib/agent-session-orchestrator/agent-session-orchestrator.ts`
  - `launchAgentSession(request, context)` — 메인 진입점
  - `queueAgentSessionLaunch(input)` — 워크스페이스 로드 후 실행
- `apps/desktop/src/renderer/lib/agent-session-orchestrator/adapters/terminal-adapter.ts`
  - `launchTerminalAdapter()` — terminal pane 생성 + 명령어 실행
- `apps/desktop/src/renderer/lib/agent-session-orchestrator/adapters/chat-adapter.ts`
  - `launchChatAdapter()` — HTTP chat 세션 생성

### 타입 (Shared)
- `packages/shared/src/agent-launch.ts`
  - `AgentLaunchRequest` (discriminated union: `kind: "terminal" | "chat"`)
  - `normalizeAgentLaunchRequest()` — legacy/canonical 포맷 통합
  - 지원 에이전트: `claude`, `codex`, `gemini`, `opencode`, `cursor-agent`, `superset-chat`
- `apps/desktop/src/renderer/lib/agent-session-orchestrator/types.ts`
  - `AgentSessionLaunchContext` — createOrAttach, write, tabs adapter 포함

### 터미널 세션 (Main Process)
- `apps/desktop/src/lib/trpc/routers/terminal/terminal.ts`
  - `createOrAttach` — PTY 생성, 환경변수 설정, taskPromptContent 파일 저장
  - `write` — PTY에 데이터 전송
  - `stream` — observable subscription (실시간 출력)
  - `signal` — SIGTERM 등 시그널 전송
  - `kill` — 세션 종료
- `apps/desktop/src/main/terminal-host/terminal-host.ts` — 세션 라이프사이클
- `apps/desktop/src/main/terminal-host/session.ts` — PTY 프로세스 관리

### 스트림 소비 (Renderer)
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/Terminal/Terminal.tsx`
  - `electronTrpc.terminal.stream.useSubscription(paneId, { onData })`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/Terminal/hooks/useTerminalStream.ts`
  - 이벤트 라우팅, 버퍼링, xterm.js 연동

### 커맨드 실행 유틸
- `apps/desktop/src/renderer/lib/terminal/launch-command.ts`
  - `launchCommandInPane()` — createOrAttach + write 조합
  - `writeCommandInPane()` — 단일 명령어 전송

## 사용 패턴

### Terminal 에이전트 실행 (표준)
```ts
import { launchAgentSession } from "renderer/lib/agent-session-orchestrator/agent-session-orchestrator";

const result = await launchAgentSession({
  kind: "terminal",
  workspaceId,
  agentType: "claude",
  terminal: {
    command: "claude --dangerously-skip-permissions -p .superset/prompt.md",
    name: "UI Generation",
    taskPromptContent: promptText,      // .superset/ 디렉토리에 파일로 저장됨
    taskPromptFileName: "prompt.md",
  },
}, context);
```

### 직접 터미널 API 사용 (커스텀 시나리오)
```ts
// 1. 세션 생성
await electronTrpc.terminal.createOrAttach.mutate({
  paneId, tabId, workspaceId,
  taskPromptContent: prompt,
  taskPromptFileName: "task.md",
});

// 2. 명령어 실행
await electronTrpc.terminal.write.mutate({
  paneId,
  data: "claude -p .superset/task.md\n",
});

// 3. 스트림 구독
electronTrpc.terminal.stream.useSubscription(paneId, {
  onData: (event) => {
    if (event.type === "data") { /* PTY 출력 */ }
    if (event.type === "exit") { /* 프로세스 종료 */ }
  },
});

// 4. 중단
await electronTrpc.terminal.signal.mutate({ paneId, signal: "SIGTERM" });
```

### Chat 에이전트 실행
```ts
const result = await launchAgentSession({
  kind: "chat",
  workspaceId,
  agentType: "superset-chat",
  chat: {
    initialPrompt: "요청 텍스트",
    model: "claude-sonnet-4-6",
  },
}, context);
```

## 제약사항

- **trpc-electron은 observable만 지원** — async generator 사용 불가
- `terminal.stream`은 raw PTY 바이트 출력 — ANSI escape 코드 포함
- `emit.complete()` 호출 금지 — paneId 재사용 시 리스너 격리 문제
- 프로세스 실행 시 `CLAUDECODE`, `CLAUDE_CODE_SESSION` 환경변수는 agent-setup에서 자동 처리됨
- 세션 생성 시 `taskPromptContent`는 `workspacePath/.superset/{fileName}`에 저장됨

## 에이전트 바이너리 래핑

에이전트 바이너리(claude, codex 등)는 `~/.superset/bin/`의 wrapper script로 관리됨.
- `apps/desktop/src/main/lib/agent-setup/` — wrapper 생성 로직
- Shell의 PATH에 `~/.superset/bin`이 prepend되어 wrapper가 실제 바이너리보다 먼저 실행됨
- Wrapper는 알림 hook, 환경변수 주입 등을 처리한 후 실제 바이너리 호출
