/** Messages sent from Desktop (parent) to Preview (iframe) */
export type ParentMessage =
	| { type: "render"; code: string; theme: "dark" | "light" }
	| {
			type: "moduleResolved";
			path: string;
			exports: Record<string, unknown>;
	  }
	| { type: "viewport"; width: number }
	| { type: "themeChange"; theme: "dark" | "light" };

/** Messages sent from Preview (iframe) to Desktop (parent) */
export type PreviewMessage =
	| { type: "ready" }
	| { type: "componentTree"; tree: ComponentTreeNode[] }
	| { type: "resolveImport"; path: string }
	| {
			type: "renderStatus";
			status: "success" | "error";
			error?: string;
	  };

export interface ComponentTreeNode {
	tag: string;
	component: string;
	className: string;
	text: string;
	children: ComponentTreeNode[];
}

/** Type-safe postMessage sender to parent */
export function sendToParent(message: PreviewMessage): void {
	window.parent.postMessage(message, "*");
}
