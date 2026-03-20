import { Badge } from "@superset/ui/badge";
import { cn } from "@superset/ui/utils";
import { Link } from "@tanstack/react-router";

interface FeatureCardProps {
	id: string;
	name: string;
	type: string;
	group: string;
	dependencies: string[];
	isCore?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
	page: "bg-blue-500/10 text-blue-500",
	widget: "bg-purple-500/10 text-purple-500",
	agent: "bg-amber-500/10 text-amber-500",
};

export function FeatureCard({
	id,
	name,
	type,
	group,
	dependencies,
	isCore,
}: FeatureCardProps) {
	return (
		<Link
			to="/atlas/catalog/$featureId"
			params={{ featureId: id }}
			className="block rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-accent/30 transition-all"
		>
			<div className="flex items-start justify-between mb-2">
				<h3 className="text-sm font-medium text-foreground">{name}</h3>
				<div className="flex gap-1">
					{isCore ? (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0">
							Core
						</Badge>
					) : null}
					<span
						className={cn(
							"text-[10px] font-medium px-1.5 py-0.5 rounded",
							TYPE_COLORS[type] ?? "bg-muted text-muted-foreground",
						)}
					>
						{type}
					</span>
				</div>
			</div>
			<p className="text-xs text-muted-foreground mb-3 line-clamp-2">
				{id} feature
			</p>
			<div className="flex items-center justify-between text-[10px] text-muted-foreground">
				<span>{group}</span>
				{dependencies.length > 0 ? (
					<span>{dependencies.length} deps</span>
				) : null}
			</div>
		</Link>
	);
}
