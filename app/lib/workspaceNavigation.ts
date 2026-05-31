export type WorkspaceModuleId =
  | "command-center"
  | "action-tracker"
  | "inspections"
  | "risk-assessments"
  | "training-management"
  | "incident-management"
  | "hse-analytics"
  | "settings";

export type WorkspaceNavigationIntent =
  | {
      id: string;
      moduleId: "action-tracker";
      action: "filter-open" | "filter-overdue" | "new" | "open-record";
      recordId?: string;
    }
  | {
      id: string;
      moduleId: "risk-assessments";
      action: "filter-high" | "new" | "open-record";
      recordId?: string;
    }
  | {
      id: string;
      moduleId: "incident-management";
      action: "filter-active" | "new" | "open-record";
      recordId?: string;
    }
  | {
      id: string;
      moduleId: "training-management";
      action: "compliance" | "new-record";
    }
  | {
      id: string;
      moduleId: "inspections";
      action: "new" | "history";
      recordId?: string;
    }
  | {
      id: string;
      moduleId: "settings";
      action: "billing" | "ai-intelligence";
    };

export type WorkspaceNavigationRequest =
  WorkspaceNavigationIntent extends infer Intent
    ? Intent extends WorkspaceNavigationIntent
      ? Omit<Intent, "id">
      : never
    : never;

export const createWorkspaceNavigationIntent = (
  intent: WorkspaceNavigationRequest,
): WorkspaceNavigationIntent => ({
  ...intent,
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
});
