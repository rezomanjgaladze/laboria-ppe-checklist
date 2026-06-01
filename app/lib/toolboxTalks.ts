export type ToolboxTalkVariant = "basic" | "quiz";

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
  content: ToolboxTalkContent;
};

export const toolboxTalksUpdatedEvent = "laboria-orbit-toolbox-talks-updated";

const getToolboxTalkStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_toolbox_talks`
    : "laboria_toolbox_talks";

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
