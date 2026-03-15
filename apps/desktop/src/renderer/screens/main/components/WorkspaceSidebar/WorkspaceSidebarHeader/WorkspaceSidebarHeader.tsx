import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import { LuBoxes, LuHammer, LuLayers, LuPuzzle } from "react-icons/lu";
import { GATED_FEATURES, usePaywall } from "renderer/components/Paywall";
import { useTasksFilterStore } from "renderer/routes/_authenticated/_dashboard/tasks/stores/tasks-filter-state";
import { STROKE_WIDTH } from "../constants";
import { NewWorkspaceButton } from "./NewWorkspaceButton";

interface WorkspaceSidebarHeaderProps {
	isCollapsed?: boolean;
}

export function WorkspaceSidebarHeader({
	isCollapsed = false,
}: WorkspaceSidebarHeaderProps) {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { gateFeature } = usePaywall();

	const isWorkspacesListOpen = !!matchRoute({ to: "/workspaces" });
	const isTasksOpen = !!matchRoute({ to: "/tasks", fuzzy: true });
	const isUiOpen = !!matchRoute({ to: "/ui" as string, fuzzy: true });
	const isAtlasOpen = !!matchRoute({ to: "/atlas", fuzzy: true });
	const isBuildersOpen = !!matchRoute({ to: "/builder" as string, fuzzy: true });

	const handleWorkspacesClick = () => {
		if (isWorkspacesListOpen) {
			navigate({ to: "/workspace" });
		} else {
			navigate({ to: "/workspaces" });
		}
	};

	const {
		tab: lastTab,
		assignee: lastAssignee,
		search: lastSearch,
	} = useTasksFilterStore();

	const handleTasksClick = () => {
		gateFeature(GATED_FEATURES.TASKS, () => {
			const search: Record<string, string> = {};
			if (lastTab !== "all") search.tab = lastTab;
			if (lastAssignee) search.assignee = lastAssignee;
			if (lastSearch) search.search = lastSearch;
			navigate({ to: "/tasks", search });
		});
	};

	const handleUiClick = () => {
		navigate({ to: "/ui/gallery" as string });
	};

	const handleAtlasClick = () => {
		navigate({ to: "/atlas/catalog" });
	};

	const handleBuildersClick = () => {
		navigate({ to: "/builder/composer" as string });
	};

	if (isCollapsed) {
		return (
			<div className="flex flex-col items-center border-b border-border py-2 gap-2">
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleWorkspacesClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isWorkspacesListOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuLayers className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">Workspaces</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleTasksClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isTasksOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<HiOutlineClipboardDocumentList
								className="size-4"
								strokeWidth={STROKE_WIDTH}
							/>
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">Tasks</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleUiClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isUiOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuPuzzle className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">UI</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleAtlasClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isAtlasOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuBoxes className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">Features</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleBuildersClick}
							className={cn(
								"flex items-center justify-center size-8 rounded-md transition-colors",
								isBuildersOpen
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
						>
							<LuHammer className="size-4" strokeWidth={STROKE_WIDTH} />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">Builders</TooltipContent>
				</Tooltip>

				<NewWorkspaceButton isCollapsed />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1 border-b border-border px-2 pt-2 pb-2">
			<button
				type="button"
				onClick={handleWorkspacesClick}
				className={cn(
					"flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors",
					isWorkspacesListOpen
						? "text-foreground bg-accent"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
				)}
			>
				<div className="flex items-center justify-center size-5">
					<LuLayers className="size-4" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Workspaces</span>
			</button>

			<button
				type="button"
				onClick={handleTasksClick}
				className={cn(
					"flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors",
					isTasksOpen
						? "text-foreground bg-accent"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
				)}
			>
				<div className="flex items-center justify-center size-5">
					<HiOutlineClipboardDocumentList
						className="size-4"
						strokeWidth={STROKE_WIDTH}
					/>
				</div>
				<span className="text-sm font-medium flex-1 text-left">Tasks</span>
			</button>

			<button
				type="button"
				onClick={handleUiClick}
				className={cn(
					"flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors",
					isUiOpen
						? "text-foreground bg-accent"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
				)}
			>
				<div className="flex items-center justify-center size-5">
					<LuPuzzle className="size-4" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">UI</span>
			</button>

			<button
				type="button"
				onClick={handleAtlasClick}
				className={cn(
					"flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors",
					isAtlasOpen
						? "text-foreground bg-accent"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
				)}
			>
				<div className="flex items-center justify-center size-5">
					<LuBoxes className="size-4" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Features</span>
			</button>

			<button
				type="button"
				onClick={handleBuildersClick}
				className={cn(
					"flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors",
					isBuildersOpen
						? "text-foreground bg-accent"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
				)}
			>
				<div className="flex items-center justify-center size-5">
					<LuHammer className="size-4" strokeWidth={STROKE_WIDTH} />
				</div>
				<span className="text-sm font-medium flex-1 text-left">Builders</span>
			</button>

			<NewWorkspaceButton />
		</div>
	);
}
