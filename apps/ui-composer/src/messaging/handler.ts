import type { ParentMessage } from "./protocol";

type MessageCallback = (message: ParentMessage) => void;

let listener: ((event: MessageEvent) => void) | null = null;

export function startListening(callback: MessageCallback): void {
	stopListening();
	listener = (event: MessageEvent) => {
		const data = event.data;
		if (data && typeof data.type === "string") {
			callback(data as ParentMessage);
		}
	};
	window.addEventListener("message", listener);
}

export function stopListening(): void {
	if (listener) {
		window.removeEventListener("message", listener);
		listener = null;
	}
}
