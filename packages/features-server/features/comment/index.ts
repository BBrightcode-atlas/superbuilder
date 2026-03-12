// Comment Feature - Server exports
export { CommentModule } from "./comment.module";
export { CommentService } from "./service";
export { commentRouter, type CommentRouter } from "./trpc";

// Schema - now centralized in @superbuilder/features-db
// Use: import { comments } from "@superbuilder/features-db"
