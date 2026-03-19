import { AGENT_LABELS } from "@superset/shared/agent-command";
import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { Textarea } from "@superset/ui/textarea";
import { cn } from "@superset/ui/utils";
import { useCallback, useEffect, useState } from "react";
import {
	HiOutlineArrowPath,
	HiOutlineCheck,
	HiOutlineClipboard,
	HiOutlineCodeBracket,
	HiOutlineCube,
	HiOutlinePencilSquare,
	HiOutlineSparkles,
	HiOutlineStop,
} from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { ComponentTree } from "./ComponentTree";
import { PreviewTabs } from "./PreviewTabs";
import {
	COMPOSER_AGENT_TYPES,
	type ComponentTreeNode,
	type ComposerAgentType,
} from "./types";
import { useUIComposerSession } from "./useUIComposerSession";

export function UIComposer() {
	const [request, setRequest] = useState("");
	const [refinement, setRefinement] = useState("");
	const [showCode, setShowCode] = useState(false);
	const [copied, setCopied] = useState(false);
	const {
		session,
		generate,
		refine,
		stop,
		setActiveTab,
		setAgentType,
		setTreeNodes,
		reset,
	} = useUIComposerSession();

	const hasResult = session.tabs.length > 0 && !session.isGenerating;

	// Restore last selected agent from localStorage
	useEffect(() => {
		const stored = localStorage.getItem("lastSelectedAgent");
		if (
			stored &&
			(COMPOSER_AGENT_TYPES as readonly string[]).includes(stored)
		) {
			setAgentType(stored as ComposerAgentType);
		}
	}, [setAgentType]);

	const handleGenerate = useCallback(() => {
		if (request.trim()) {
			generate(request, session.agentType);
		}
	}, [request, generate, session.agentType]);

	const handleRefine = useCallback(() => {
		if (refinement.trim()) {
			refine(refinement, session.agentType);
			setRefinement("");
		}
	}, [refinement, refine, session.agentType]);

	const handleCopy = useCallback(() => {
		const activeTab = session.tabs[session.activeTabIndex];
		if (activeTab) {
			navigator.clipboard.writeText(activeTab.code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [session.tabs, session.activeTabIndex]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (hasResult) {
					handleRefine();
				} else {
					handleGenerate();
				}
			}
		},
		[handleGenerate, handleRefine, hasResult],
	);

	const handleNewSession = useCallback(() => {
		reset();
		setRequest("");
		setRefinement("");
	}, [reset]);

	const handleTreeReady = useCallback(
		(tree: ComponentTreeNode[]) => {
			setTreeNodes(tree);
		},
		[setTreeNodes],
	);

	const trpcUtils = electronTrpc.useUtils();

	const handleResolveImport = useCallback(
		async (path: string) => {
			// Extract component name from path like "@/components/ui/some-component"
			const match = path.match(/@\/components\/ui\/(.+)/);
			if (!match) return;

			const componentName = match[1];
			try {
				const res = await trpcUtils.atlas.uiComposer.searchComponents.fetch({
					query: componentName,
					maxResults: 5,
				});

				if (res.assets.length > 0) {
					const assetIds = res.assets.map(
						(a: Record<string, unknown>) => a.assetId as string,
					);
					const bundle =
						await trpcUtils.atlas.uiComposer.getComponentBundle.fetch({
							assetIds,
						});
					console.log(
						`[UIComposer] Fetched MCP bundle for "${componentName}":`,
						bundle.files.length,
						"files",
					);
					// Phase 2: transpile + inject into iframe via moduleResolved message
				}
			} catch (err) {
				console.warn(
					`[UIComposer] MCP fetch failed for "${componentName}":`,
					err,
				);
			}
		},
		[trpcUtils],
	);

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-6 py-3">
				<div>
					<h1 className="text-lg font-semibold">UI Composer</h1>
					<p className="text-xs text-muted-foreground">
						프롬프트 입력 → LLM 분석 → 실시간 UI 프리뷰
					</p>
				</div>
				<div className="flex items-center gap-1.5">
					{session.tabs.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowCode((v) => !v)}
						>
							<HiOutlineCodeBracket className="size-3.5 mr-1" />
							{showCode ? "Hide Code" : "Code"}
						</Button>
					)}
					{session.tabs.length > 0 && (
						<Button variant="ghost" size="sm" onClick={handleCopy}>
							{copied ? (
								<HiOutlineCheck className="size-3.5 mr-1 text-emerald-400" />
							) : (
								<HiOutlineClipboard className="size-3.5 mr-1" />
							)}
							{copied ? "Copied" : "Copy"}
						</Button>
					)}
					<Button variant="ghost" size="sm" onClick={handleNewSession}>
						<HiOutlineArrowPath className="size-3.5 mr-1" />
						New
					</Button>
				</div>
			</div>

			{/* Main content */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left panel: Prompt + Layers */}
				<div className="flex w-[400px] shrink-0 flex-col border-r border-border">
					{/* Prompt input */}
					<div className="shrink-0 space-y-3 border-b border-border p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<HiOutlineSparkles className="size-4 text-primary" />
								<span className="text-sm font-medium">
									{hasResult ? "Refine" : "UI Request"}
								</span>
							</div>
							<div className="flex items-center gap-2">
								{/* Agent selector */}
								<Select
									value={session.agentType}
									onValueChange={(v) => setAgentType(v as ComposerAgentType)}
									disabled={session.isGenerating}
								>
									<SelectTrigger className="h-8 w-[120px] text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{COMPOSER_AGENT_TYPES.map((agent) => (
											<SelectItem key={agent} value={agent}>
												{AGENT_LABELS[agent]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{session.isGenerating ? (
									<Button onClick={stop} size="sm" variant="destructive">
										<HiOutlineStop className="size-3.5 mr-1" />
										Stop
									</Button>
								) : hasResult ? (
									<Button
										onClick={handleRefine}
										disabled={!refinement.trim()}
										size="sm"
									>
										<HiOutlinePencilSquare className="size-3.5 mr-1" />
										Refine
									</Button>
								) : (
									<Button
										onClick={handleGenerate}
										disabled={!request.trim()}
										size="sm"
									>
										<HiOutlineSparkles className="size-3.5 mr-1" />
										Generate
									</Button>
								)}
							</div>
						</div>

						{hasResult ? (
							<Textarea
								value={refinement}
								onChange={(e) => setRefinement(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="수정 사항을 입력하세요. 예: 버튼 색상 변경, 레이아웃 조정, 새 섹션 추가..."
								rows={2}
								className="min-h-[48px] max-h-[100px] resize-y text-sm"
								disabled={session.isGenerating}
							/>
						) : (
							<Textarea
								value={request}
								onChange={(e) => setRequest(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="만들고 싶은 UI를 설명해주세요. 예: 세션 예약 랜딩페이지, 대시보드, 결제 폼..."
								rows={3}
								className="min-h-[60px] max-h-[120px] resize-y text-sm"
								disabled={session.isGenerating}
							/>
						)}

						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<HiOutlineCube className="size-3.5" />
							{session.matchedComponents.length > 0
								? `${session.matchedComponents.length} components matched`
								: "superbuilder-mcp catalog"}
						</div>

						{/* Matched components chips */}
						{session.matchedComponents.length > 0 && (
							<div className="flex flex-wrap gap-1.5 max-h-[48px] overflow-auto">
								{session.matchedComponents.slice(0, 12).map((comp) => (
									<Badge
										key={comp.assetId}
										variant="secondary"
										className="text-[10px] cursor-default"
									>
										{comp.exportNames[0] ?? comp.assetId}
									</Badge>
								))}
								{session.matchedComponents.length > 12 && (
									<Badge variant="outline" className="text-[10px]">
										+{session.matchedComponents.length - 12} more
									</Badge>
								)}
							</div>
						)}
					</div>

					{/* Component tree (Figma-like layers) */}
					<ComponentTree
						nodes={session.treeNodes}
						isGenerating={session.isGenerating}
						className="flex-1"
					/>
				</div>

				{/* Right panel: Preview + optional Code */}
				<div className="flex flex-1 flex-col overflow-hidden">
					{/* Preview tabs */}
					<PreviewTabs
						tabs={session.tabs}
						activeTabIndex={session.activeTabIndex}
						onTabChange={setActiveTab}
						isGenerating={session.isGenerating}
						onTreeReady={handleTreeReady}
						onResolveImport={handleResolveImport}
						className={cn(showCode ? "h-1/2" : "flex-1")}
					/>

					{/* Code editor (toggle) */}
					{showCode && session.tabs[session.activeTabIndex] && (
						<div className="flex h-1/2 flex-col border-t border-border">
							<div className="flex items-center border-b border-border px-3 py-1.5">
								<span className="text-xs font-medium text-muted-foreground">
									Code — {session.tabs[session.activeTabIndex].name}
								</span>
							</div>
							<textarea
								readOnly
								value={session.tabs[session.activeTabIndex].code}
								className="flex-1 resize-none bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
								spellCheck={false}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
