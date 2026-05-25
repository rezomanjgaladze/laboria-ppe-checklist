export const sourceModuleOptions = [
  "Manual",
  "Inspection",
  "Risk Assessment",
  "Incident",
  "Training",
] as const;

export const priorityOptions = ["Low", "Medium", "High", "Critical"] as const;

export const statusOptions = [
  "Open",
  "In Progress",
  "Pending Verification",
  "Completed",
  "Closed",
] as const;

export type SourceModule = (typeof sourceModuleOptions)[number];
export type ActionPriority = (typeof priorityOptions)[number];
export type ActionStatus = (typeof statusOptions)[number];

export type HseAction = {
  id: string;
  title: string;
  description: string;
  sourceModule: SourceModule;
  priority: ActionPriority;
  responsiblePerson: string;
  department: string;
  siteLocation: string;
  dueDate: string;
  status: ActionStatus;
  progress: number;
  notes: string;
  createdDate: string;
  lastUpdated: string;
  createdBy: string;
  linkedInspectionId?: string;
  linkedRiskAssessmentId?: string;
  linkedIncidentId?: string;
  linkedTrainingGapKey?: string;
};

export type ActionDraftInput = {
  title: string;
  description: string;
  sourceModule: SourceModule;
  priority: ActionPriority;
  responsiblePerson?: string;
  department?: string;
  siteLocation?: string;
  dueDate?: string;
  notes?: string;
  createdBy: string;
  linkedInspectionId?: string;
  linkedRiskAssessmentId?: string;
  linkedIncidentId?: string;
  linkedTrainingGapKey?: string;
};

const legacyStorageKey = "laboria_action_tracker_actions";

export const getActionTrackerStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_action_tracker_actions`
    : legacyStorageKey;

export const getDateInputDaysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const createActionId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
};

const normalizeSourceModule = (value: unknown): SourceModule =>
  sourceModuleOptions.includes(value as SourceModule)
    ? (value as SourceModule)
    : "Manual";

const normalizePriority = (value: unknown): ActionPriority =>
  priorityOptions.includes(value as ActionPriority)
    ? (value as ActionPriority)
    : "Medium";

const normalizeStatus = (value: unknown): ActionStatus =>
  statusOptions.includes(value as ActionStatus)
    ? (value as ActionStatus)
    : "Open";

export const normalizeAction = (action: Partial<HseAction>): HseAction => {
  const now = new Date().toISOString();

  return {
    id:
      typeof action.id === "string" && action.id.trim().length > 0
        ? action.id
        : createActionId(),
    title: typeof action.title === "string" ? action.title : "",
    description:
      typeof action.description === "string" ? action.description : "",
    sourceModule: normalizeSourceModule(action.sourceModule),
    priority: normalizePriority(action.priority),
    responsiblePerson:
      typeof action.responsiblePerson === "string"
        ? action.responsiblePerson
        : "",
    department: typeof action.department === "string" ? action.department : "",
    siteLocation:
      typeof action.siteLocation === "string" ? action.siteLocation : "",
    dueDate:
      typeof action.dueDate === "string" && action.dueDate.length > 0
        ? action.dueDate
        : getDateInputDaysFromNow(7),
    status: normalizeStatus(action.status),
    progress: clampProgress(
      typeof action.progress === "number" ? action.progress : 0,
    ),
    notes: typeof action.notes === "string" ? action.notes : "",
    createdDate:
      typeof action.createdDate === "string" ? action.createdDate : now,
    lastUpdated:
      typeof action.lastUpdated === "string" ? action.lastUpdated : now,
    createdBy:
      typeof action.createdBy === "string" && action.createdBy.trim().length > 0
        ? action.createdBy
        : "Unknown",
    linkedInspectionId:
      typeof action.linkedInspectionId === "string"
        ? action.linkedInspectionId
        : undefined,
    linkedRiskAssessmentId:
      typeof action.linkedRiskAssessmentId === "string"
        ? action.linkedRiskAssessmentId
        : undefined,
    linkedIncidentId:
      typeof action.linkedIncidentId === "string"
        ? action.linkedIncidentId
        : undefined,
    linkedTrainingGapKey:
      typeof action.linkedTrainingGapKey === "string"
        ? action.linkedTrainingGapKey
        : undefined,
  };
};

const parseActions = (value: string | null): HseAction[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Partial<HseAction> =>
        Boolean(item && typeof item === "object"),
      )
      .map(normalizeAction);
  } catch {
    return [];
  }
};

export const mergeActions = (actions: HseAction[]) => {
  const byId = new Map<string, HseAction>();

  actions.forEach((action) => {
    const existing = byId.get(action.id);
    const actionTime = new Date(action.lastUpdated).getTime();
    const existingTime = existing
      ? new Date(existing.lastUpdated).getTime()
      : Number.NEGATIVE_INFINITY;

    if (!existing || actionTime >= existingTime) {
      byId.set(action.id, action);
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.lastUpdated).getTime();
    const bTime = new Date(b.lastUpdated).getTime();
    return bTime - aTime;
  });
};

export const readActionTrackerActions = (userId: string | null) => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [getActionTrackerStorageKey(userId)];

  if (userId && !keys.includes(legacyStorageKey)) {
    keys.push(legacyStorageKey);
  }

  return mergeActions(
    keys.flatMap((key) => parseActions(window.localStorage.getItem(key))),
  );
};

export const writeActionTrackerActions = (
  userId: string | null,
  actions: HseAction[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getActionTrackerStorageKey(userId),
    JSON.stringify(actions),
  );

  if (userId) {
    window.localStorage.removeItem(legacyStorageKey);
  }
};

export const createActionFromInput = (input: ActionDraftInput): HseAction => {
  const now = new Date().toISOString();

  return normalizeAction({
    id: createActionId(),
    title: input.title.trim(),
    description: input.description.trim(),
    sourceModule: input.sourceModule,
    priority: input.priority,
    responsiblePerson: input.responsiblePerson?.trim() ?? "",
    department: input.department?.trim() ?? "",
    siteLocation: input.siteLocation?.trim() ?? "",
    dueDate: input.dueDate || getDateInputDaysFromNow(7),
    status: "Open",
    progress: 0,
    notes: input.notes?.trim() ?? "",
    createdDate: now,
    lastUpdated: now,
    createdBy: input.createdBy,
    linkedInspectionId: input.linkedInspectionId,
    linkedRiskAssessmentId: input.linkedRiskAssessmentId,
    linkedIncidentId: input.linkedIncidentId,
    linkedTrainingGapKey: input.linkedTrainingGapKey,
  });
};

export const appendActionTrackerAction = (
  userId: string | null,
  action: HseAction,
) => {
  const updated = mergeActions([action, ...readActionTrackerActions(userId)]);
  writeActionTrackerActions(userId, updated);
  return updated;
};

export const findActionByLinkedSource = ({
  userId,
  linkedInspectionId,
  linkedRiskAssessmentId,
  linkedIncidentId,
  linkedTrainingGapKey,
}: {
  userId: string | null;
  linkedInspectionId?: string;
  linkedRiskAssessmentId?: string;
  linkedIncidentId?: string;
  linkedTrainingGapKey?: string;
}) =>
  readActionTrackerActions(userId).find((action) => {
    if (
      linkedInspectionId &&
      action.linkedInspectionId === linkedInspectionId
    ) {
      return true;
    }

    if (
      linkedRiskAssessmentId &&
      action.linkedRiskAssessmentId === linkedRiskAssessmentId
    ) {
      return true;
    }

    if (linkedIncidentId && action.linkedIncidentId === linkedIncidentId) {
      return true;
    }

    if (
      linkedTrainingGapKey &&
      action.linkedTrainingGapKey === linkedTrainingGapKey
    ) {
      return true;
    }

    return false;
  });
