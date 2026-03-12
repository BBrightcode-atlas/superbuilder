// Module
export { BookmarkModule } from "./bookmark.module";

// Controller
export { BookmarkController } from "./controller";

// tRPC Router
export { bookmarkRouter } from "./trpc";
export type { BookmarkRouter } from "./trpc";

// Services
export { BookmarkService } from "./service";

// Schema - centralized in @superbuilder/features-db
// Use: import { bookmarks } from "@superbuilder/features-db"
