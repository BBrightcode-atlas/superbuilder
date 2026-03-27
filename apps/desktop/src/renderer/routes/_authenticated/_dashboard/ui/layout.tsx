import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/_dashboard/ui")({
	component: UiLayout,
});

const GALLERY_BASE_URL = "https://superbuilder-ui.vercel.app/";

function UiLayout() {
	const location = useLocation();
	const isGallery = location.pathname.startsWith("/ui/gallery");
	const [iframeReady, setIframeReady] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const gallerySrc = useMemo(() => {
		const isDark = document.documentElement.classList.contains("dark");
		return `${GALLERY_BASE_URL}?theme=${isDark ? "dark" : "light"}`;
	}, []);

	return (
		<div className="relative flex-1 overflow-hidden">
			{/* Gallery iframe — always mounted, hidden via CSS when not active */}
			<iframe
				ref={iframeRef}
				src={gallerySrc}
				className="absolute inset-0 w-full h-full border-0 bg-background"
				style={{
					visibility: isGallery && iframeReady ? "visible" : "hidden",
				}}
				title="UI Gallery"
				onLoad={() => setIframeReady(true)}
			/>
			{/* Loading indicator while iframe loads */}
			{isGallery && !iframeReady && (
				<div className="absolute inset-0 flex items-center justify-center bg-background">
					<div className="flex flex-col items-center gap-3 text-muted-foreground">
						<div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
						<span className="text-sm">Loading Gallery...</span>
					</div>
				</div>
			)}
			{/* Other child routes render on top */}
			{!isGallery && (
				<div className="relative z-10 h-full overflow-auto">
					<Outlet />
				</div>
			)}
		</div>
	);
}
