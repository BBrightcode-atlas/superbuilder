import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../renderer/error-boundary";
import { executeCode } from "../renderer/code-executor";
import { extractComponentTree } from "../tree/dom-walker";
import { sendToParent } from "../messaging/protocol";
import { ErrorOverlay } from "./ErrorOverlay";

interface PreviewRootProps {
	code: string | null;
}

export function PreviewRoot({ code }: PreviewRootProps) {
	const [result, setResult] = useState<{
		Component: React.ComponentType | null;
		error: string | null;
	}>({ Component: null, error: null });
	const rootRef = useRef<HTMLDivElement>(null);
	const [renderKey, setRenderKey] = useState(0);

	useEffect(() => {
		if (!code) return;

		const execResult = executeCode(code);

		if (execResult.unresolvedImports.length > 0) {
			for (const path of execResult.unresolvedImports) {
				sendToParent({ type: "resolveImport", path });
			}
			setResult({
				Component: null,
				error: `Resolving imports: ${execResult.unresolvedImports.join(", ")}`,
			});
			return;
		}

		if (execResult.error) {
			setResult({ Component: null, error: execResult.error });
			sendToParent({
				type: "renderStatus",
				status: "error",
				error: execResult.error,
			});
			return;
		}

		setResult({ Component: execResult.Component, error: null });
		setRenderKey((k) => k + 1);
	}, [code]);

	useEffect(() => {
		if (!result.Component || !rootRef.current) return;

		const timer = setTimeout(() => {
			if (rootRef.current) {
				const tree = extractComponentTree(rootRef.current);
				sendToParent({ type: "componentTree", tree });
				sendToParent({ type: "renderStatus", status: "success" });
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [result.Component, renderKey]);

	const handleRenderError = useCallback((error: Error) => {
		sendToParent({
			type: "renderStatus",
			status: "error",
			error: error.message,
		});
	}, []);

	if (!code) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p className="text-muted-foreground text-sm">
					Waiting for code...
				</p>
			</div>
		);
	}

	if (result.error) {
		return <ErrorOverlay error={result.error} />;
	}

	if (!result.Component) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p className="text-muted-foreground text-sm animate-pulse">
					Loading...
				</p>
			</div>
		);
	}

	const { Component } = result;

	return (
		<ErrorBoundary onError={handleRenderError} resetKey={renderKey}>
			<div ref={rootRef}>
				<Component />
			</div>
		</ErrorBoundary>
	);
}
