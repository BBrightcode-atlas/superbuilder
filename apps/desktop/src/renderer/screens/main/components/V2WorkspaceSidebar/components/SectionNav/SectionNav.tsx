import { cn } from "@superset/ui/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
	HiOutlineSquares2X2,
	HiOutlineWrenchScrewdriver,
	HiOutlinePuzzlePiece,
	HiOutlineRocketLaunch,
	HiOutlineCube,
	HiOutlinePaintBrush,
} from "react-icons/hi2";
import type { IconType } from "react-icons";

interface NavItem {
	to: string;
	label: string;
	icon: IconType;
}

interface NavSection {
	id: string;
	label: string;
	items: NavItem[];
}

const SECTIONS: NavSection[] = [
	{
		id: "ui",
		label: "UI",
		items: [
			{ to: "/ui/gallery", label: "Gallery", icon: HiOutlineSquares2X2 as IconType },
			{ to: "/ui/composer", label: "Composer", icon: HiOutlinePaintBrush as IconType },
		],
	},
	{
		id: "features",
		label: "Features",
		items: [
			{ to: "/atlas/catalog", label: "Gallery", icon: HiOutlineCube as IconType },
			{ to: "/atlas/studio", label: "Composer", icon: HiOutlinePuzzlePiece as IconType },
		],
	},
	{
		id: "builder",
		label: "Builder",
		items: [
			{
				to: "/builder/composer",
				label: "Composer",
				icon: HiOutlineWrenchScrewdriver as IconType,
			},
			{
				to: "/builder/deployments",
				label: "Deployments",
				icon: HiOutlineRocketLaunch as IconType,
			},
		],
	},
];

interface SectionNavProps {
	isCollapsed?: boolean;
}

export function SectionNav({ isCollapsed = false }: SectionNavProps) {
	const location = useLocation();
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		() => new Set(SECTIONS.map((s) => s.id)),
	);

	const toggleSection = (id: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	if (isCollapsed) {
		return (
			<div className="px-1.5 py-2 space-y-0.5">
				{SECTIONS.flatMap((section) =>
					section.items.map(({ to, label, icon: Icon }) => {
						const isActive = location.pathname.startsWith(to);
						return (
							<Link
								key={to}
								to={to}
								className={cn(
									"flex items-center justify-center size-8 rounded-md transition-colors",
									isActive
										? "bg-accent text-accent-foreground"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
								title={label}
							>
								<Icon className="size-4" />
							</Link>
						);
					}),
				)}
			</div>
		);
	}

	return (
		<div className="px-2 py-2 space-y-0.5">
			{SECTIONS.map((section) => {
				const isExpanded = expandedSections.has(section.id);
				const hasActiveItem = section.items.some((item) =>
					location.pathname.startsWith(item.to),
				);

				return (
					<div key={section.id}>
						<button
							type="button"
							onClick={() => toggleSection(section.id)}
							className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
						>
							<span
								className={cn(
									"text-[8px] transition-transform",
									isExpanded ? "rotate-90" : "",
								)}
							>
								&#9654;
							</span>
							<span className="flex-1 text-left">{section.label}</span>
							{!isExpanded && hasActiveItem && (
								<span className="size-1.5 rounded-full bg-accent-foreground/40" />
							)}
						</button>

						{isExpanded && (
							<div className="mt-0.5 space-y-0.5">
								{section.items.map(({ to, label, icon: Icon }) => {
									const isActive = location.pathname.startsWith(to);
									return (
										<Link
											key={to}
											to={to}
											className={cn(
												"flex items-center gap-2 px-3 py-1.5 ml-2 rounded-md text-sm transition-colors",
												isActive
													? "bg-accent text-accent-foreground font-medium"
													: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
											)}
										>
											<Icon className="size-3.5" />
											{label}
										</Link>
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
