import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@superset/ui/utils";
import { LuHammer, LuRocket } from "react-icons/lu";

export const Route = createFileRoute("/_authenticated/_dashboard/builder")({
	component: BuilderLayout,
});

const NAV_ITEMS = [
	{ to: "/builder/composer", label: "Composer", icon: LuHammer },
	{ to: "/builder/deployments", label: "Deployments", icon: LuRocket },
] as const;

function BuilderLayout() {
	const location = useLocation();
	return (
		<div className="flex h-full w-full">
			<nav className="w-52 border-r border-border bg-background/50 p-3 space-y-1">
				<h3 className="px-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					Builder
				</h3>
				{NAV_ITEMS.map((item) => (
					<Link
						key={item.to}
						to={item.to as string}
						className={cn(
							"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
							location.pathname.startsWith(item.to)
								? "bg-accent text-accent-foreground font-medium"
								: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
						)}
					>
						<item.icon className="size-4" />
						{item.label}
					</Link>
				))}
			</nav>
			<div className="flex-1 overflow-auto">
				<Outlet />
			</div>
		</div>
	);
}
