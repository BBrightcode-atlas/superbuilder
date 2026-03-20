import type { ComponentTreeNode } from "../messaging/protocol";

const MAX_DEPTH = 20;

export function walkDom(element: Element, depth = 0): ComponentTreeNode | null {
	if (!element || depth > MAX_DEPTH) return null;

	const component = element.getAttribute?.("data-component") ?? "";
	const tag = element.tagName?.toLowerCase() ?? "";
	const rawClassName = element.className;

	let text = "";
	for (const child of element.childNodes) {
		if (child.nodeType === Node.TEXT_NODE) {
			const trimmed = child.textContent?.trim() ?? "";
			if (trimmed.length > 0 && trimmed.length < 80) {
				text = trimmed;
				break;
			}
		}
	}

	const children: ComponentTreeNode[] = [];
	for (const child of element.children) {
		const node = walkDom(child, depth + 1);
		if (node) children.push(node);
	}

	return {
		tag,
		component,
		className: typeof rawClassName === "string" ? rawClassName : "",
		text,
		children,
	};
}

export function extractComponentTree(
	rootElement: Element,
): ComponentTreeNode[] {
	const tree: ComponentTreeNode[] = [];
	for (const child of rootElement.children) {
		const node = walkDom(child, 0);
		if (node) tree.push(node);
	}
	return tree;
}
