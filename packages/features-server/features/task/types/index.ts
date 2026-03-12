import type { Profile } from "@superbuilder/features-db";
import type {
  TaskTask,
  TaskProject,
  TaskCycle,
  TaskLabel,
  TaskComment,
  TaskActivity,
} from "@superbuilder/features-db";

export interface TaskWithRelations extends TaskTask {
  assignee: Profile | null;
  createdBy: Profile;
  project: TaskProject | null;
  cycle: TaskCycle | null;
  labels: TaskLabel[];
  subtaskCount: number;
  completedSubtaskCount: number;
  commentCount: number;
}

export interface TaskListResult {
  tasks: TaskWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskDetailResult extends TaskWithRelations {
  subtasks: TaskTask[];
}

export interface CommentWithAuthor extends TaskComment {
  author: Profile;
}

export interface ActivityWithActor extends TaskActivity {
  actor: Profile;
}
