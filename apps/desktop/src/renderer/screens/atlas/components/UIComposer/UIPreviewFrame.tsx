import { cn } from "@superset/ui/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentTreeNode } from "./types";

export type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
	mobile: 375,
	tablet: 768,
	desktop: 0, // 0 = full width
};

const PREVIEW_ORIGIN = "http://localhost:4100";

interface UIPreviewFrameProps {
	code: string;
	viewport?: Viewport;
	className?: string;
	onTreeReady?: (tree: ComponentTreeNode[]) => void;
	onResolveImport?: (path: string) => void;
}

export function UIPreviewFrame({
	code,
	viewport = "desktop",
	className,
	onTreeReady,
	onResolveImport,
}: UIPreviewFrameProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [ready, setReady] = useState(false);
	const [renderError, setRenderError] = useState<string | null>(null);

	// Send render message when code changes and iframe is ready
	const sendRender = useCallback((jsxCode: string) => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		iframe.contentWindow.postMessage(
			{ type: "render", code: jsxCode, theme: "dark" },
			PREVIEW_ORIGIN,
		);
	}, []);

	// Send viewport width
	const sendViewport = useCallback((vp: Viewport) => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		const width = VIEWPORT_WIDTHS[vp];
		if (width > 0) {
			iframe.contentWindow.postMessage(
				{ type: "viewport", width },
				PREVIEW_ORIGIN,
			);
		}
	}, []);

	// Listen for messages from preview iframe
	useEffect(() => {
		function handleMessage(e: MessageEvent) {
			if (e.origin !== PREVIEW_ORIGIN) return;

			const data = e.data;
			if (!data?.type) return;

			switch (data.type) {
				case "ready":
					setReady(true);
					break;
				case "componentTree":
					if (data.tree && onTreeReady) {
						onTreeReady(data.tree);
					}
					break;
				case "resolveImport":
					if (data.path && onResolveImport) {
						onResolveImport(data.path);
					}
					break;
				case "renderStatus":
					if (data.status === "error") {
						setRenderError(data.error ?? "Unknown render error");
					} else {
						setRenderError(null);
					}
					break;
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [onTreeReady, onResolveImport]);

	// Send code when ready or code changes
	useEffect(() => {
		if (ready && code) {
			setRenderError(null);
			sendRender(code);
		}
	}, [ready, code, sendRender]);

	// Send viewport changes
	useEffect(() => {
		if (ready) {
			sendViewport(viewport);
		}
	}, [ready, viewport, sendViewport]);

	const viewportWidth = VIEWPORT_WIDTHS[viewport];

	return (
		<div
			className={cn(
				"flex-1 flex items-start justify-center overflow-auto bg-black/20 p-4",
				className,
			)}
		>
			<iframe
				ref={iframeRef}
				title="UI Preview"
				src={PREVIEW_ORIGIN}
				className="bg-background rounded-lg border border-border shadow-lg"
				style={{
					width: viewportWidth > 0 ? `${viewportWidth}px` : "100%",
					maxWidth: "100%",
					height: "100%",
					minHeight: "500px",
				}}
			/>
			{renderError && (
				<div className="absolute bottom-4 left-4 right-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-mono whitespace-pre-wrap max-h-[120px] overflow-auto">
					{renderError}
				</div>
			)}
		</div>
	);
}
