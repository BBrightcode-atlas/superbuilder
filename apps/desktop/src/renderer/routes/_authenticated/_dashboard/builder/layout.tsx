import { Outlet, createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import { HiOutlineWrenchScrewdriver, HiOutlineRocketLaunch } from "react-icons/hi2";

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
		<div className="flex h-full">
			<nav className="w-52 border-r border-border bg-muted/30 p-3 space-y-1">
				<h3 className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					Builder
				</h3>
				{NAV_ITEMS.map((item) => {
					const Icon = item.icon;
					return (
						<Link
							key={item.to}
							to={item.to}
							className={cn(
								"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
								location.pathname.startsWith(item.to)
									? "bg-accent text-accent-foreground font-medium"
									: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
							)}
						>
							<Icon className="size-4" />
							{item.label}
						</Link>
					);
				})}
			</nav>
			<div className="flex-1 overflow-auto">
				<Outlet />
			</div>
		</div>
	);
}
