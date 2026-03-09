import path from "node:path";
import { observable } from "@trpc/server/observable";
import type { FileSystemChangeEvent } from "shared/file-tree-types";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import {
	readWorkspaceDirectory,
	searchWorkspaceFiles,
	searchWorkspaceFilesMulti,
	searchWorkspaceKeyword,
	watchWorkspaceFileSystemEvents,
	workspaceFsService,
} from "../workspace-fs-service";

function isClosedStreamError(error: unknown): boolean {
	return (
		error instanceof TypeError &&
		"code" in error &&
		error.code === "ERR_INVALID_STATE"
	);
}

export const createFilesystemRouter = () => {
	return router({
		readDirectory: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					absolutePath: z.string(),
				}),
			)
			.query(async ({ input }) => {
				try {
					return await readWorkspaceDirectory(input);
				} catch (error) {
					console.error("[filesystem/readDirectory] Failed:", {
						workspaceId: input.workspaceId,
						absolutePath: input.absolutePath,
						error,
					});
					return [];
				}
			}),

		subscribe: publicProcedure
			.input(z.object({ workspaceId: z.string() }))
			.subscription(({ input }) => {
				return observable<FileSystemChangeEvent>((emit) => {
					let isDisposed = false;
					const stream = watchWorkspaceFileSystemEvents(input.workspaceId);
					const iterator = stream[Symbol.asyncIterator]();

					const runCleanup = () => {
						isDisposed = true;
						void iterator.return?.();
					};

					const safeNext = (event: FileSystemChangeEvent) => {
						if (isDisposed) {
							return;
						}

						try {
							emit.next(event);
						} catch (error) {
							if (isClosedStreamError(error)) {
								runCleanup();
								return;
							}

							throw error;
						}
					};

					void (async () => {
						try {
							while (!isDisposed) {
								const next = await iterator.next();
								if (next.done) {
									return;
								}

								const event = next.value;
								if (isDisposed) {
									return;
								}
								safeNext(event);
							}
						} catch (error) {
							console.error("[filesystem/subscribe] Failed:", {
								workspaceId: input.workspaceId,
								error,
							});
							safeNext({
								type: "overflow",
								revision: 0,
							});
						}
					})();

					return () => {
						runCleanup();
					};
				});
			}),

		searchFiles: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					query: z.string(),
					includePattern: z.string().default(""),
					excludePattern: z.string().default(""),
					limit: z.number().default(200),
				}),
			)
			.query(async ({ input }) => {
				const { workspaceId, query, includePattern, excludePattern, limit } =
					input;
				const trimmedQuery = query.trim();

				if (!trimmedQuery) {
					return [];
				}

				try {
					return await searchWorkspaceFiles({
						workspaceId,
						query: trimmedQuery,
						includePattern,
						excludePattern,
						limit,
					});
				} catch (error) {
					console.error("[filesystem/searchFiles] Failed:", {
						workspaceId,
						query,
						error,
					});
					return [];
				}
			}),

		searchFilesMulti: publicProcedure
			.input(
				z.object({
					roots: z.array(
						z.object({
							rootPath: z.string(),
							workspaceId: z.string(),
							workspaceName: z.string(),
						}),
					),
					query: z.string(),
					includePattern: z.string().default(""),
					excludePattern: z.string().default(""),
					limit: z.number().default(50),
				}),
			)
			.query(async ({ input }) => {
				const { roots, query, includePattern, excludePattern, limit } = input;
				const trimmedQuery = query.trim();

				if (!trimmedQuery || roots.length === 0) {
					return [];
				}

				try {
					return await searchWorkspaceFilesMulti({
						roots,
						query: trimmedQuery,
						includePattern,
						excludePattern,
						limit,
					});
				} catch (error) {
					console.error("[filesystem/searchFilesMulti] Failed:", {
						query,
						error,
					});
					return [];
				}
			}),

		searchKeyword: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					query: z.string(),
					includePattern: z.string().default(""),
					excludePattern: z.string().default(""),
					limit: z.number().default(200),
				}),
			)
			.query(async ({ input }) => {
				const { workspaceId, query, includePattern, excludePattern, limit } =
					input;
				const trimmedQuery = query.trim();

				if (!trimmedQuery) {
					return [];
				}

				try {
					return await searchWorkspaceKeyword({
						workspaceId,
						query: trimmedQuery,
						includePattern,
						excludePattern,
						limit,
					});
				} catch (error) {
					console.error("[filesystem/searchKeyword] Failed:", {
						workspaceId,
						query,
						error,
					});
					return [];
				}
			}),

		createFile: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					parentAbsolutePath: z.string(),
					name: z.string(),
					content: z.string().default(""),
				}),
			)
			.mutation(async ({ input }) => {
				const result = await workspaceFsService.createFile({
					workspaceId: input.workspaceId,
					absolutePath: path.join(input.parentAbsolutePath, input.name),
					content: input.content,
				});
				return { path: result.absolutePath };
			}),

		createDirectory: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					parentAbsolutePath: z.string(),
					name: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const result = await workspaceFsService.createDirectory({
					workspaceId: input.workspaceId,
					absolutePath: path.join(input.parentAbsolutePath, input.name),
				});
				return { path: result.absolutePath };
			}),

		rename: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					absolutePath: z.string(),
					newName: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const result = await workspaceFsService.rename({
					workspaceId: input.workspaceId,
					absolutePath: input.absolutePath,
					newName: input.newName,
				});
				return {
					oldPath: result.oldAbsolutePath,
					newPath: result.newAbsolutePath,
				};
			}),

		delete: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					absolutePaths: z.array(z.string()),
					permanent: z.boolean().default(false),
				}),
			)
			.mutation(async ({ input }) => {
				const result = await workspaceFsService.deletePaths({
					workspaceId: input.workspaceId,
					absolutePaths: input.absolutePaths,
					permanent: input.permanent,
				});

				return {
					deleted: result.deleted,
					errors: result.errors.map((error) => ({
						path: error.absolutePath,
						error: error.error,
					})),
				};
			}),

		move: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					sourceAbsolutePaths: z.array(z.string()),
					destinationAbsolutePath: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const result = await workspaceFsService.movePaths({
					workspaceId: input.workspaceId,
					absolutePaths: input.sourceAbsolutePaths,
					destinationAbsolutePath: input.destinationAbsolutePath,
				});

				return {
					moved: result.entries,
					errors: result.errors.map((error) => ({
						path: error.absolutePath,
						error: error.error,
					})),
				};
			}),

		copy: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					sourceAbsolutePaths: z.array(z.string()),
					destinationAbsolutePath: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const result = await workspaceFsService.copyPaths({
					workspaceId: input.workspaceId,
					absolutePaths: input.sourceAbsolutePaths,
					destinationAbsolutePath: input.destinationAbsolutePath,
				});

				return {
					copied: result.entries,
					errors: result.errors.map((error) => ({
						path: error.absolutePath,
						error: error.error,
					})),
				};
			}),

		exists: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					absolutePath: z.string(),
				}),
			)
			.query(async ({ input }) => {
				return await workspaceFsService.exists({
					workspaceId: input.workspaceId,
					absolutePath: input.absolutePath,
				});
			}),

		stat: publicProcedure
			.input(
				z.object({
					workspaceId: z.string(),
					absolutePath: z.string(),
				}),
			)
			.query(async ({ input }) => {
				try {
					return await workspaceFsService.stat({
						workspaceId: input.workspaceId,
						absolutePath: input.absolutePath,
					});
				} catch {
					return null;
				}
			}),
	});
};
