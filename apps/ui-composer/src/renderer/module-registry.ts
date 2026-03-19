import * as React from "react";
import * as AccordionMod from "@/components/ui/accordion";
import * as AlertDialogMod from "@/components/ui/alert-dialog";
import * as AlertMod from "@/components/ui/alert";
import * as AspectRatioMod from "@/components/ui/aspect-ratio";
import * as AvatarMod from "@/components/ui/avatar";
import * as BadgeMod from "@/components/ui/badge";
import * as BreadcrumbMod from "@/components/ui/breadcrumb";
import * as ButtonGroupMod from "@/components/ui/button-group";
import * as ButtonMod from "@/components/ui/button";
import * as CalendarMod from "@/components/ui/calendar";
import * as CardMod from "@/components/ui/card";
import * as CarouselMod from "@/components/ui/carousel";
import * as ChartMod from "@/components/ui/chart";
import * as CheckboxMod from "@/components/ui/checkbox";
import * as CollapsibleMod from "@/components/ui/collapsible";
import * as CommandMod from "@/components/ui/command";
import * as ContextMenuMod from "@/components/ui/context-menu";
import * as DialogMod from "@/components/ui/dialog";
import * as DrawerMod from "@/components/ui/drawer";
import * as DropdownMenuMod from "@/components/ui/dropdown-menu";
import * as EmptyMod from "@/components/ui/empty";
import * as FieldMod from "@/components/ui/field";
import * as FormMod from "@/components/ui/form";
import * as HoverCardMod from "@/components/ui/hover-card";
import * as InputGroupMod from "@/components/ui/input-group";
import * as InputOtpMod from "@/components/ui/input-otp";
import * as InputMod from "@/components/ui/input";
import * as ItemMod from "@/components/ui/item";
import * as KbdMod from "@/components/ui/kbd";
import * as LabelMod from "@/components/ui/label";
import * as MenubarMod from "@/components/ui/menubar";
import * as NavigationMenuMod from "@/components/ui/navigation-menu";
import * as PaginationMod from "@/components/ui/pagination";
import * as PopoverMod from "@/components/ui/popover";
import * as ProgressMod from "@/components/ui/progress";
import * as RadioGroupMod from "@/components/ui/radio-group";
import * as ResizableMod from "@/components/ui/resizable";
import * as ScrollAreaMod from "@/components/ui/scroll-area";
import * as SelectMod from "@/components/ui/select";
import * as SeparatorMod from "@/components/ui/separator";
import * as SheetMod from "@/components/ui/sheet";
import * as SidebarCardMod from "@/components/ui/sidebar-card";
import * as SidebarMod from "@/components/ui/sidebar";
import * as SkeletonMod from "@/components/ui/skeleton";
import * as SliderMod from "@/components/ui/slider";
import * as SonnerMod from "@/components/ui/sonner";
import * as SpinnerMod from "@/components/ui/spinner";
import * as SwitchMod from "@/components/ui/switch";
import * as TableMod from "@/components/ui/table";
import * as TabsMod from "@/components/ui/tabs";
import * as TextareaMod from "@/components/ui/textarea";
import * as ToggleGroupMod from "@/components/ui/toggle-group";
import * as ToggleMod from "@/components/ui/toggle";
import * as TooltipMod from "@/components/ui/tooltip";

type ModuleExports = Record<string, unknown>;

const STATIC_MODULES: Record<string, ModuleExports> = {
	react: React as unknown as ModuleExports,
	"@/components/ui/accordion": AccordionMod as unknown as ModuleExports,
	"@/components/ui/alert-dialog": AlertDialogMod as unknown as ModuleExports,
	"@/components/ui/alert": AlertMod as unknown as ModuleExports,
	"@/components/ui/aspect-ratio": AspectRatioMod as unknown as ModuleExports,
	"@/components/ui/avatar": AvatarMod as unknown as ModuleExports,
	"@/components/ui/badge": BadgeMod as unknown as ModuleExports,
	"@/components/ui/breadcrumb": BreadcrumbMod as unknown as ModuleExports,
	"@/components/ui/button-group": ButtonGroupMod as unknown as ModuleExports,
	"@/components/ui/button": ButtonMod as unknown as ModuleExports,
	"@/components/ui/calendar": CalendarMod as unknown as ModuleExports,
	"@/components/ui/card": CardMod as unknown as ModuleExports,
	"@/components/ui/carousel": CarouselMod as unknown as ModuleExports,
	"@/components/ui/chart": ChartMod as unknown as ModuleExports,
	"@/components/ui/checkbox": CheckboxMod as unknown as ModuleExports,
	"@/components/ui/collapsible": CollapsibleMod as unknown as ModuleExports,
	"@/components/ui/command": CommandMod as unknown as ModuleExports,
	"@/components/ui/context-menu": ContextMenuMod as unknown as ModuleExports,
	"@/components/ui/dialog": DialogMod as unknown as ModuleExports,
	"@/components/ui/drawer": DrawerMod as unknown as ModuleExports,
	"@/components/ui/dropdown-menu": DropdownMenuMod as unknown as ModuleExports,
	"@/components/ui/empty": EmptyMod as unknown as ModuleExports,
	"@/components/ui/field": FieldMod as unknown as ModuleExports,
	"@/components/ui/form": FormMod as unknown as ModuleExports,
	"@/components/ui/hover-card": HoverCardMod as unknown as ModuleExports,
	"@/components/ui/input-group": InputGroupMod as unknown as ModuleExports,
	"@/components/ui/input-otp": InputOtpMod as unknown as ModuleExports,
	"@/components/ui/input": InputMod as unknown as ModuleExports,
	"@/components/ui/item": ItemMod as unknown as ModuleExports,
	"@/components/ui/kbd": KbdMod as unknown as ModuleExports,
	"@/components/ui/label": LabelMod as unknown as ModuleExports,
	"@/components/ui/menubar": MenubarMod as unknown as ModuleExports,
	"@/components/ui/navigation-menu": NavigationMenuMod as unknown as ModuleExports,
	"@/components/ui/pagination": PaginationMod as unknown as ModuleExports,
	"@/components/ui/popover": PopoverMod as unknown as ModuleExports,
	"@/components/ui/progress": ProgressMod as unknown as ModuleExports,
	"@/components/ui/radio-group": RadioGroupMod as unknown as ModuleExports,
	"@/components/ui/resizable": ResizableMod as unknown as ModuleExports,
	"@/components/ui/scroll-area": ScrollAreaMod as unknown as ModuleExports,
	"@/components/ui/select": SelectMod as unknown as ModuleExports,
	"@/components/ui/separator": SeparatorMod as unknown as ModuleExports,
	"@/components/ui/sheet": SheetMod as unknown as ModuleExports,
	"@/components/ui/sidebar-card": SidebarCardMod as unknown as ModuleExports,
	"@/components/ui/sidebar": SidebarMod as unknown as ModuleExports,
	"@/components/ui/skeleton": SkeletonMod as unknown as ModuleExports,
	"@/components/ui/slider": SliderMod as unknown as ModuleExports,
	"@/components/ui/sonner": SonnerMod as unknown as ModuleExports,
	"@/components/ui/spinner": SpinnerMod as unknown as ModuleExports,
	"@/components/ui/switch": SwitchMod as unknown as ModuleExports,
	"@/components/ui/table": TableMod as unknown as ModuleExports,
	"@/components/ui/tabs": TabsMod as unknown as ModuleExports,
	"@/components/ui/textarea": TextareaMod as unknown as ModuleExports,
	"@/components/ui/toggle-group": ToggleGroupMod as unknown as ModuleExports,
	"@/components/ui/toggle": ToggleMod as unknown as ModuleExports,
	"@/components/ui/tooltip": TooltipMod as unknown as ModuleExports,
};

/** Dynamic modules registered at runtime (e.g. MCP-fetched components) */
const dynamicModules = new Map<string, ModuleExports>();

/** Resolve a module by import path. Returns null if not found. */
export function resolveModule(path: string): ModuleExports | null {
	return STATIC_MODULES[path] ?? dynamicModules.get(path) ?? null;
}

/** Register a dynamically resolved module (e.g. from parent via postMessage) */
export function registerModule(path: string, exports: ModuleExports): void {
	dynamicModules.set(path, exports);
}

/** Check if a module is available (static or dynamic) */
export function hasModule(path: string): boolean {
	return path in STATIC_MODULES || dynamicModules.has(path);
}
