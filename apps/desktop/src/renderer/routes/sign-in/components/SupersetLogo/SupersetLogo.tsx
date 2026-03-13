import { cn } from "@superset/ui/utils";
import { APP_DISPLAY_NAME } from "shared/constants";

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
			aria-label={APP_DISPLAY_NAME}
		>
			{APP_DISPLAY_NAME}
		</div>
	);
}
