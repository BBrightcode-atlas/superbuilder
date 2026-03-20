import { cn } from "@superset/ui/utils";
import { useEffect, useRef } from "react";

interface ActivityPanelProps {
	log: string;
	isGenerating: boolean;
	className?: string;
}

export function ActivityPanel({
	log,
	isGenerating,
	className,
}: ActivityPanelProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	return (
		<div className={cn("flex flex-col overflow-hidden", className)}>
			<div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
				<span className="text-xs font-medium text-muted-foreground">
					Agent Activity
				</span>
				{isGenerating && (
					<span className="flex items-center gap-1.5">
						<span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
						<span className="text-[10px] text-emerald-400">generating</span>
					</span>
				)}
			</div>

			<div className="flex-1 overflow-auto bg-muted/30 p-3">
				{log ? (
					<pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
						{log}
					</pre>
				) : (
					<div className="flex h-full items-center justify-center">
						<p className="text-xs text-muted-foreground">
							Generate를 클릭하면 에이전트 활동이 여기에 표시됩니다
						</p>
					</div>
				)}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}
