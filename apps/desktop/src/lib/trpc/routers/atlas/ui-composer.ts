import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { publicProcedure, router } from "../..";

const PROMPT_DIR = join(tmpdir(), "superbuilder-ui-composer");

const MCP_URL = "https://superbuilder-ui.vercel.app/mcp";

/** Lightweight MCP JSON-RPC caller for superbuilder-mcp */
async function callMcp(method: string, params: Record<string, unknown>) {
	const body = JSON.stringify({
		jsonrpc: "2.0",
		method,
		params,
		id: Date.now(),
	});

	const res = await fetch(MCP_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
		},
		body,
	});

	const contentType = res.headers.get("content-type") ?? "";

	if (contentType.includes("application/json")) {
		const json = await res.json();
		return json.result ?? json;
	}

	const text = await res.text();
	for (const line of text.split("\n")) {
		if (line.startsWith("data: ")) {
			try {
				const parsed = JSON.parse(line.slice(6));
				if (parsed.result) return parsed.result;
			} catch {
				// skip non-JSON data lines
			}
		}
	}

	return null;
}

export const createAtlasUIComposerRouter = () =>
	router({
		/** Search superbuilder-mcp component catalog */
		searchComponents: publicProcedure
			.input(
				z.object({
					query: z.string().min(1),
					maxResults: z.number().default(30),
				}),
			)
			.query(async ({ input }) => {
				try {
					const result = await callMcp("tools/call", {
						name: "get_catalog",
						arguments: {
							queryHint: input.query,
							assetTypes: ["component"],
							maxResults: input.maxResults,
						},
					});

					const content = result?.content?.[0]?.text;
					if (!content) return { assets: [], total: 0 };

					const parsed = JSON.parse(content);
					return {
						assets: parsed.assets ?? [],
						total: parsed.summary?.filteredTotal ?? 0,
					};
				} catch (err) {
					console.error("[ui-composer] MCP search failed:", err);
					return { assets: [], total: 0 };
				}
			}),

		/** Fetch component source code bundle */
		getComponentBundle: publicProcedure
			.input(
				z.object({
					assetIds: z.array(z.string()).min(1),
				}),
			)
			.query(async ({ input }) => {
				try {
					const result = await callMcp("tools/call", {
						name: "get_asset_bundle",
						arguments: {
							assetIds: input.assetIds,
							maxFiles: 30,
						},
					});

					const content = result?.content?.[0]?.text;
					if (!content) return { files: [], packages: [] };

					const parsed = JSON.parse(content);
					return {
						files: parsed.files ?? [],
						packages: parsed.externalPackages ?? [],
					};
				} catch (err) {
					console.error("[ui-composer] MCP bundle failed:", err);
					return { files: [], packages: [] };
				}
			}),

		/** Build prompt and save to temp file for terminal agent execution */
		buildPrompt: publicProcedure
			.input(
				z.object({
					request: z.string().min(1),
					componentContext: z.string().optional(),
					existingCode: z.string().optional(),
				}),
			)
			.mutation(({ input }) => {
				const prompt = input.existingCode
					? buildRefinementPrompt(
							input.request,
							input.existingCode,
							input.componentContext,
						)
					: buildUIGenerationPrompt(input.request, input.componentContext);
				mkdirSync(PROMPT_DIR, { recursive: true });
				const fileName = `prompt-${Date.now()}.md`;
				const filePath = join(PROMPT_DIR, fileName);
				writeFileSync(filePath, prompt, "utf-8");
				return { prompt, promptFilePath: filePath };
			}),

		/** Extract tab-structured code from raw agent output */
		extractTabs: publicProcedure
			.input(z.object({ rawOutput: z.string() }))
			.mutation(({ input }) => {
				return { tabs: parseTabsFromOutput(input.rawOutput) };
			}),
	});

/** Available shadcn/ui components in the preview environment */
const AVAILABLE_COMPONENTS = [
	"Accordion, AccordionContent, AccordionItem, AccordionTrigger",
	"AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger",
	"AspectRatio",
	"Avatar, AvatarFallback, AvatarImage",
	"Badge, badgeVariants",
	"Button, buttonVariants",
	"Calendar",
	"Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle",
	"Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious",
	"Checkbox",
	"Collapsible, CollapsibleContent, CollapsibleTrigger",
	"Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut",
	"ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger",
	"Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger",
	"Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger",
	"DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger",
	"Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage",
	"HoverCard, HoverCardContent, HoverCardTrigger",
	"Input",
	"InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot",
	"Label",
	"Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger",
	"NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger",
	"Popover, PopoverContent, PopoverTrigger",
	"Progress",
	"RadioGroup, RadioGroupItem",
	"ScrollArea, ScrollBar",
	"Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue",
	"Separator",
	"Slider",
	"Switch",
	"Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow",
	"Tabs, TabsContent, TabsList, TabsTrigger",
	"Textarea",
	"Toggle, toggleVariants",
	"ToggleGroup, ToggleGroupItem",
	"Tooltip, TooltipContent, TooltipProvider, TooltipTrigger",
].join("\n");

/** Design system rules for standard JSX prompts */
const DESIGN_SYSTEM_RULES = `=== ENVIRONMENT ===
The preview renders REAL React + Tailwind CSS v4 + shadcn/ui components.
All Tailwind classes work natively. shadcn/ui components are fully interactive (Dialog opens, Select drops down, etc).

=== IMPORT RULES ===
Write standard JSX with named imports. Available import sources:

1. shadcn/ui components — import from "@/components/ui/{name}"
   Example: import { Button } from "@/components/ui/button"
   Example: import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

2. Icons — import from "lucide-react"
   Example: import { Search, Settings, ChevronRight } from "lucide-react"

3. React — import from "react"
   Example: import { useState, useEffect } from "react"

Available shadcn/ui components:
${AVAILABLE_COMPONENTS}

=== CODE FORMAT ===
- Write standard JSX (NOT React.createElement)
- Use TypeScript-compatible syntax
- Export a default component as the entry point
- Use functional components with hooks

=== COMPONENT TREE ===
Add data-component="ComponentName" to every semantic wrapper div.
This builds a Figma-like component tree in the sidebar.

Example:
<div data-component="PricingCard" className="...">
  <div data-component="PricingHeader" className="...">
    <CardTitle>Pro Plan</CardTitle>
  </div>
</div>

=== DESIGN GUIDELINES ===
COLOR PALETTE (shadcn semantic tokens):
- Backgrounds: bg-background, bg-card, bg-muted, bg-primary, bg-secondary, bg-accent, bg-popover
- Text: text-foreground, text-muted-foreground, text-primary-foreground
- Borders: border-border, border-input
- Accents: text-emerald-500, text-blue-500, text-violet-500, text-amber-500, text-rose-500

LAYOUT PATTERNS:
- Page container: min-h-screen bg-background
- Content wrapper: max-w-5xl mx-auto px-6
- Section spacing: space-y-6
- Grid: grid grid-cols-1 md:grid-cols-3 gap-4

TYPOGRAPHY:
- Page title: text-2xl font-bold tracking-tight
- Section title: text-lg font-semibold
- Body: text-sm text-foreground
- Muted: text-sm text-muted-foreground
- Stat number: text-3xl font-bold tabular-nums

IMPORTANT:
- Use shadcn components, NOT raw HTML elements (Button not <button>, Input not <input>)
- Make the UI beautiful, polished, production-quality
- Use interactive elements (useState for tabs, toggles, form steps)
- Always use consistent padding and rounded corners`;

/** Build the prompt that instructs the CLI agent to generate preview code */
function buildUIGenerationPrompt(
	request: string,
	componentContext?: string,
): string {
	const parts = [
		"You are a UI code generator for a live preview sandbox with real shadcn/ui components.",
		"Generate ONLY valid JSX/TSX code. No markdown, no explanation, no ```.",
		"",
		DESIGN_SYSTEM_RULES,
		"",
		"=== MULTI-SCREEN RULES ===",
		"If the user requests multiple screens/pages, output each as a separate block:",
		"",
		"// [TAB:ScreenName]",
		'import { Button } from "@/components/ui/button";',
		"// ... other imports",
		"export default function App() { /* ... */ }",
		"// [/TAB:ScreenName]",
		"",
		"// [TAB:AnotherScreen]",
		'import { Card } from "@/components/ui/card";',
		"export default function App() { /* ... */ }",
		"// [/TAB:AnotherScreen]",
		"",
		"Each TAB block MUST have its own imports and export default function.",
		"For a single screen, just output the code directly (no TAB markers needed).",
		"",
		"=== EXAMPLE OUTPUT (single screen) ===",
		'import { useState } from "react";',
		'import { Button } from "@/components/ui/button";',
		'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";',
		'import { Badge } from "@/components/ui/badge";',
		'import { Input } from "@/components/ui/input";',
		'import { Search } from "lucide-react";',
		"",
		"export default function App() {",
		"  const [query, setQuery] = useState('');",
		"  return (",
		'    <div data-component="Dashboard" className="min-h-screen bg-background p-6">',
		'      <div className="max-w-5xl mx-auto space-y-6">',
		'        <div data-component="SearchBar" className="flex gap-2">',
		'          <Input placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)} />',
		'          <Button><Search className="size-4 mr-2" />Search</Button>',
		"        </div>",
		'        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">',
		'          <Card data-component="StatCard">',
		"            <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>",
		'            <CardContent><span className="text-3xl font-bold tabular-nums">$12,345</span></CardContent>',
		"          </Card>",
		"        </div>",
		"      </div>",
		"    </div>",
		"  );",
		"}",
		"",
		"=== USER REQUEST ===",
		request,
	];

	if (componentContext) {
		parts.push(
			"",
			"=== AVAILABLE COMPONENTS (from MCP catalog) ===",
			componentContext,
		);
	}

	return parts.join("\n");
}

/** Extract JS code block from potential markdown-wrapped response */
function extractCodeBlock(raw: string): string {
	const match = raw.match(
		/```(?:tsx?|jsx?|javascript|typescript)?\s*\n([\s\S]*?)```/,
	);
	if (match?.[1]) return match[1].trim();

	const trimmed = raw.trim();
	if (
		trimmed.startsWith("import ") ||
		trimmed.startsWith("export ") ||
		trimmed.startsWith("function ") ||
		trimmed.startsWith("const ") ||
		trimmed.startsWith("//")
	) {
		return trimmed;
	}

	return trimmed;
}

/** Build a refinement prompt that modifies existing code */
function buildRefinementPrompt(
	instruction: string,
	existingCode: string,
	componentContext?: string,
): string {
	const parts = [
		"You are a UI code refiner. You have existing working code and a user instruction to modify it.",
		"Output ONLY the complete modified code. No markdown, no explanation, no ```.",
		"Keep all existing functionality unless told to remove it.",
		"",
		DESIGN_SYSTEM_RULES,
		"",
		"IMPORTANT:",
		"- Preserve TAB markers if present (multi-screen)",
		"- Keep all data-component attributes. Add them to any NEW semantic elements.",
		"- Keep all imports. Add new imports as needed.",
		"",
		"=== EXISTING CODE ===",
		existingCode,
		"",
		"=== USER INSTRUCTION ===",
		instruction,
	];

	if (componentContext) {
		parts.push(
			"",
			"=== AVAILABLE COMPONENTS (from MCP catalog) ===",
			componentContext,
		);
	}

	return parts.join("\n");
}

/** Parse multi-tab output from agent response */
function parseTabsFromOutput(
	raw: string,
): Array<{ name: string; code: string }> {
	// 1. TAB marker-based parsing
	const tabRegex = /\/\/ \[TAB:(.+?)\]([\s\S]*?)\/\/ \[\/TAB:\1\]/g;
	const tabs = [...raw.matchAll(tabRegex)].map((m) => ({
		name: m[1],
		code: m[2].trim(),
	}));
	if (tabs.length > 0) return tabs;

	// 2. Fallback: single code block
	const code = extractCodeBlock(raw);
	return code ? [{ name: "Preview", code }] : [];
}
