import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import {
	HiOutlineWrenchScrewdriver,
	HiOutlineRocketLaunch,
} from "react-icons/hi2";

export const Route = createFileRoute("/_authenticated/_dashboard/builder")({
	component: BuilderLayout,
});

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; icon: IconType }> = [
	{ to: "/builder/composer", label: "Composer", icon: HiOutlineWrenchScrewdriver as IconType },
	{ to: "/builder/deployments", label: "Deployments", icon: HiOutlineRocketLaunch as IconType },
];

function BuilderLayout() {
	const location = useLocation();
	return (
		<div className="flex h-full w-full">
			<div className="w-52 border-r border-border bg-muted/30 flex flex-col">
				<div className="p-4 pb-1 pt-4">
					<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Builder
					</h2>
				</div>
				<nav className="px-2 pb-2 space-y-0.5">
					{NAV_ITEMS.map(({ to, label, icon: Icon }) => {
						const isActive = location.pathname.startsWith(to);
						return (
							<Link
								key={to}
								to={to as string}
								className={cn(
									"flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
									isActive
										? "bg-accent text-accent-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
							>
								<Icon className="size-4" />
								{label}
							</Link>
						);
					})}
				</nav>
			</div>
			<div className="flex-1 overflow-auto">
				<Outlet />
			</div>
		</div>
	);
}
