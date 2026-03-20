import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { HiOutlineChevronRight } from "react-icons/hi2";
import type { ComponentTreeNode } from "./types";

/** Shorten long class lists for display */
function formatClasses(className: string): string {
	const parts = className.split(/\s+/).filter(Boolean);
	if (parts.length <= 3) return parts.join(" ");
	return `${parts.slice(0, 3).join(" ")} +${parts.length - 3}`;
}

/** Map HTML tags to readable labels (fallback when no data-component) */
function tagLabel(tag: string): string {
	const labels: Record<string, string> = {
		div: "Frame",
		section: "Section",
		main: "Main",
		header: "Header",
		footer: "Footer",
		nav: "Nav",
		article: "Article",
		aside: "Aside",
		form: "Form",
		button: "Button",
		input: "Input",
		textarea: "TextArea",
		select: "Select",
		label: "Label",
		a: "Link",
		img: "Image",
		svg: "Icon",
		table: "Table",
		tr: "Row",
		td: "Cell",
		th: "Header Cell",
		ul: "List",
		ol: "OrderedList",
		li: "ListItem",
		span: "Text",
		p: "Paragraph",
		h1: "Heading 1",
		h2: "Heading 2",
		h3: "Heading 3",
		h4: "Heading 4",
		pre: "Code Block",
	};
	return labels[tag] || tag;
}

/** Get display name: prefer data-component, fallback to HTML tag label */
function nodeDisplayName(node: ComponentTreeNode): string {
	if (node.component) return node.component;
	return tagLabel(node.tag);
}

/** Color coding: shadcn components get distinct colors */
function nodeColor(node: ComponentTreeNode): string {
	if (node.component) {
		const comp = node.component;
		// Layout components
		if (
			[
				"Card",
				"CardHeader",
				"CardContent",
				"CardFooter",
				"CardTitle",
				"CardDescription",
			].includes(comp)
		)
			return "text-sky-400";
		// Interactive components
		if (
			[
				"Button",
				"Input",
				"Textarea",
				"Select",
				"Switch",
				"Toggle",
				"Checkbox",
				"RadioGroup",
				"Slider",
			].includes(comp)
		)
			return "text-emerald-400";
		// Data display
		if (["Badge", "Avatar", "Table", "Separator", "Progress"].includes(comp))
			return "text-violet-400";
		// Overlay / feedback
		if (
			["Dialog", "Sheet", "Popover", "Tooltip", "Toast", "Alert"].includes(comp)
		)
			return "text-amber-400";
		// Typography
		if (["Heading", "Text", "Label"].includes(comp)) return "text-orange-400";
		// Default component color
		return "text-primary";
	}
	// Fallback: HTML tag-based coloring
	const { tag } = node;
	if (["h1", "h2", "h3", "h4", "p", "span"].includes(tag))
		return "text-amber-400";
	if (["button", "a", "input", "textarea", "select"].includes(tag))
		return "text-emerald-400";
	if (["img", "svg"].includes(tag)) return "text-violet-400";
	if (["table", "tr", "td", "th", "ul", "ol", "li"].includes(tag))
		return "text-blue-400";
	return "text-muted-foreground";
}

function TreeNodeRow({
	node,
	depth,
}: {
	node: ComponentTreeNode;
	depth: number;
}) {
	const [expanded, setExpanded] = useState(depth < 3);
	const hasChildren = node.children.length > 0;
	const isComponent = !!node.component;

	return (
		<div>
			<div
				role="treeitem"
				tabIndex={0}
				className={cn(
					"flex items-center gap-1 py-0.5 px-1 rounded-sm cursor-pointer hover:bg-muted/50 group text-[11px]",
					depth === 0 && "font-medium",
				)}
				style={{ paddingLeft: `${depth * 14 + 4}px` }}
				onClick={() => setExpanded(!expanded)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
				}}
			>
				{hasChildren ? (
					<HiOutlineChevronRight
						className={cn(
							"size-3 shrink-0 transition-transform text-muted-foreground",
							expanded && "rotate-90",
						)}
					/>
				) : (
					<span className="size-3 shrink-0" />
				)}
				{isComponent && (
					<span className="size-1.5 rounded-full bg-current shrink-0 opacity-60" />
				)}
				<span className={cn("font-medium", nodeColor(node))}>
					{nodeDisplayName(node)}
				</span>
				{node.text && (
					<span className="text-foreground/60 truncate">
						— "
						{node.text.length > 30 ? `${node.text.slice(0, 30)}…` : node.text}"
					</span>
				)}
				{node.className && !isComponent && (
					<span className="text-muted-foreground/50 truncate ml-auto text-[10px]">
						{formatClasses(node.className)}
					</span>
				)}
			</div>
			{expanded &&
				hasChildren &&
				node.children.map((child, i) => (
					<TreeNodeRow
						key={`${child.component || child.tag}-${i}`}
						node={child}
						depth={depth + 1}
					/>
				))}
		</div>
	);
}

interface ComponentTreeProps {
	nodes: ComponentTreeNode[];
	isGenerating: boolean;
	className?: string;
}

export function ComponentTree({
	nodes,
	isGenerating,
	className,
}: ComponentTreeProps) {
	return (
		<div className={cn("flex flex-col overflow-hidden", className)}>
			<div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
				<span className="text-xs font-medium text-muted-foreground">
					Layers
				</span>
				{isGenerating && (
					<span className="flex items-center gap-1.5">
						<span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
						<span className="text-[10px] text-emerald-400">generating</span>
					</span>
				)}
			</div>

			<div className="flex-1 overflow-auto p-1">
				{nodes.length > 0 ? (
					nodes.map((node) => (
						<TreeNodeRow
							key={node.component || node.tag}
							node={node}
							depth={0}
						/>
					))
				) : (
					<div className="flex h-full items-center justify-center">
						<p className="text-xs text-muted-foreground">
							{isGenerating
								? "컴포넌트 트리를 생성 중..."
								: "생성된 UI의 레이어 구조가 여기 표시됩니다"}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
