# UI Composer Preview Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken iframe srcDoc preview with an independent Vite app that renders real shadcn/ui components via Babel in-browser JSX transformation.

**Architecture:** Desktop sends generated JSX code via postMessage to an iframe pointing at `apps/ui-composer` (Vite dev server on port 4100). The preview app transforms JSX with Babel standalone, resolves imports against a pre-registered module map of real shadcn components from `packages/ui-preview`, renders with React, then walks the DOM to extract a component tree sent back via postMessage.

**Tech Stack:** Vite 7, React 19, Tailwind CSS v4, Babel standalone, `packages/ui-preview` (shadcn fork)

**Spec:** `docs/superpowers/specs/2026-03-20-ui-composer-preview-architecture-design.md`

---

## Chunk 1: Foundation — `packages/ui-preview` + `apps/ui-composer` scaffold

### Task 1: Create `packages/ui-preview` package

**Files:**
- Create: `packages/ui-preview/package.json`
- Create: `packages/ui-preview/tsconfig.json`
- Create: `packages/ui-preview/src/lib/utils.ts`

- [ ] **Step 1: Create package.json**

Copy dependency versions from `packages/ui/package.json` at implementation time. Key deps: all `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `cmdk`, `embla-carousel-react`, `lucide-react`, `react`, `react-day-picker`, `react-resizable-panels`, `recharts`, `sonner`, `tailwind-merge`, `vaul`.

- [ ] **Step 2: Create tsconfig.json**

Extend `../../tooling/typescript/base.json`. Set jsx to `react-jsx`, add path alias `@/*` → `./src/*`.

- [ ] **Step 3: Create utils.ts**

Standard `cn()` using `clsx` + `tailwind-merge`.

- [ ] **Step 4: Run `bun install`**

- [ ] **Step 5: Commit**

### Task 2: Copy shadcn components into `packages/ui-preview`

**Files:**
- Create: `packages/ui-preview/src/components/ui/*.tsx` (54 files)
- Create: `packages/ui-preview/src/components/ui/index.ts`

- [ ] **Step 1: Copy all shadcn component files from packages/ui**

```bash
mkdir -p packages/ui-preview/src/components/ui
cp packages/ui/src/components/ui/*.tsx packages/ui-preview/src/components/ui/
```

- [ ] **Step 2: Fix import paths in copied files**

Replace `@superset/ui/utils` and `@superset/ui/lib/utils` with `@/lib/utils` in all copied files.

Verify: `grep -r "@superset/ui" packages/ui-preview/src/components/ui/` should return no results.

- [ ] **Step 3: Create barrel export index.ts**

Auto-generate from filenames: `export * from "./{name}";` for each `.tsx` file.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/ui-preview && bunx tsc --noEmit`

- [ ] **Step 5: Commit**

### Task 3: Scaffold `apps/ui-composer` Vite app

**Files:**
- Create: `apps/ui-composer/package.json`
- Create: `apps/ui-composer/vite.config.ts`
- Create: `apps/ui-composer/tsconfig.json`
- Create: `apps/ui-composer/index.html`
- Create: `apps/ui-composer/src/main.tsx`
- Create: `apps/ui-composer/src/styles/globals.css`

- [ ] **Step 1: Create package.json**

Dependencies: `@superset/ui-preview` (workspace), `react`, `react-dom`. Dev deps: `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `vite`, `typescript`. Dev script: `vite --port 4100`.

- [ ] **Step 2: Create vite.config.ts**

Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`. Resolve alias: `@/` → `src/`, `@/components/ui` → `../../packages/ui-preview/src/components/ui`. Server port: 4100 (strictPort).

- [ ] **Step 3: Create tsconfig.json**

Extend base. Paths: `@/*` → `./src/*`, `@/components/ui/*` → `../../packages/ui-preview/src/components/ui/*`.

- [ ] **Step 4: Create index.html**

Minimal HTML with `<html class="dark">`, `<body class="bg-background text-foreground">`, `<div id="root">`, script module src `/src/main.tsx`.

- [ ] **Step 5: Create globals.css with Tailwind + shadcn theme variables**

`@import "tailwindcss"` + full shadcn CSS variable definitions for `:root` and `.dark`. Copy exact values from `packages/ui/src/styles/globals.css`.

- [ ] **Step 6: Create main.tsx (minimal shell)**

Render a "Waiting for code..." placeholder. Import globals.css.

- [ ] **Step 7: Run `bun install` and verify dev server starts**

- [ ] **Step 8: Commit**

### Task 4: Turbo integration

**Files:**
- Modify: `turbo.json`

- [ ] **Step 1: Add ui-composer dev task if needed**

The standard `dev` pipeline should pick it up automatically. If custom config needed:
```json
"@superset/ui-composer#dev": { "dependsOn": ["^build"], "persistent": true, "cache": false }
```

- [ ] **Step 2: Verify turbo picks up the app**

- [ ] **Step 3: Commit**

---

## Chunk 2: Babel Transform Pipeline

### Task 5: Create postMessage protocol types

**Files:**
- Create: `apps/ui-composer/src/messaging/protocol.ts`

- [ ] **Step 1: Define all message types**

ParentMessage (Desktop → Preview): `render`, `moduleResolved`, `viewport`, `themeChange`
PreviewMessage (Preview → Desktop): `ready`, `componentTree`, `resolveImport`, `renderStatus`

Include `ComponentTreeNode` interface and `sendToParent()` helper.

- [ ] **Step 2: Commit**

### Task 6: Create module registry

**Files:**
- Create: `apps/ui-composer/src/renderer/module-registry.ts`

- [ ] **Step 1: Build the module registry with all shadcn base components**

Import all 54 shadcn components from `@/components/ui/*` as namespace imports. Build `STATIC_MODULES` map keyed by `@/components/ui/{name}`. Include `react` module. Expose: `resolveModule(path)`, `registerModule(path, exports)`, `hasModule(path)`, `getUnresolved(paths)`.

Dynamic modules stored in a `Map<string, Record<string, unknown>>` for MCP-fetched components.

- [ ] **Step 2: Commit**

### Task 7: Create Babel transform pipeline

**Files:**
- Create: `apps/ui-composer/src/renderer/babel-transform.ts`

- [ ] **Step 1: Install babel standalone**

`cd apps/ui-composer && bun add @babel/standalone`

- [ ] **Step 2: Create the transform module**

Custom Babel plugin `importTransformPlugin` that:
- Transforms `import { X } from "path"` → `const { X } = __require("path")`
- Transforms `import X from "path"` → `const X = __require("path").default`
- Transforms `import * as X from "path"` → `const X = __require("path")`
- Transforms `export default function App()` → `function App() {...}; __exports.default = App`
- Strips `export` from named exports

Also export `extractImportPaths(code)` for pre-checking and `transformJSX(code)` → `{ code, error }`.

- [ ] **Step 3: Commit**

### Task 8: Create code executor

**Files:**
- Create: `apps/ui-composer/src/renderer/code-executor.ts`
- Create: `apps/ui-composer/src/renderer/error-boundary.tsx`

- [ ] **Step 1: Create code-executor.ts**

`executeCode(jsxCode)` function that:
1. Extracts import paths and checks availability
2. Transforms JSX via Babel
3. Executes transformed code in the iframe's sandboxed JS context using `Function` constructor
4. Provides `__require` (resolves from module registry) and `__exports` (captures default export)
5. Returns `{ Component, error, unresolvedImports }`

Note: Code execution happens inside the isolated Vite iframe (separate origin from Desktop). No code is executed in the Electron main process.

- [ ] **Step 2: Create error-boundary.tsx**

Standard React ErrorBoundary that catches render errors and displays them with destructive theme colors.

- [ ] **Step 3: Commit**

---

## Chunk 3: Preview App + DOM Walker + Messaging

### Task 9: Create DOM walker for component tree extraction

**Files:**
- Create: `apps/ui-composer/src/tree/dom-walker.ts`

- [ ] **Step 1: Create dom-walker.ts**

`walkDom(element, depth)` → `ComponentTreeNode | null`. Reads `data-component` attribute, tag name, className, direct text content. Max depth 20. `extractComponentTree(rootElement)` returns `ComponentTreeNode[]`.

- [ ] **Step 2: Commit**

### Task 10: Create message handler

**Files:**
- Create: `apps/ui-composer/src/messaging/handler.ts`

- [ ] **Step 1: Create handler.ts**

`startListening(callback)` and `stopListening()`. Validates incoming messages have `type` string field.

- [ ] **Step 2: Commit**

### Task 11: Build the Preview App (App.tsx + PreviewRoot)

**Files:**
- Create: `apps/ui-composer/src/components/PreviewRoot.tsx`
- Create: `apps/ui-composer/src/components/ErrorOverlay.tsx`
- Modify: `apps/ui-composer/src/main.tsx`

- [ ] **Step 1: Create ErrorOverlay.tsx**

Displays error message in a destructive-themed container with monospace font.

- [ ] **Step 2: Create PreviewRoot.tsx**

Receives `code` prop. On code change: `executeCode()` → render Component or error. After render (300ms delay): extract component tree → `sendToParent`. If unresolved imports: request from Desktop. Uses ErrorBoundary wrapper.

- [ ] **Step 3: Update main.tsx**

Wire `startListening` → handle `render`, `moduleResolved`, `themeChange` messages. Send `ready` on mount. Apply theme class to `<html>`.

- [ ] **Step 4: Verify the app builds**

- [ ] **Step 5: Commit**

---

## Chunk 4: Desktop Integration

### Task 12: Update UIPreviewFrame.tsx

**Files:**
- Modify: `apps/desktop/src/renderer/screens/atlas/components/UIComposer/UIPreviewFrame.tsx`

- [ ] **Step 1: Rewrite UIPreviewFrame.tsx**

Replace `srcDoc` + `buildPreviewHtml()` with:
- iframe `src="http://localhost:4100"`
- `useEffect` to listen for messages (`ready`, `componentTree`, `resolveImport`, `renderStatus`)
- `useEffect` to postMessage `{ type: "render", code, theme }` when code changes and iframe is ready
- New prop: `onResolveImport?: (path: string) => void`
- `onTreeReady` now receives `ComponentTreeNode[]` (array, not single node)
- Origin check on incoming messages

- [ ] **Step 2: Commit**

### Task 13: Update UIComposer.tsx to pass onResolveImport

**Files:**
- Modify: `apps/desktop/src/renderer/screens/atlas/components/UIComposer/UIComposer.tsx`

- [ ] **Step 1: Add onResolveImport handler**

Add callback that logs unresolved imports (MVP placeholder for MCP fetch). Pass to UIPreviewFrame. Update `onTreeReady` to handle array type.

- [ ] **Step 2: Commit**

### Task 14: Update agent prompt for JSX generation

**Files:**
- Modify: `apps/desktop/src/lib/trpc/routers/atlas/ui-composer.ts`

- [ ] **Step 1: Rewrite DESIGN_SYSTEM_RULES and prompt builders**

Key changes:
- `React.createElement` 금지 → 표준 JSX
- `import` 구문 필수 from `@/components/ui/*`
- `export default function App()` 필수
- List available shadcn components with import paths and export names
- Keep TAB marker convention for multi-screen
- Remove all `var h = React.createElement` references
- Remove component wrapper function examples (real components now available)

- [ ] **Step 2: Commit**

### Task 15: Clean up old preview files

**Files:**
- Delete: `apps/desktop/src/renderer/screens/atlas/components/UIComposer/preview-theme.ts`

- [ ] **Step 1: Remove preview-theme.ts**

Verify no imports reference it. Delete the file.

- [ ] **Step 2: Commit**

---

## Chunk 5: On-Demand MCP Fetch + E2E Verification

### Task 16: Implement on-demand MCP component fetch

**Files:**
- Modify: `apps/desktop/src/renderer/screens/atlas/components/UIComposer/UIComposer.tsx`

- [ ] **Step 1: Implement handleResolveImport with MCP fetch**

Replace placeholder: search MCP catalog for the component name → fetch bundle with `getComponentBundle` → log results. Full transpilation of MCP source for iframe injection is Phase 2.

- [ ] **Step 2: Commit**

### Task 17: E2E verification

- [ ] **Step 1: Start both dev servers** (Desktop + UI Composer preview)
- [ ] **Step 2: Verify iframe loads** — should show "Waiting for code..."
- [ ] **Step 3: Generate a test UI** — verify real shadcn rendering, component tree, viewport toggle
- [ ] **Step 4: Test refine** — verify preview updates
- [ ] **Step 5: Test error handling** — verify error overlay
- [ ] **Step 6: Commit any fixes**
