import { atom } from "jotai";

export type SidebarTab = "workspace" | "task" | "ui" | "features" | "builder";
export const activeSidebarTabAtom = atom<SidebarTab>("workspace");
