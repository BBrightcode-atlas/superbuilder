import { useAtom } from "jotai";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { cn } from "@superset/ui/utils";
import {
	HiOutlineFolder,
	HiOutlineClipboardDocumentList,
	HiOutlinePaintBrush,
	HiOutlineCube,
	HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import {
	activeSidebarTabAtom,
	type SidebarTab,
} from "../../stores/sidebar-tab-state";
import { useEffect } from "react";

const TABS: { id: SidebarTab; icon: typeof HiOutlineFolder; label: string; path?: string }[] = [
	{ id: "workspace", icon: HiOutlineFolder, label: "Workspace" },
	{ id: "task", icon: HiOutlineClipboardDocumentList, label: "Task", path: "/tasks" },
	{ id: "ui", icon: HiOutlinePaintBrush, label: "UI", path: "/ui" },
	{ id: "features", icon: HiOutlineCube, label: "Features", path: "/features" },
	{ id: "builder", icon: HiOutlineWrenchScrewdriver, label: "Builder", path: "/builder" },
];

export function SidebarTabBar() {
	const [activeTab, setActiveTab] = useAtom(activeSidebarTabAtom);
	const navigate = useNavigate();
	const location = useLocation();

	// Sync tab with current route
	useEffect(() => {
		if (location.pathname.startsWith("/features")) setActiveTab("features");
		else if (location.pathname.startsWith("/builder")) setActiveTab("builder");
		else if (location.pathname.startsWith("/ui")) setActiveTab("ui");
		else if (location.pathname.startsWith("/tasks")) setActiveTab("task");
		else setActiveTab("workspace");
	}, [location.pathname, setActiveTab]);

	return (
		<div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-background">
			{TABS.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => {
						setActiveTab(tab.id);
						if (tab.path) navigate({ to: tab.path });
					}}
					className={cn(
						"flex items-center justify-center size-8 rounded-md transition-colors",
						"hover:bg-accent",
						activeTab === tab.id
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground",
					)}
					title={tab.label}
				>
					<tab.icon className="size-4" />
				</button>
			))}
		</div>
	);
}
