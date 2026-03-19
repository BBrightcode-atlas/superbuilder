import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	onError?: (error: Error) => void;
	resetKey?: string | number;
}

interface State {
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error): void {
		this.props.onError?.(error);
	}

	componentDidUpdate(prevProps: Props): void {
		if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
			this.setState({ error: null });
		}
	}

	render() {
		if (this.state.error) {
			return (
				<div className="p-8 font-mono text-sm">
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
						<p className="font-bold text-destructive mb-2">Render Error</p>
						<pre className="text-destructive/80 whitespace-pre-wrap text-xs">
							{this.state.error.message}
						</pre>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
