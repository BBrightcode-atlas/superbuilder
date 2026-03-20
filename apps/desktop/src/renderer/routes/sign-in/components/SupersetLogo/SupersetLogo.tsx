import { COMPANY } from "@superset/shared/constants";
import { cn } from "@superset/ui/utils";

interface SupersetLogoProps {
	className?: string;
}

export function SupersetLogo({ className }: SupersetLogoProps) {
	return (
		<div
			className={cn(
				"font-mono text-4xl font-black uppercase tracking-[0.2em] text-foreground",
				className,
			)}
			aria-label={COMPANY.NAME}
		>
			{COMPANY.NAME}
		</div>
	);
}
