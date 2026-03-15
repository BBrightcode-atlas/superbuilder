import { createContext, useContext, useState, type ReactNode, createElement } from "react";

export type SidebarTab = "workspace" | "task" | "ui" | "features" | "builder";

interface SidebarTabContextValue {
	activeTab: SidebarTab;
	setActiveTab: (tab: SidebarTab) => void;
}

const SidebarTabContext = createContext<SidebarTabContextValue>({
	activeTab: "workspace",
	setActiveTab: () => {},
});

export function SidebarTabProvider({ children }: { children: ReactNode }) {
	const [activeTab, setActiveTab] = useState<SidebarTab>("workspace");
	return createElement(
		SidebarTabContext.Provider,
		{ value: { activeTab, setActiveTab } },
		children,
	);
}

export function useSidebarTab() {
	return useContext(SidebarTabContext);
}
