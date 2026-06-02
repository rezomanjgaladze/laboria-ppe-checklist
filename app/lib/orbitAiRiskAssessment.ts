export const orbitAiControlHierarchyOptions = [
  "Elimination",
  "Substitution",
  "Engineering Controls",
  "Administrative Controls",
  "PPE",
] as const;

export type OrbitAiControlHierarchy =
  (typeof orbitAiControlHierarchyOptions)[number];

export type OrbitAiStructuredRiskAssessment = {
  header: {
    company: string;
    site: string;
    department: string;
    title: string;
    assessor: string;
    assessmentDate: string;
    sector: string;
    activity: string;
  };
  hazards: Array<{
    workplaceActivity: string;
    hazardDescription: string;
    whoMayBeHarmed: string;
    possibleConsequence: string;
    existingMeasures: string;
    initialProbability: number;
    initialSeverity: number;
    initialRiskScore: number;
    additionalMeasures: string;
    controlHierarchy: OrbitAiControlHierarchy[];
    residualProbability: number;
    residualSeverity: number;
    residualRiskScore: number;
    responsiblePerson: string;
    completionDeadline: string;
    status: "Open" | "In Progress" | "Closed";
    comments: string;
  }>;
};

const text = (value: unknown, maxLength = 4000) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const object = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const riskValue = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
};

export const parseOrbitAiStructuredRiskAssessment = (
  value: unknown,
): OrbitAiStructuredRiskAssessment | null => {
  const candidate = object(value);
  const rawHeader = object(candidate?.header);
  const rawHazards = Array.isArray(candidate?.hazards) ? candidate.hazards : [];

  if (!candidate || !rawHeader || rawHazards.length === 0 || rawHazards.length > 30) {
    return null;
  }

  const header = {
    company: text(rawHeader.company, 240),
    site: text(rawHeader.site, 240),
    department: text(rawHeader.department, 240),
    title: text(rawHeader.title, 320),
    assessor: text(rawHeader.assessor, 240),
    assessmentDate: text(rawHeader.assessmentDate, 40),
    sector: text(rawHeader.sector, 240),
    activity: text(rawHeader.activity, 320),
  };

  if (!header.title || !header.activity) {
    return null;
  }

  const hazards: OrbitAiStructuredRiskAssessment["hazards"] = [];

  for (const rawHazard of rawHazards) {
    const hazard = object(rawHazard);
    if (!hazard) return null;

    const initialProbability = riskValue(hazard.initialProbability);
    const initialSeverity = riskValue(hazard.initialSeverity);
    const residualProbability = riskValue(hazard.residualProbability);
    const residualSeverity = riskValue(hazard.residualSeverity);
    const initialRiskScore = Number(hazard.initialRiskScore);
    const residualRiskScore = Number(hazard.residualRiskScore);
    const controlHierarchy = Array.isArray(hazard.controlHierarchy)
      ? hazard.controlHierarchy.filter((option): option is OrbitAiControlHierarchy =>
          orbitAiControlHierarchyOptions.includes(
            option as OrbitAiControlHierarchy,
          ),
        )
      : [];
    const status: OrbitAiStructuredRiskAssessment["hazards"][number]["status"] =
      hazard.status === "In Progress" || hazard.status === "Closed"
        ? hazard.status
        : "Open";
    const normalizedHazard = {
      workplaceActivity: text(hazard.workplaceActivity),
      hazardDescription: text(hazard.hazardDescription),
      whoMayBeHarmed: text(hazard.whoMayBeHarmed),
      possibleConsequence: text(hazard.possibleConsequence),
      existingMeasures: text(hazard.existingMeasures),
      initialProbability,
      initialSeverity,
      initialRiskScore,
      additionalMeasures: text(hazard.additionalMeasures),
      controlHierarchy,
      residualProbability,
      residualSeverity,
      residualRiskScore,
      responsiblePerson: text(hazard.responsiblePerson, 240),
      completionDeadline: text(hazard.completionDeadline, 40),
      status,
      comments: text(hazard.comments),
    };

    if (
      !normalizedHazard.workplaceActivity ||
      !normalizedHazard.hazardDescription ||
      !normalizedHazard.whoMayBeHarmed ||
      !normalizedHazard.possibleConsequence ||
      !normalizedHazard.existingMeasures ||
      !normalizedHazard.additionalMeasures ||
      initialProbability === null ||
      initialSeverity === null ||
      residualProbability === null ||
      residualSeverity === null ||
      initialRiskScore !== initialProbability * initialSeverity ||
      residualRiskScore !== residualProbability * residualSeverity ||
      controlHierarchy.length === 0
    ) {
      return null;
    }

    hazards.push({
      ...normalizedHazard,
      initialProbability,
      initialSeverity,
      residualProbability,
      residualSeverity,
    });
  }

  return { header, hazards };
};
