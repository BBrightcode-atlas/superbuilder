import { cn } from "@superset/ui/utils";
import { Link, useLocation } from "@tanstack/react-router";
import type { IconType } from "react-icons";
import { HiOutlineInboxArrowDown, HiOutlineSquares2X2 } from "react-icons/hi2";

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; icon: IconType }> =
	[
		{
			to: "/ui/gallery",
			label: "Gallery",
			icon: HiOutlineSquares2X2 as IconType,
		},
		{
			to: "/ui/requests",
			label: "Requests",
			icon: HiOutlineInboxArrowDown as IconType,
		},
	];

export function UiSidebar() {
	const location = useLocation();

	return (
		<div className="w-52 border-r border-border bg-muted/30 flex flex-col">
			<div className="p-4 pb-1 pt-4">
				<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					UI
				</h2>
			</div>
			<nav className="px-2 pb-2 space-y-0.5">
				{NAV_ITEMS.map(({ to, label, icon: Icon }) => {
					const isActive = location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={to}
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
	);
}
