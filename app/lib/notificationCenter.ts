import { ALL_CHECKLISTS } from "@/app/data/checklists";
import {
  readActionTrackerActions,
  type HseAction,
} from "@/app/lib/actionTracker";
import type { WorkspaceNavigationRequest } from "@/app/lib/workspaceNavigation";
import type { WorkspaceSettings } from "@/app/lib/workspaceSettings";
import { getOrbitAiAccount } from "@/app/lib/orbitAi";

export type OrbitNotificationSeverity = "Info" | "Warning" | "Critical" | "Success";

export type OrbitNotificationSource =
  | "Action Tracker"
  | "Risk Assessments"
  | "Inspections"
  | "Training Management"
  | "Incident Management"
  | "AI / Billing";

export type OrbitNotification = {
  id: string;
  title: string;
  message: string;
  sourceModule: OrbitNotificationSource;
  severity: OrbitNotificationSeverity;
  createdAt: string;
  read: boolean;
  active: boolean;
  relatedRecordId?: string;
  relatedAction: WorkspaceNavigationRequest;
  resolvedAt?: string;
};

type StoredRiskAssessment = {
  id: number;
  header?: {
    assessmentTitle?: string;
    departmentArea?: string;
    siteLocation?: string;
  };
  hazards?: Array<{
    id?: string;
    workplaceActivity?: string;
    hazardDescription?: string;
    residualProbability?: number;
    residualSeverity?: number;
    responsiblePerson?: string;
  }>;
  savedAt?: string;
};

type StoredInspection = {
  id: number;
  savedAt?: string;
  inspectionDate?: string;
  result?: {
    percent?: number;
    status?: string;
  };
  answers?: Record<string, string>;
};

type TrainingEmployee = {
  id: string;
  name?: string;
  employeeId?: string;
  department?: string;
  position?: string;
  status?: string;
};

type TrainingType = {
  id: string;
  name?: string;
  riskLevel?: string;
};

type TrainingRecord = {
  id: string;
  employeeId?: string;
  trainingTypeId?: string;
  expiryDate?: string;
};

type TrainingState = {
  employees?: TrainingEmployee[];
  trainingTypes?: TrainingType[];
  records?: TrainingRecord[];
};

type StoredIncident = {
  id: string;
  title?: string;
  eventType?: string;
  severity?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NotificationDraft = Omit<OrbitNotification, "read" | "active">;

export const notificationCenterUpdatedEvent = "laboria-notification-center-updated";

const LEGACY_NOTIFICATION_KEY = "laboria_notification_center";
const LEGACY_DISMISSED_NOTIFICATION_KEY = "laboria_notification_center_dismissed";
const CLOSED_ACTION_STATUSES = new Set(["Completed", "Closed"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const getUserStorageKey = (userId: string | null, suffix: string) =>
  userId ? `laboria_${encodeURIComponent(userId)}_${suffix}` : `laboria_${suffix}`;

export const getNotificationStorageKey = (userId: string | null) =>
  getUserStorageKey(userId, "notification_center");

export const getDismissedNotificationStorageKey = (userId: string | null) =>
  getUserStorageKey(userId, "notification_center_dismissed");

const getStorageValue = <T>(keys: string[], fallback: T): T => {
  if (typeof window === "undefined") return fallback;

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      return JSON.parse(raw) as T;
    } catch {
      continue;
    }
  }

  return fallback;
};

const safeIsoDate = (value?: string, fallback = new Date().toISOString()) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const isPast = (value?: string) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
};

const daysUntil = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((parsed.getTime() - Date.now()) / DAY_MS);
};

const slug = (value: string | number) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createDraft = (
  id: string,
  sourceModule: OrbitNotificationSource,
  severity: OrbitNotificationSeverity,
  title: string,
  message: string,
  createdAt: string | undefined,
  relatedAction: WorkspaceNavigationRequest,
  relatedRecordId?: string,
): NotificationDraft => ({
  id,
  title,
  message,
  sourceModule,
  severity,
  createdAt: safeIsoDate(createdAt),
  relatedRecordId,
  relatedAction,
});

const readStoredNotifications = (userId: string | null): OrbitNotification[] =>
  getStorageValue<OrbitNotification[]>(
    [getNotificationStorageKey(userId), LEGACY_NOTIFICATION_KEY],
    [],
  );

const readDismissedNotificationIds = (userId: string | null) =>
  new Set(
    getStorageValue<string[]>(
      [
        getDismissedNotificationStorageKey(userId),
        LEGACY_DISMISSED_NOTIFICATION_KEY,
      ],
      [],
    ),
  );

const writeDismissedNotificationIds = (
  userId: string | null,
  notificationIds: Set<string>,
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getDismissedNotificationStorageKey(userId),
    JSON.stringify(Array.from(notificationIds)),
  );
};

const writeStoredNotifications = (
  userId: string | null,
  notifications: OrbitNotification[],
) => {
  if (typeof window === "undefined") return notifications;

  window.localStorage.setItem(
    getNotificationStorageKey(userId),
    JSON.stringify(notifications),
  );
  window.dispatchEvent(
    new CustomEvent<OrbitNotification[]>(notificationCenterUpdatedEvent, {
      detail: notifications,
    }),
  );
  return notifications;
};

const getActionDrafts = (actions: HseAction[]) => {
  const drafts: NotificationDraft[] = [];

  actions.forEach((action) => {
    const recordAction: WorkspaceNavigationRequest = {
      moduleId: "action-tracker",
      action: "open-record",
      recordId: action.id,
    };
    const isClosed = CLOSED_ACTION_STATUSES.has(action.status);

    if (!isClosed && isPast(action.dueDate)) {
      drafts.push(
        createDraft(
          `action-tracker:${action.id}:overdue`,
          "Action Tracker",
          action.priority === "Critical" ? "Critical" : "Warning",
          "Overdue action requires attention",
          `${action.title} passed its due date and remains ${action.status.toLowerCase()}.`,
          action.lastUpdated || action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (!isClosed && action.priority === "Critical") {
      drafts.push(
        createDraft(
          `action-tracker:${action.id}:critical`,
          "Action Tracker",
          "Critical",
          "Critical action created",
          `${action.title} is marked as a critical operational priority.`,
          action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (!isClosed && action.responsiblePerson.trim()) {
      drafts.push(
        createDraft(
          `action-tracker:${action.id}:assigned`,
          "Action Tracker",
          "Info",
          "Action assigned",
          `${action.title} is assigned to ${action.responsiblePerson}.`,
          action.lastUpdated || action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (action.status === "Pending Verification") {
      drafts.push(
        createDraft(
          `action-tracker:${action.id}:pending-verification`,
          "Action Tracker",
          "Warning",
          "Action pending verification",
          `${action.title} is ready for HSE verification.`,
          action.lastUpdated || action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (isClosed) {
      drafts.push(
        createDraft(
          `action-tracker:${action.id}:completed`,
          "Action Tracker",
          "Success",
          "Action completed",
          `${action.title} has been marked ${action.status.toLowerCase()}.`,
          action.lastUpdated || action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (action.sourceModule === "Inspection") {
      drafts.push(
        createDraft(
          `inspections:${action.id}:action-created`,
          "Inspections",
          "Info",
          "Inspection action created",
          `${action.title} was transferred to Action Tracker.`,
          action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (action.sourceModule === "Training") {
      drafts.push(
        createDraft(
          `training-management:${action.id}:action-created`,
          "Training Management",
          "Info",
          "Training action created",
          `${action.title} was transferred to Action Tracker.`,
          action.createdDate,
          recordAction,
          action.id,
        ),
      );
    }

    if (action.sourceModule === "Incident") {
      drafts.push(
        createDraft(
          `incident-management:${action.id}:action-created`,
          "Incident Management",
          "Info",
          "Incident follow-up action created",
          `${action.title} was transferred to Action Tracker.`,
          action.createdDate,
          recordAction,
          action.linkedIncidentId || action.id,
        ),
      );
    }
  });

  return drafts;
};

const readRiskAssessments = (userId: string | null) =>
  getStorageValue<StoredRiskAssessment[]>(
    [
      getUserStorageKey(userId, "risk_assessments"),
      "laboria_risk_assessments",
    ],
    [],
  );

const getRiskDrafts = (
  userId: string | null,
  settings: WorkspaceSettings,
) => {
  const drafts: NotificationDraft[] = [];
  const reviewPeriodDays = Math.max(
    Number(settings.riskSettings.defaultReviewPeriodDays) || 90,
    1,
  );

  readRiskAssessments(userId).forEach((assessment) => {
    const assessmentId = String(assessment.id);
    const assessmentName =
      assessment.header?.assessmentTitle?.trim() || "Saved risk assessment";
    const recordAction: WorkspaceNavigationRequest = {
      moduleId: "risk-assessments",
      action: "open-record",
      recordId: assessmentId,
    };

    drafts.push(
      createDraft(
        `risk-assessments:${assessmentId}:saved`,
        "Risk Assessments",
        "Info",
        "Risk assessment saved",
        `${assessmentName} is available in the risk assessment register.`,
        assessment.savedAt,
        recordAction,
        assessmentId,
      ),
    );

    if (
      assessment.savedAt &&
      Date.now() - new Date(assessment.savedAt).getTime() > reviewPeriodDays * DAY_MS
    ) {
      drafts.push(
        createDraft(
          `risk-assessments:${assessmentId}:review-required`,
          "Risk Assessments",
          "Warning",
          "Risk review required",
          `${assessmentName} is due for its scheduled review.`,
          assessment.savedAt,
          recordAction,
          assessmentId,
        ),
      );
    }

    (assessment.hazards || []).forEach((hazard, hazardIndex) => {
      const riskScore =
        Number(hazard.residualProbability || 0) *
        Number(hazard.residualSeverity || 0);
      const hazardId = String(hazard.id || hazardIndex + 1);
      const hazardName =
        hazard.hazardDescription?.trim() ||
        hazard.workplaceActivity?.trim() ||
        `Hazard ${hazardIndex + 1}`;

      if (riskScore >= 15) {
        drafts.push(
          createDraft(
            `risk-assessments:${assessmentId}:${hazardId}:high-residual`,
            "Risk Assessments",
            riskScore >= 20 ? "Critical" : "Warning",
            "High residual risk detected",
            `${hazardName} remains rated ${riskScore}/25 after controls.`,
            assessment.savedAt,
            recordAction,
            assessmentId,
          ),
        );
      }

      if (riskScore >= 20) {
        drafts.push(
          createDraft(
            `risk-assessments:${assessmentId}:${hazardId}:critical-score`,
            "Risk Assessments",
            "Critical",
            "Critical risk score requires review",
            `${hazardName} has a residual risk score of ${riskScore}/25.`,
            assessment.savedAt,
            recordAction,
            assessmentId,
          ),
        );
      }
    });
  });

  return drafts;
};

const readInspections = (userId: string | null) =>
  ALL_CHECKLISTS.flatMap((checklist) => {
    const history = getStorageValue<StoredInspection[]>(
      [
        getUserStorageKey(userId, `${checklist.id}_history`),
        `laboria_${checklist.id}_history`,
      ],
      [],
    );

    return history.map((inspection) => ({ checklist, inspection }));
  });

const getInspectionDrafts = (userId: string | null) => {
  const drafts: NotificationDraft[] = [];
  const failedFindingCounts = new Map<
    string,
    { count: number; checklistName: string; questionId: string }
  >();

  readInspections(userId).forEach(({ checklist, inspection }) => {
    const inspectionId = String(inspection.id);
    const recordAction: WorkspaceNavigationRequest = {
      moduleId: "inspections",
      action: "history",
      recordId: inspectionId,
    };
    const failedQuestionIds = Object.entries(inspection.answers || {})
      .filter(([, answer]) => answer.toLowerCase() === "no")
      .map(([questionId]) => questionId);

    drafts.push(
      createDraft(
        `inspections:${checklist.id}:${inspectionId}:completed`,
        "Inspections",
        inspection.result?.percent === 100 ? "Success" : "Info",
        "Inspection saved",
        `${checklist.headerTitleEN} was saved with ${Math.round(
          inspection.result?.percent || 0,
        )}% compliance.`,
        inspection.savedAt || inspection.inspectionDate,
        recordAction,
        inspectionId,
      ),
    );

    if (failedQuestionIds.length > 0) {
      drafts.push(
        createDraft(
          `inspections:${checklist.id}:${inspectionId}:failed-findings`,
          "Inspections",
          "Warning",
          "Failed inspection findings recorded",
          `${checklist.headerTitleEN} contains ${failedQuestionIds.length} non-compliant finding${
            failedQuestionIds.length === 1 ? "" : "s"
          }.`,
          inspection.savedAt || inspection.inspectionDate,
          recordAction,
          inspectionId,
        ),
      );
    }

    failedQuestionIds.forEach((questionId) => {
      const key = `${checklist.id}:${questionId}`;
      const current = failedFindingCounts.get(key);
      failedFindingCounts.set(key, {
        checklistName: checklist.headerTitleEN,
        questionId,
        count: (current?.count || 0) + 1,
      });
    });
  });

  failedFindingCounts.forEach((finding, key) => {
    if (finding.count < 2) return;

    drafts.push(
      createDraft(
        `inspections:${slug(key)}:repeated-finding`,
        "Inspections",
        "Warning",
        "Repeated failed inspection finding",
        `${finding.checklistName} has the same failed finding in ${finding.count} saved inspections.`,
        undefined,
        { moduleId: "inspections", action: "history" },
        finding.questionId,
      ),
    );
  });

  return drafts;
};

const readTrainingState = (userId: string | null) =>
  getStorageValue<TrainingState>(
    [
      getUserStorageKey(userId, "training_management"),
      "laboria_training_management",
    ],
    {},
  );

const getTrainingDrafts = (
  userId: string | null,
  settings: WorkspaceSettings,
) => {
  const drafts: NotificationDraft[] = [];
  const state = readTrainingState(userId);
  const employees = (state.employees || []).filter(
    (employee) => employee.status !== "Inactive",
  );
  const trainingTypes = state.trainingTypes || [];
  const records = state.records || [];
  const expiringSoonDays = Math.max(
    Number(settings.trainingSettings.expiringSoonThresholdDays) || 30,
    1,
  );

  employees.forEach((employee) => {
    trainingTypes.forEach((trainingType) => {
      const relatedRecords = records
        .filter(
          (record) =>
            record.employeeId === employee.id &&
            record.trainingTypeId === trainingType.id,
        )
        .sort(
          (left, right) =>
            new Date(right.expiryDate || 0).getTime() -
            new Date(left.expiryDate || 0).getTime(),
        );
      const latest = relatedRecords[0];
      const gapKey = `${employee.id}:${trainingType.id}`;
      const employeeName = employee.name?.trim() || employee.employeeId || "Employee";
      const trainingName = trainingType.name?.trim() || "Required training";
      const relatedAction: WorkspaceNavigationRequest = {
        moduleId: "training-management",
        action: "compliance",
      };

      if (!latest) {
        drafts.push(
          createDraft(
            `training-management:${gapKey}:missing`,
            "Training Management",
            trainingType.riskLevel === "High" ? "Critical" : "Warning",
            "Missing mandatory training",
            `${employeeName} has no valid ${trainingName} training record.`,
            undefined,
            relatedAction,
            gapKey,
          ),
        );
        return;
      }

      const remainingDays = daysUntil(latest.expiryDate);
      if (remainingDays < 0) {
        drafts.push(
          createDraft(
            `training-management:${gapKey}:expired`,
            "Training Management",
            trainingType.riskLevel === "High" ? "Critical" : "Warning",
            "Training record expired",
            `${employeeName}'s ${trainingName} training has expired.`,
            latest.expiryDate,
            relatedAction,
            gapKey,
          ),
        );
      } else if (remainingDays <= expiringSoonDays) {
        drafts.push(
          createDraft(
            `training-management:${gapKey}:expiring-soon`,
            "Training Management",
            "Warning",
            "Training expires soon",
            `${employeeName}'s ${trainingName} training expires in ${remainingDays} day${
              remainingDays === 1 ? "" : "s"
            }.`,
            latest.expiryDate,
            relatedAction,
            gapKey,
          ),
        );
      }
    });
  });

  return drafts;
};

const readIncidents = (userId: string | null) =>
  getStorageValue<StoredIncident[]>(
    [
      getUserStorageKey(userId, "incident_management"),
      "laboria_incident_management",
    ],
    [],
  );

const getIncidentDrafts = (userId: string | null) => {
  const drafts: NotificationDraft[] = [];

  readIncidents(userId).forEach((incident) => {
    const incidentId = String(incident.id);
    const incidentTitle = incident.title?.trim() || "Recorded incident";
    const recordAction: WorkspaceNavigationRequest = {
      moduleId: "incident-management",
      action: "open-record",
      recordId: incidentId,
    };

    drafts.push(
      createDraft(
        `incident-management:${incidentId}:created`,
        "Incident Management",
        "Info",
        "New incident recorded",
        `${incidentTitle} has been added to the incident register.`,
        incident.createdAt || incident.updatedAt,
        recordAction,
        incidentId,
      ),
    );

    if (incident.severity === "High" || incident.severity === "Critical") {
      drafts.push(
        createDraft(
          `incident-management:${incidentId}:high-severity`,
          "Incident Management",
          "Critical",
          "High severity incident requires review",
          `${incidentTitle} is classified as ${incident.severity.toLowerCase()} severity.`,
          incident.updatedAt || incident.createdAt,
          recordAction,
          incidentId,
        ),
      );
    }

    if (incident.eventType === "Lost Time Injury") {
      drafts.push(
        createDraft(
          `incident-management:${incidentId}:lti`,
          "Incident Management",
          "Critical",
          "Lost time injury recorded",
          `${incidentTitle} is recorded as a Lost Time Injury event.`,
          incident.updatedAt || incident.createdAt,
          recordAction,
          incidentId,
        ),
      );
    }

    if (incident.status === "Pending Verification") {
      drafts.push(
        createDraft(
          `incident-management:${incidentId}:pending-verification`,
          "Incident Management",
          "Warning",
          "Incident ready for verification",
          `${incidentTitle} is awaiting final HSE verification.`,
          incident.updatedAt || incident.createdAt,
          recordAction,
          incidentId,
        ),
      );
    }
  });

  return drafts;
};

const getBillingDrafts = (userId: string | null) => {
  const account = getOrbitAiAccount(userId);
  const drafts = [
    createDraft(
    "ai-billing:feature-locked",
    "AI / Billing",
    "Info",
    "Advanced Orbit AI features are in preview",
    "Advanced AI Intelligence tools are available for preview while additional Orbit AI features are prepared for launch.",
    undefined,
    { moduleId: "settings", action: "ai-intelligence" },
    "ai-intelligence",
  ),
  ];

  if (account.credits === 0) {
    drafts.push(
      createDraft(
        "ai-billing:credits-empty",
        "AI / Billing",
        "Critical",
        "AI credits are empty",
        "Your workspace currently has 0 AI credits available.",
        undefined,
        { moduleId: "settings", action: "billing" },
        "ai-credits",
      ),
    );
  } else if (account.credits <= 5) {
    drafts.push(
      createDraft(
        "ai-billing:credits-low",
        "AI / Billing",
        "Warning",
        "AI credits are running low",
        `Your workspace currently has ${account.credits} AI credits available.`,
        undefined,
        { moduleId: "settings", action: "billing" },
        "ai-credits",
      ),
    );
  }

  return drafts;
};

const mergeNotifications = (
  storedNotifications: OrbitNotification[],
  drafts: NotificationDraft[],
) => {
  const now = new Date().toISOString();
  const storedById = new Map(
    storedNotifications.map((notification) => [notification.id, notification]),
  );
  const activeIds = new Set(drafts.map((draft) => draft.id));
  const merged: OrbitNotification[] = drafts.map((draft) => {
    const stored = storedById.get(draft.id);
    return {
      ...draft,
      createdAt: stored?.createdAt || draft.createdAt,
      read: stored?.read || false,
      active: true,
      resolvedAt: undefined,
    } satisfies OrbitNotification;
  });

  storedNotifications.forEach((notification) => {
    if (activeIds.has(notification.id)) return;
    merged.push({
      ...notification,
      active: false,
      resolvedAt: notification.resolvedAt || now,
    });
  });

  return merged
    .sort(
      (left, right) =>
        Number(right.active) - Number(left.active) ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 300);
};

export const readOrbitNotifications = (userId: string | null) =>
  readStoredNotifications(userId);

export const syncOrbitNotifications = (
  userId: string | null,
  settings: WorkspaceSettings,
) => {
  if (typeof window === "undefined") return [];

  const actions = readActionTrackerActions(userId);
  const drafts = [
    ...getActionDrafts(actions),
    ...getRiskDrafts(userId, settings),
    ...getInspectionDrafts(userId),
    ...getTrainingDrafts(userId, settings),
    ...getIncidentDrafts(userId),
    ...getBillingDrafts(userId),
  ];
  const dedupedDrafts = Array.from(
    new Map(drafts.map((draft) => [draft.id, draft])).values(),
  );
  const dismissedNotificationIds = readDismissedNotificationIds(userId);

  return writeStoredNotifications(
    userId,
    mergeNotifications(
      readStoredNotifications(userId).filter(
        (notification) => !dismissedNotificationIds.has(notification.id),
      ),
      dedupedDrafts.filter((draft) => !dismissedNotificationIds.has(draft.id)),
    ),
  );
};

export const markOrbitNotificationRead = (
  userId: string | null,
  notificationId: string,
) =>
  writeStoredNotifications(
    userId,
    readStoredNotifications(userId).map((notification) =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification,
    ),
  );

export const markAllOrbitNotificationsRead = (userId: string | null) =>
  writeStoredNotifications(
    userId,
    readStoredNotifications(userId).map((notification) => ({
      ...notification,
      read: true,
    })),
  );

export const deleteOrbitNotification = (
  userId: string | null,
  notificationId: string,
) => {
  const dismissedNotificationIds = readDismissedNotificationIds(userId);
  dismissedNotificationIds.add(notificationId);
  writeDismissedNotificationIds(userId, dismissedNotificationIds);

  return writeStoredNotifications(
    userId,
    readStoredNotifications(userId).filter(
      (notification) => notification.id !== notificationId,
    ),
  );
};

export const deleteAllReadOrbitNotifications = (userId: string | null) => {
  const notifications = readStoredNotifications(userId);
  const dismissedNotificationIds = readDismissedNotificationIds(userId);

  notifications.forEach((notification) => {
    if (notification.read) {
      dismissedNotificationIds.add(notification.id);
    }
  });
  writeDismissedNotificationIds(userId, dismissedNotificationIds);

  return writeStoredNotifications(
    userId,
    notifications.filter((notification) => !notification.read),
  );
};
