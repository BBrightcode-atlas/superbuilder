import { describe, expect, mock, test } from "bun:test";

// ---------------------------------------------------------------------------
// Mock heavy dependencies so Terminal.tsx can be imported in a Node/Bun env
// ---------------------------------------------------------------------------

mock.module("@xterm/xterm/css/xterm.css", () => ({}));

mock.module("renderer/lib/electron-trpc", () => ({
	electronTrpc: {
		workspaces: {
			get: { useQuery: mock(() => ({ data: undefined })) },
			update: {
				useMutation: mock(() => ({
					mutate: mock(() => {}),
				})),
			},
		},
		terminal: {
			stream: {
				useSubscription: mock(() => {}),
			},
		},
		settings: {
			getOpenLinksInApp: { useQuery: mock(() => ({ data: undefined })) },
			getFontSettings: { useQuery: mock(() => ({ data: undefined })) },
		},
		useUtils: mock(() => ({
			workspaces: {
				getAllGrouped: { invalidate: mock(() => {}) },
				get: { invalidate: mock(() => {}) },
			},
		})),
	},
}));

mock.module("renderer/stores/tabs/store", () => ({
	useTabsStore: mock((selector: (s: unknown) => unknown) =>
		selector({
			panes: {},
			focusedPaneIds: {},
			clearPaneInitialData: mock(() => {}),
			setFocusedPane: mock(() => {}),
			setPaneName: mock(() => {}),
			removePane: mock(() => {}),
			openInBrowserPane: mock(() => {}),
		}),
	),
}));

mock.module("renderer/stores/theme", () => ({
	useTerminalTheme: mock(() => null),
}));

mock.module("./components", () => ({
	SessionKilledOverlay: mock(() => null),
}));

mock.module("./config", () => ({
	DEFAULT_TERMINAL_FONT_FAMILY: "monospace",
	DEFAULT_TERMINAL_FONT_SIZE: 14,
}));

mock.module("./helpers", () => ({
	getDefaultTerminalBg: mock(() => "#000000"),
}));

const noopHook = mock(() => ({}));
mock.module("./hooks", () => ({
	useFileLinkClick: mock(() => ({ handleFileLinkClick: mock(() => {}) })),
	useTerminalColdRestore: mock(() => ({
		isRestoredMode: false,
		setIsRestoredMode: mock(() => {}),
		setRestoredCwd: mock(() => {}),
		handleRetryConnection: mock(() => {}),
		handleStartShell: mock(() => {}),
	})),
	useTerminalConnection: mock(() => ({
		connectionError: null,
		setConnectionError: mock(() => {}),
		workspaceCwd: undefined,
		refs: {
			createOrAttach: { current: mock(() => {}) },
			write: { current: mock(() => {}) },
			resize: { current: mock(() => {}) },
			detach: { current: mock(() => {}) },
			clearScrollback: { current: mock(() => {}) },
		},
	})),
	useTerminalCwd: mock(() => ({ updateCwdFromData: mock(() => {}) })),
	useTerminalHotkeys: mock(() => ({
		isSearchOpen: false,
		setIsSearchOpen: mock(() => {}),
	})),
	useTerminalLifecycle: mock(() => ({
		xtermInstance: null,
		restartTerminal: mock(() => {}),
	})),
	useTerminalModes: mock(() => ({
		isAlternateScreenRef: { current: false },
		isBracketedPasteRef: { current: false },
		modeScanBufferRef: { current: "" },
		updateModesFromData: mock(() => {}),
		resetModes: mock(() => {}),
	})),
	useTerminalRefs: mock(() => ({
		isFocused: false,
		isFocusedRef: { current: false },
		initialThemeRef: { current: null },
		paneInitialCwdRef: { current: undefined },
		clearPaneInitialDataRef: { current: mock(() => {}) },
		workspaceCwdRef: { current: undefined },
		handleFileLinkClickRef: { current: mock(() => {}) },
		setPaneNameRef: { current: mock(() => {}) },
		handleTerminalFocusRef: { current: mock(() => {}) },
		registerClearCallbackRef: { current: mock(() => {}) },
		unregisterClearCallbackRef: { current: mock(() => {}) },
		registerScrollToBottomCallbackRef: { current: mock(() => {}) },
		unregisterScrollToBottomCallbackRef: { current: mock(() => {}) },
		registerGetSelectionCallbackRef: { current: mock(() => {}) },
		unregisterGetSelectionCallbackRef: { current: mock(() => {}) },
		registerPasteCallbackRef: { current: mock(() => {}) },
		unregisterPasteCallbackRef: { current: mock(() => {}) },
	})),
	useTerminalRestore: mock(() => ({
		isStreamReadyRef: { current: false },
		didFirstRenderRef: { current: false },
		pendingInitialStateRef: { current: null },
		maybeApplyInitialState: mock(() => {}),
		flushPendingEvents: mock(() => {}),
	})),
	useTerminalStream: mock(() => ({
		handleTerminalExit: mock(() => {}),
		handleStreamError: mock(() => {}),
		handleStreamData: mock(() => {}),
	})),
	...Object.fromEntries(
		[
			"useFileLinkClick",
			"useTerminalColdRestore",
			"useTerminalConnection",
			"useTerminalCwd",
			"useTerminalHotkeys",
			"useTerminalLifecycle",
			"useTerminalModes",
			"useTerminalRefs",
			"useTerminalRestore",
			"useTerminalStream",
		].map((name) => [name, noopHook]),
	),
}));

mock.module("./ScrollToBottomButton", () => ({
	ScrollToBottomButton: mock(() => null),
}));

mock.module("./TerminalSearch", () => ({
	TerminalSearch: mock(() => null),
}));

mock.module("./utils", () => ({
	shellEscapePaths: mock((paths: string[]) => paths.join(" ")),
}));

// ---------------------------------------------------------------------------
// Import after all mocks are registered
// ---------------------------------------------------------------------------

const { Terminal } = await import("./Terminal");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Terminal", () => {
	/**
	 * Reproduces #2240: Terminal was not wrapped in React.memo(), causing it to
	 * re-render on every parent state change (tab switches, sidebar updates, etc.)
	 * even when its own props (paneId, tabId, workspaceId) had not changed.
	 *
	 * A component wrapped with React.memo() exposes $$typeof === Symbol.for('react.memo').
	 */
	test("is wrapped in React.memo to prevent unnecessary re-renders", () => {
		const REACT_MEMO_TYPE = Symbol.for("react.memo");
		expect((Terminal as unknown as { $$typeof: symbol }).$$typeof).toBe(
			REACT_MEMO_TYPE,
		);
	});
});
