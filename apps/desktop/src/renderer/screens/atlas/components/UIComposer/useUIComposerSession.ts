import type { AgentType } from "@superset/shared/agent-command";
import { useCallback, useRef, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import type {
	ComponentTreeNode,
	ComposerAgentType,
	ComposerSession,
	ComposerTab,
} from "./types";
import { INITIAL_SESSION } from "./types";

/** Sentinel marker to detect command completion in PTY output */
const SENTINEL = "___UI_COMPOSER_DONE___";

/**
 * Build a non-interactive prompt-mode command for each agent.
 * Unlike `buildAgentFileCommand` (interactive session), these use
 * print/prompt flags so the agent outputs code and exits without
 * trust checks or interactive prompts.
 */
const AGENT_PROMPT_COMMANDS: Record<AgentType, (filePath: string) => string> = {
	claude: (fp) => `claude --dangerously-skip-permissions -p "$(cat '${fp}')"`,
	amp: (fp) => `amp "$(cat '${fp}')"`,
	codex: (fp) =>
		`codex -c model_reasoning_effort="high" --dangerously-bypass-approvals-and-sandbox -q -- "$(cat '${fp}')"`,
	gemini: (fp) => `gemini --yolo "$(cat '${fp}')"`,
	mastracode: (fp) => `mastracode "$(cat '${fp}')"`,
	opencode: (fp) => `opencode --prompt "$(cat '${fp}')"`,
	pi: (fp) => `pi "$(cat '${fp}')"`,
	copilot: (fp) => `copilot -i "$(cat '${fp}')" --yolo`,
	"cursor-agent": (fp) => `cursor-agent --yolo "$(cat '${fp}')"`,
};

function buildPromptCommand(
	filePath: string,
	agent: ComposerAgentType,
): string {
	const builder = AGENT_PROMPT_COMMANDS[agent];
	const escaped = filePath.replaceAll("'", "'\\''");
	return builder(escaped);
}

/** ANSI stripping patterns — RegExp constructor avoids biome control-char lint */
// biome-ignore lint/complexity/useRegexLiterals: regex literals trigger noControlCharactersInRegex
const RE_OSC = new RegExp("\x1b\\][^\x07\x1b]*(?:\x07|\x1b\\\\)?", "g");
// biome-ignore lint/complexity/useRegexLiterals: regex literals trigger noControlCharactersInRegex
const RE_CSI = new RegExp(
	"[\x1b\x9b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]",
	"g",
);
// biome-ignore lint/complexity/useRegexLiterals: regex literals trigger noControlCharactersInRegex
const RE_CTRL = new RegExp("[\x00-\x08\x0e-\x1f]", "g");

/** Strip ANSI escape codes and OSC sequences from PTY output */
function stripAnsi(str: string): string {
	return str.replace(RE_OSC, "").replace(RE_CSI, "").replace(RE_CTRL, "");
}

/**
 * Extract clean code from PTY output by finding code anchors.
 * PTY output contains: command echo + agent output + shell prompt noise.
 * We look for known code patterns to find the actual generated code.
 */
function extractCodeFromOutput(raw: string): string {
	// Find the LAST standalone sentinel line (not the one in command echo).
	// Command echo has: echo "___UI_COMPOSER_DONE___" (sentinel inside quotes)
	// Actual output has: ___UI_COMPOSER_DONE___ (standalone on a line)
	const lines = raw.split("\n");
	let sentinelLineIdx = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		const t = lines[i].trim();
		if (
			t === SENTINEL ||
			(t.endsWith(SENTINEL) && !t.endsWith(`"${SENTINEL}"`))
		) {
			sentinelLineIdx = i;
			break;
		}
	}

	const cleaned =
		sentinelLineIdx >= 0 ? lines.slice(0, sentinelLineIdx).join("\n") : raw;

	// Try TAB markers first (multi-screen)
	const tabStart = cleaned.search(/\/\/ \[TAB:/);
	if (tabStart >= 0) {
		const lastTabEnd = cleaned.lastIndexOf("// [/TAB:");
		if (lastTabEnd >= 0) {
			// Find end of closing TAB marker line
			const lineEnd = cleaned.indexOf("\n", lastTabEnd + 10);
			return cleaned
				.substring(tabStart, lineEnd >= 0 ? lineEnd : undefined)
				.trim();
		}
		return cleaned.substring(tabStart).trim();
	}

	// Look for import statement as anchor (standard JSX format)
	const importStart = cleaned.search(/^import\s+/m);
	if (importStart >= 0) {
		return cleaned.substring(importStart).trim();
	}

	// Fallback: var h = React.createElement (legacy format)
	const reactStart = cleaned.search(/var\s+h\s*=\s*React\.createElement/);
	if (reactStart >= 0) {
		return cleaned.substring(reactStart).trim();
	}

	// Look for export default function or function App
	const funcStart = cleaned.search(
		/(?:export\s+default\s+function|function\s+App|var\s+App)/,
	);
	if (funcStart >= 0) {
		return cleaned.substring(funcStart).trim();
	}

	// Look for markdown code block
	const codeMatch = cleaned.match(
		/```(?:tsx?|jsx?|javascript|typescript)?\s*\n([\s\S]*?)```/,
	);
	if (codeMatch?.[1]) {
		return codeMatch[1].trim();
	}

	// No recognizable code pattern found — return empty to avoid
	// sending command echo or other noise to the preview
	return "";
}

/** Parse multi-tab code from extracted code string */
function parseTabsFromCode(code: string): ComposerTab[] {
	// 1. TAB marker-based parsing
	const tabRegex = /\/\/ \[TAB:(.+?)\]([\s\S]*?)\/\/ \[\/TAB:\1\]/g;
	const tabs = [...code.matchAll(tabRegex)].map((m) => ({
		name: m[1],
		code: m[2].trim(),
	}));
	if (tabs.length > 0) return tabs;

	// 2. Single screen — code should already be clean from extractCodeFromOutput
	if (code.length > 20) {
		return [{ name: "Preview", code }];
	}

	return [];
}

let paneCounter = 0;

function generatePaneId(): string {
	return `ui-composer-${Date.now()}-${++paneCounter}`;
}

export function useUIComposerSession() {
	const [session, setSession] = useState<ComposerSession>(INITIAL_SESSION);
	const accumulatedRef = useRef("");
	const paneIdRef = useRef("");

	const utils = electronTrpc.useUtils();
	const buildPromptMutation =
		electronTrpc.atlas.uiComposer.buildPrompt.useMutation();
	const createOrAttachMutation =
		electronTrpc.terminal.createOrAttach.useMutation();
	const writeMutation = electronTrpc.terminal.write.useMutation();
	const signalMutation = electronTrpc.terminal.signal.useMutation();

	// Subscribe to terminal stream for active pane
	electronTrpc.terminal.stream.useSubscription(session.paneId || "noop", {
		enabled: !!session.paneId && session.isGenerating,
		onData: (event) => {
			if (event.type === "data") {
				const cleaned = stripAnsi(event.data);
				accumulatedRef.current += cleaned;

				// Check for sentinel as standalone output (not part of command echo).
				// Command echo: ...echo "___UI_COMPOSER_DONE___" (ends with ")
				// Actual output: ___UI_COMPOSER_DONE___ (line ends with sentinel)
				const hasSentinel = accumulatedRef.current.split("\n").some((line) => {
					const t = line.trim();
					return (
						t === SENTINEL ||
						(t.endsWith(SENTINEL) && !t.endsWith(`"${SENTINEL}"`))
					);
				});

				if (hasSentinel) {
					const code = extractCodeFromOutput(accumulatedRef.current);
					const tabs = parseTabsFromCode(code);
					setSession((prev) => ({
						...prev,
						isGenerating: false,
						activityLog: prev.activityLog + cleaned,
						tabs: tabs.length > 0 ? tabs : prev.tabs,
					}));
					return;
				}

				setSession((prev) => ({
					...prev,
					activityLog: prev.activityLog + cleaned,
				}));

				// Try to extract code tabs from accumulated output (live preview)
				const code = extractCodeFromOutput(accumulatedRef.current);
				const tabs = parseTabsFromCode(code);
				if (tabs.length > 0) {
					setSession((prev) => ({
						...prev,
						tabs,
					}));
				}
			}

			if (event.type === "exit") {
				// Fallback: PTY itself exited
				const code = extractCodeFromOutput(accumulatedRef.current);
				const tabs = parseTabsFromCode(code);
				setSession((prev) => ({
					...prev,
					isGenerating: false,
					tabs: tabs.length > 0 ? tabs : prev.tabs,
				}));
			}
		},
	});

	const generate = useCallback(
		async (request: string, agentType: ComposerAgentType) => {
			if (!request.trim()) return;

			const paneId = generatePaneId();
			paneIdRef.current = paneId;
			accumulatedRef.current = "";

			// Set initial generating state (without paneId yet — subscription won't activate)
			setSession((prev) => ({
				...prev,
				agentType,
				isGenerating: true,
				activityLog: "",
				tabs: [],
				activeTabIndex: 0,
				treeNodes: [],
				matchedComponents: [],
			}));

			try {
				// 1. Search MCP catalog (non-blocking)
				let componentContext: string | undefined;
				try {
					const res = await utils.atlas.uiComposer.searchComponents.fetch({
						query: request,
						maxResults: 20,
					});
					if (res.assets.length > 0) {
						setSession((prev) => ({
							...prev,
							matchedComponents: res.assets.map(
								(a: Record<string, unknown>) => ({
									assetId: a.assetId as string,
									summary: (a.summary as string) ?? "",
									exportNames: (a.exportNames as string[]) ?? [],
								}),
							),
						}));
						componentContext = res.assets
							.map(
								(a: Record<string, unknown>) =>
									`- ${(a.exportNames as string[])?.[0] ?? a.assetId}: ${a.summary ?? ""}`,
							)
							.join("\n");
					}
				} catch {
					// MCP search is optional
				}

				// 2. Build prompt and save to temp file
				const { promptFilePath } = await buildPromptMutation.mutateAsync({
					request: request.trim(),
					componentContext,
				});

				// 3. Create terminal session FIRST
				await createOrAttachMutation.mutateAsync({
					paneId,
					tabId: "ui-composer-virtual",
					workspaceId: "ui-composer-session",
				});

				// 4. NOW set paneId — subscription activates with valid terminal session
				setSession((prev) => ({ ...prev, paneId }));

				// 5. Write command
				const command = buildPromptCommand(promptFilePath, agentType);
				await writeMutation.mutateAsync({
					paneId,
					data: `${command}; echo "${SENTINEL}"\n`,
				});
			} catch (err) {
				console.error("[UIComposer] Generation failed:", err);
				setSession((prev) => ({
					...prev,
					isGenerating: false,
					activityLog:
						prev.activityLog +
						`\n\nError: ${err instanceof Error ? err.message : "Generation failed"}`,
				}));
			}
		},
		[utils, buildPromptMutation, createOrAttachMutation, writeMutation],
	);

	const stop = useCallback(async () => {
		if (paneIdRef.current) {
			try {
				await signalMutation.mutateAsync({
					paneId: paneIdRef.current,
					signal: "SIGTERM",
				});
			} catch {
				// Session may already be dead
			}
		}
		setSession((prev) => ({ ...prev, isGenerating: false }));
	}, [signalMutation]);

	const setActiveTab = useCallback((index: number) => {
		setSession((prev) => ({ ...prev, activeTabIndex: index }));
	}, []);

	const setAgentType = useCallback((agentType: ComposerAgentType) => {
		setSession((prev) => ({ ...prev, agentType }));
		localStorage.setItem("lastSelectedAgent", agentType);
	}, []);

	const setTreeNodes = useCallback((treeNodes: ComponentTreeNode[]) => {
		setSession((prev) => ({ ...prev, treeNodes }));
	}, []);

	/** Refine existing code with a follow-up instruction */
	const refine = useCallback(
		async (instruction: string, agentType: ComposerAgentType) => {
			if (!instruction.trim() || session.tabs.length === 0) return;

			const currentCode = session.tabs
				.map((tab) =>
					session.tabs.length > 1
						? `// [TAB:${tab.name}]\n${tab.code}\n// [/TAB:${tab.name}]`
						: tab.code,
				)
				.join("\n\n");

			const paneId = generatePaneId();
			paneIdRef.current = paneId;
			accumulatedRef.current = "";

			try {
				// 1. Build prompt first (before state change)
				const { promptFilePath } = await buildPromptMutation.mutateAsync({
					request: instruction.trim(),
					existingCode: currentCode,
				});

				// 2. Create terminal session (before subscription activates)
				await createOrAttachMutation.mutateAsync({
					paneId,
					tabId: "ui-composer-virtual",
					workspaceId: "ui-composer-session",
				});

				// 3. NOW set state — subscription activates with valid terminal session
				setSession((prev) => ({
					...prev,
					paneId,
					agentType,
					isGenerating: true,
					activityLog: "",
					treeNodes: [],
				}));

				// 4. Write command
				const command = buildPromptCommand(promptFilePath, agentType);
				await writeMutation.mutateAsync({
					paneId,
					data: `${command}; echo "${SENTINEL}"\n`,
				});
			} catch (err) {
				console.error("[UIComposer] Refinement failed:", err);
				setSession((prev) => ({
					...prev,
					isGenerating: false,
					activityLog:
						prev.activityLog +
						`\n\nError: ${err instanceof Error ? err.message : "Refinement failed"}`,
				}));
			}
		},
		[session.tabs, buildPromptMutation, createOrAttachMutation, writeMutation],
	);

	const reset = useCallback(() => {
		accumulatedRef.current = "";
		setSession(INITIAL_SESSION);
	}, []);

	return {
		session,
		generate,
		refine,
		stop,
		setActiveTab,
		setAgentType,
		setTreeNodes,
		reset,
	};
}
