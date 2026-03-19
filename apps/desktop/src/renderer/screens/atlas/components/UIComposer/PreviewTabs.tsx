import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import {
	HiOutlineArrowPath,
	HiOutlineComputerDesktop,
	HiOutlineDevicePhoneMobile,
	HiOutlineDeviceTablet,
} from "react-icons/hi2";
import type { ComponentTreeNode, ComposerTab } from "./types";
import { UIPreviewFrame } from "./UIPreviewFrame";

type Viewport = "mobile" | "tablet" | "desktop";

interface PreviewTabsProps {
	tabs: ComposerTab[];
	activeTabIndex: number;
	onTabChange: (index: number) => void;
	isGenerating: boolean;
	className?: string;
	onTreeReady?: (tree: ComponentTreeNode[]) => void;
	onResolveImport?: (path: string) => void;
}

export function PreviewTabs({
	tabs,
	activeTabIndex,
	onTabChange,
	isGenerating,
	className,
	onTreeReady,
	onResolveImport,
}: PreviewTabsProps) {
	const [viewport, setViewport] = useState<Viewport>("desktop");
	const [refreshKey, setRefreshKey] = useState(0);

	const activeTab = tabs[activeTabIndex];
	const showTabBar = tabs.length > 1;

	return (
		<div className={cn("flex flex-col", className)}>
			{/* Toolbar */}
			<div className="flex items-center justify-between border-b border-border px-3 py-1.5">
				<div className="flex items-center gap-1">
					<span className="text-xs font-medium text-muted-foreground mr-2">
						Preview
					</span>
					{(
						[
							["mobile", HiOutlineDevicePhoneMobile],
							["tablet", HiOutlineDeviceTablet],
							["desktop", HiOutlineComputerDesktop],
						] as const
					).map(([vp, Icon]) => (
						<Button
							key={vp}
							variant={viewport === vp ? "secondary" : "ghost"}
							size="icon-xs"
							onClick={() => setViewport(vp)}
						>
							<Icon className="size-3.5" />
						</Button>
					))}
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={() => setRefreshKey((k) => k + 1)}
				>
					<HiOutlineArrowPath className="size-3.5" />
				</Button>
			</div>

			{/* Tab bar */}
			{showTabBar && (
				<div className="flex items-center gap-0.5 border-b border-border px-2 py-1">
					{tabs.map((tab, i) => (
						<Button
							key={tab.name}
							variant={i === activeTabIndex ? "secondary" : "ghost"}
							size="sm"
							className="h-6 px-2.5 text-[11px]"
							onClick={() => onTabChange(i)}
						>
							{tab.name}
						</Button>
					))}
				</div>
			)}

			{/* Preview area */}
			<div className="flex-1 overflow-hidden">
				{activeTab ? (
					<UIPreviewFrame
						key={`${activeTab.name}-${refreshKey}`}
						code={activeTab.code}
						viewport={viewport}
						className="h-full"
						onTreeReady={onTreeReady}
						onResolveImport={onResolveImport}
					/>
				) : (
					<div className="flex h-full items-center justify-center bg-black/20">
						{isGenerating ? (
							<div className="flex flex-col items-center gap-3">
								<div className="flex gap-1">
									<span className="size-2 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
									<span className="size-2 animate-bounce rounded-full bg-primary/40 [animation-delay:150ms]" />
									<span className="size-2 animate-bounce rounded-full bg-primary/40 [animation-delay:300ms]" />
								</div>
								<p className="text-xs text-muted-foreground">
									UI를 생성하고 있습니다...
								</p>
							</div>
						) : (
							<p className="text-xs text-muted-foreground">
								프롬프트를 입력하고 Generate를 클릭하세요
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
