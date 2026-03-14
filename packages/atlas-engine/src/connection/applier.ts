import { readFileSync, writeFileSync } from "fs";

/**
 * Insert content before the closing [/ATLAS:{marker}] tag in a file.
 * Does nothing if the marker is not found.
 */
export function insertAtMarker(
	filePath: string,
	marker: string,
	content: string,
): void {
	const text = readFileSync(filePath, "utf-8");
	const closingTag = `[/ATLAS:${marker}]`;
	const idx = text.indexOf(closingTag);

	if (idx === -1) return;

	// Find the start of the line containing the closing tag to preserve indentation
	let lineStart = idx;
	while (lineStart > 0 && text[lineStart - 1] !== "\n") {
		lineStart--;
	}

	const indent = text.slice(lineStart, idx).match(/^(\s*)/)?.[1] ?? "";
	const insertion = `${indent}${content}\n`;

	const updated = text.slice(0, lineStart) + insertion + text.slice(lineStart);
	writeFileSync(filePath, updated);
}
