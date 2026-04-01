"use client";

import type React from "react";

interface OutlitProviderProps {
	children: React.ReactNode;
}

export function OutlitProvider({ children }: OutlitProviderProps) {
	return <>{children}</>;
}
