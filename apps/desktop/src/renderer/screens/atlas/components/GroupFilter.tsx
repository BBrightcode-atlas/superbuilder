import { cn } from "@superset/ui/utils";

interface GroupFilterProps {
	groups: Array<{ id: string; label: string }>;
	activeGroup: string | null;
	onGroupChange: (group: string | null) => void;
}

export function GroupFilter({
	groups,
	activeGroup,
	onGroupChange,
}: GroupFilterProps) {
	return (
		<div className="flex items-center gap-1 flex-wrap">
			<button
				type="button"
				onClick={() => onGroupChange(null)}
				className={cn(
					"px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
					activeGroup === null
						? "bg-primary text-primary-foreground"
						: "bg-muted text-muted-foreground hover:text-foreground",
				)}
			>
				전체
			</button>
			{groups.map((group) => (
				<button
					key={group.id}
					type="button"
					onClick={() => onGroupChange(group.id)}
					className={cn(
						"px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
						activeGroup === group.id
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:text-foreground",
					)}
				>
					{group.label}
				</button>
			))}
		</div>
	);
}
