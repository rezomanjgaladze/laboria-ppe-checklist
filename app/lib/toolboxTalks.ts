export type ToolboxTalkVariant = "basic" | "quiz";
export type ToolboxTalkSourceType = "manual_topic" | "risk_assessment";

export type ToolboxTalkInputs = {
  topic: string;
  industrySector: string;
  department: string;
  targetAudience: string;
  duration: string;
  language: string;
  riskLevel: string;
  keyHazardsNotes: string;
};

export type ToolboxTalkQuizItem = {
  question: string;
  answer: string;
};

export type ToolboxTalkRiskAssessmentHazard = {
  id: string;
  workplaceActivity: string;
  hazardDescription: string;
  possibleConsequence: string;
  existingMeasures: string;
  additionalMeasures: string;
  controlHierarchy: string[];
  residualProbability: number;
  residualSeverity: number;
  residualScore: number;
  residualRiskLevel: string;
  comments: string;
};

export type ToolboxTalkRiskAssessmentSource = {
  id: string;
  title: string;
  siteLocation: string;
  department: string;
  sector: string;
  activity: string;
  savedAt: string;
  highestResidualRiskLevel: string;
  hazards: ToolboxTalkRiskAssessmentHazard[];
};

export type ToolboxTalkContent = {
  title: string;
  objective: string;
  targetAudience: string;
  duration: string;
  keyHazards: string[];
  mainDiscussionScript: string;
  safeWorkPractices: string[];
  workerQuestions: string[];
  supervisorNotes: string;
  attendanceSignatureSection: string;
  closingReminder: string;
  quiz: ToolboxTalkQuizItem[];
  reviewNote: string;
};

export type GeneratedToolboxTalk = {
  id: string;
  userId: string | null;
  createdAt: string;
  variant: ToolboxTalkVariant;
  creditsUsed: number;
  inputs: ToolboxTalkInputs;
  sourceType?: ToolboxTalkSourceType;
  sourceRiskAssessmentId?: string;
  sourceRiskAssessmentTitle?: string;
  content: ToolboxTalkContent;
};

export const toolboxTalksUpdatedEvent = "laboria-orbit-toolbox-talks-updated";

const getToolboxTalkStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_toolbox_talks`
    : "laboria_toolbox_talks";

const getRiskAssessmentStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_risk_assessments`
    : "laboria_risk_assessments";

const toStringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

const toNumberValue = (value: unknown, fallback = 1) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const clampRiskValue = (value: unknown) =>
  Math.min(Math.max(Math.round(toNumberValue(value)), 1), 5);

const getRiskLevel = (score: number) => {
  if (score >= 15) return "High";
  if (score >= 4) return "Medium";
  return "Low";
};

const getHighestResidualRiskLevel = (
  hazards: ToolboxTalkRiskAssessmentHazard[],
) => {
  const highestScore = hazards.reduce(
    (highest, hazard) => Math.max(highest, hazard.residualScore),
    0,
  );
  return getRiskLevel(highestScore);
};

export const createToolboxTalkId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `toolbox-talk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const readToolboxTalks = (
  userId: string | null,
): GeneratedToolboxTalk[] => {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(getToolboxTalkStorageKey(userId));

  if (!stored) return [];

  try {
    const talks = JSON.parse(stored);
    return Array.isArray(talks) ? (talks as GeneratedToolboxTalk[]) : [];
  } catch {
    return [];
  }
};

export const writeToolboxTalks = (
  userId: string | null,
  talks: GeneratedToolboxTalk[],
) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getToolboxTalkStorageKey(userId),
    JSON.stringify(talks),
  );
  window.dispatchEvent(
    new CustomEvent(toolboxTalksUpdatedEvent, { detail: talks }),
  );
};

export const appendToolboxTalk = (
  userId: string | null,
  talk: GeneratedToolboxTalk,
) => {
  const talks = [talk, ...readToolboxTalks(userId)];
  writeToolboxTalks(userId, talks);
  return talks;
};

export const readToolboxTalkRiskAssessments = (
  userId: string | null,
): ToolboxTalkRiskAssessmentSource[] => {
  if (typeof window === "undefined") return [];

  const keys = [getRiskAssessmentStorageKey(userId)];

  if (userId) {
    keys.push("laboria_risk_assessments");
  }

  const seen = new Set<string>();

  return keys
    .flatMap((key) => {
      const stored = window.localStorage.getItem(key);

      if (!stored) return [];

      try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => {
      const header =
        item.header && typeof item.header === "object"
          ? (item.header as Record<string, unknown>)
          : {};
      const hazards = Array.isArray(item.hazards)
        ? item.hazards
            .filter((hazard): hazard is Record<string, unknown> =>
              Boolean(hazard && typeof hazard === "object"),
            )
            .map((hazard) => {
              const residualProbability = clampRiskValue(
                hazard.residualProbability,
              );
              const residualSeverity = clampRiskValue(hazard.residualSeverity);
              const residualScore = residualProbability * residualSeverity;

              return {
                id: toStringValue(hazard.id),
                workplaceActivity: toStringValue(hazard.workplaceActivity),
                hazardDescription: toStringValue(hazard.hazardDescription),
                possibleConsequence: toStringValue(hazard.possibleConsequence),
                existingMeasures: toStringValue(hazard.existingMeasures),
                additionalMeasures: toStringValue(hazard.additionalMeasures),
                controlHierarchy: Array.isArray(hazard.controlHierarchy)
                  ? hazard.controlHierarchy.map(toStringValue).filter(Boolean)
                  : [],
                residualProbability,
                residualSeverity,
                residualScore,
                residualRiskLevel: getRiskLevel(residualScore),
                comments: toStringValue(hazard.comments),
              };
            })
        : [];

      return {
        id: String(item.id ?? ""),
        title: toStringValue(header.title),
        siteLocation: toStringValue(header.site),
        department: toStringValue(header.department),
        sector: toStringValue(header.sector),
        activity: toStringValue(header.activity),
        savedAt: toStringValue(item.savedAt),
        highestResidualRiskLevel: getHighestResidualRiskLevel(hazards),
        hazards,
      };
    })
    .filter((assessment) => {
      if (!assessment.id || seen.has(assessment.id)) {
        return false;
      }

      seen.add(assessment.id);
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.savedAt).getTime();
      const bTime = new Date(b.savedAt).getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
};
