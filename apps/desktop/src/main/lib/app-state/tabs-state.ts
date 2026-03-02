import { appState } from ".";
import {
	defaultAppState,
	type TabsState,
	type WindowTabsState,
} from "./schemas";

function getWindowKey(windowId: number | null | undefined): string | null {
	return windowId === null || windowId === undefined ? null : String(windowId);
}

function toWindowTabsState(
	state: Partial<TabsState> | undefined,
): WindowTabsState {
	return {
		activeTabIds: state?.activeTabIds ?? {},
		focusedPaneIds: state?.focusedPaneIds ?? {},
		tabHistoryStacks: state?.tabHistoryStacks ?? {},
	};
}

export function getTabsStateForWindow(
	windowId: number | null | undefined,
): TabsState {
	const sharedState = appState.data.tabsState ?? defaultAppState.tabsState;
	const key = getWindowKey(windowId);
	const windowState =
		(key ? appState.data.tabsStateByWindow[key] : undefined) ??
		toWindowTabsState(sharedState);

	return {
		tabs: sharedState.tabs,
		panes: sharedState.panes,
		activeTabIds: windowState.activeTabIds,
		focusedPaneIds: windowState.focusedPaneIds,
		tabHistoryStacks: windowState.tabHistoryStacks,
	};
}

function getMergedWindowTabsState(): WindowTabsState {
	const merged = toWindowTabsState(appState.data.tabsState);
	const byWindow = appState.data.tabsStateByWindow;

	for (const state of Object.values(byWindow ?? {})) {
		const windowState = toWindowTabsState(state);
		Object.assign(merged.activeTabIds, windowState.activeTabIds);
		Object.assign(merged.focusedPaneIds, windowState.focusedPaneIds);
		Object.assign(merged.tabHistoryStacks, windowState.tabHistoryStacks);
	}

	return merged;
}

export function setTabsStateForWindow(
	windowId: number | null | undefined,
	tabsState: TabsState,
): void {
	const windowState: WindowTabsState = {
		activeTabIds: tabsState.activeTabIds,
		focusedPaneIds: tabsState.focusedPaneIds,
		tabHistoryStacks: tabsState.tabHistoryStacks,
	};

	const key = getWindowKey(windowId);
	if (key) {
		appState.data.tabsStateByWindow = {
			...appState.data.tabsStateByWindow,
			[key]: windowState,
		};
	}

	// Shared across windows: tab/pane topology.
	// Legacy fallback keeps the latest caller's view state.
	appState.data.tabsState = {
		tabs: tabsState.tabs,
		panes: tabsState.panes,
		activeTabIds: windowState.activeTabIds,
		focusedPaneIds: windowState.focusedPaneIds,
		tabHistoryStacks: windowState.tabHistoryStacks,
	};
}

export function getMergedTabsState(): TabsState {
	const sharedState = appState.data.tabsState ?? defaultAppState.tabsState;
	const mergedWindowState = getMergedWindowTabsState();

	return {
		tabs: sharedState.tabs,
		panes: sharedState.panes,
		activeTabIds: mergedWindowState.activeTabIds,
		focusedPaneIds: mergedWindowState.focusedPaneIds,
		tabHistoryStacks: mergedWindowState.tabHistoryStacks,
	};
}

export function resetTabsState(): void {
	appState.data.tabsState = defaultAppState.tabsState;
	appState.data.tabsStateByWindow = {};
}
