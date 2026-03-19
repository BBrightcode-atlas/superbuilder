interface ErrorOverlayProps {
	error: string;
}

export function ErrorOverlay({ error }: ErrorOverlayProps) {
	return (
		<div className="p-8 font-mono text-sm">
			<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
				<p className="font-bold text-destructive mb-2">Error</p>
				<pre className="text-destructive/80 whitespace-pre-wrap text-xs">
					{error}
				</pre>
			</div>
		</div>
	);
}
