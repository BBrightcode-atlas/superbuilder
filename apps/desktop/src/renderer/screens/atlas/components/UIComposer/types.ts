import type { AgentType } from "@superset/shared/agent-command";

/** UI Composer에서 지원하는 에이전트 목록 */
export const COMPOSER_AGENT_TYPES = [
	"claude",
	"codex",
	"gemini",
	"opencode",
] as const satisfies readonly AgentType[];

export type ComposerAgentType = (typeof COMPOSER_AGENT_TYPES)[number];

export interface ComposerTab {
	name: string;
	code: string;
}

/** Component tree node for Figma-like layer panel */
export interface ComponentTreeNode {
	tag: string;
	/** shadcn/ui component name from data-component attribute */
	component: string;
	className: string;
	text: string;
	children: ComponentTreeNode[];
}

export interface ComposerSession {
	paneId: string;
	isGenerating: boolean;
	activityLog: string;
	tabs: ComposerTab[];
	activeTabIndex: number;
	agentType: ComposerAgentType;
	treeNodes: ComponentTreeNode[];
	matchedComponents: Array<{
		assetId: string;
		summary: string;
		exportNames: string[];
	}>;
}

export const INITIAL_SESSION: ComposerSession = {
	paneId: "",
	isGenerating: false,
	activityLog: "",
	tabs: [],
	activeTabIndex: 0,
	agentType: "claude",
	treeNodes: [],
	matchedComponents: [],
};
