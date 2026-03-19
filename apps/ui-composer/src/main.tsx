import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PreviewRoot } from "./components/PreviewRoot";
import { startListening, stopListening } from "./messaging/handler";
import { registerModule } from "./renderer/module-registry";
import { sendToParent } from "./messaging/protocol";
import type { ParentMessage } from "./messaging/protocol";
import "./styles/globals.css";

function App() {
	const [code, setCode] = useState<string | null>(null);
	const [theme, setTheme] = useState<"dark" | "light">("dark");

	const handleMessage = useCallback((message: ParentMessage) => {
		switch (message.type) {
			case "render":
				setCode(message.code);
				setTheme(message.theme);
				break;
			case "moduleResolved":
				registerModule(message.path, message.exports);
				setCode((prev) => (prev ? `${prev} ` : prev));
				break;
			case "themeChange":
				setTheme(message.theme);
				break;
		}
	}, []);

	useEffect(() => {
		startListening(handleMessage);
		sendToParent({ type: "ready" });
		return () => stopListening();
	}, [handleMessage]);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.classList.toggle("light", theme === "light");
	}, [theme]);

	return <PreviewRoot code={code} />;
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
