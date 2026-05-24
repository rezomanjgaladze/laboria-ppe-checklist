"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Copy,
  Download,
  FileText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type RiskValue = 1 | 2 | 3 | 4 | 5;
type RiskLevel = "Low" | "Medium" | "High";
type ControlHierarchy =
  | "Elimination"
  | "Substitution"
  | "Engineering Controls"
  | "Administrative Controls"
  | "PPE";
type ActionStatus = "Open" | "In Progress" | "Closed";

type RiskAssessmentHeader = {
  company: string;
  site: string;
  department: string;
  title: string;
  assessor: string;
  assessmentDate: string;
  sector: string;
  activity: string;
};

type HazardRow = {
  id: string;
  workplaceActivity: string;
  hazardDescription: string;
  whoMayBeHarmed: string;
  possibleConsequence: string;
  existingMeasures: string;
  initialProbability: RiskValue;
  initialSeverity: RiskValue;
  additionalMeasures: string;
  controlHierarchy: ControlHierarchy[];
  residualProbability: RiskValue;
  residualSeverity: RiskValue;
  responsiblePerson: string;
  completionDeadline: string;
  status: ActionStatus;
  comments: string;
};

type SavedRiskAssessment = {
  id: number;
  header: RiskAssessmentHeader;
  hazards: HazardRow[];
  savedAt: string;
};

type RiskAssessmentsModuleProps = {
  userId: string | null;
};

const controlHierarchyOptions: ControlHierarchy[] = [
  "Elimination",
  "Substitution",
  "Engineering Controls",
  "Administrative Controls",
  "PPE",
];

const sectorOptions = ["Construction"];
const activitiesBySector: Record<string, string[]> = {
  Construction: ["Working at Height"],
};
const customLibraryOption = "__custom__";

const actionStatusOptions: ActionStatus[] = ["Open", "In Progress", "Closed"];
const riskValues: RiskValue[] = [1, 2, 3, 4, 5];

const today = () => new Date().toISOString().split("T")[0];

const createEmptyHeader = (): RiskAssessmentHeader => ({
  company: "",
  site: "",
  department: "",
  title: "",
  assessor: "",
  assessmentDate: today(),
  sector: "",
  activity: "",
});

const createEmptyHazard = (): HazardRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  workplaceActivity: "",
  hazardDescription: "",
  whoMayBeHarmed: "",
  possibleConsequence: "",
  existingMeasures: "",
  initialProbability: 1,
  initialSeverity: 1,
  additionalMeasures: "",
  controlHierarchy: ["Administrative Controls"],
  residualProbability: 1,
  residualSeverity: 1,
  responsiblePerson: "",
  completionDeadline: "",
  status: "Open",
  comments: "",
});

const normalizeControlHierarchy = (value: unknown): ControlHierarchy[] => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim())
      : [];
  const normalized = values.filter((item): item is ControlHierarchy =>
    controlHierarchyOptions.includes(item as ControlHierarchy),
  );

  return normalized.length > 0 ? normalized : ["Administrative Controls"];
};

const normalizeHazard = (hazard: Partial<HazardRow>): HazardRow => ({
  ...createEmptyHazard(),
  ...hazard,
  id: hazard.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  controlHierarchy: normalizeControlHierarchy(hazard.controlHierarchy),
});

const normalizeSavedRiskAssessment = (
  assessment: SavedRiskAssessment,
): SavedRiskAssessment => ({
  ...assessment,
  header: {
    ...createEmptyHeader(),
    ...assessment.header,
  },
  hazards: assessment.hazards.map((hazard) => normalizeHazard(hazard)),
});

const createLibraryHazard = (hazard: Partial<HazardRow>): HazardRow =>
  normalizeHazard({
    ...hazard,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    responsiblePerson: hazard.responsiblePerson ?? "",
    completionDeadline: hazard.completionDeadline ?? "",
    status: hazard.status ?? "Open",
    comments: hazard.comments ?? "",
  });

const createWorkingAtHeightHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity:
      "Working at height on platforms, ladders, scaffolds, or roof areas",
    hazardDescription:
      "Fall from height due to unprotected edges, unsafe access, unstable working platforms, or incorrect use of fall protection equipment",
    whoMayBeHarmed:
      "Workers, contractors, maintenance personnel, visitors below",
    possibleConsequence:
      "Serious injury, fractures, spinal injury, fatality",
    existingMeasures:
      "Guardrails or edge protection installed where possible; safe access routes provided; workers trained in working at height; fall protection equipment available; work area inspected before use",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Verify all edge protection before work starts; inspect harnesses, lanyards, ladders, and anchor points; use permit-to-work for high-risk tasks; ensure rescue plan is available; increase supervision during high-risk activities",
    controlHierarchy: [
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 2,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Working at height with tools and materials",
    hazardDescription: "Falling objects from elevated work areas",
    whoMayBeHarmed: "Workers below, contractors, visitors, pedestrians",
    possibleConsequence: "Head injury, cuts, fractures, fatality",
    existingMeasures:
      "Exclusion zones established; toe boards or debris nets used where needed; hard hats required; tools and materials controlled at height",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Secure tools with lanyards; improve housekeeping on platforms; restrict access below work area; install warning signs and barriers; brief workers before task starts",
    controlHierarchy: [
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Use of ladders for access or short-duration work",
    hazardDescription:
      "Ladder slipping, incorrect angle, overreaching, damaged ladder, or unsafe ladder use",
    whoMayBeHarmed: "Workers, contractors",
    possibleConsequence: "Fall injury, fractures, sprains, head injury",
    existingMeasures:
      "Ladders inspected before use; ladders placed on stable surface; three points of contact maintained; workers instructed on safe ladder use",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Use scaffold/platform instead of ladder where work duration is long; secure ladder; ensure correct angle; prohibit overreaching; remove damaged ladders from service",
    controlHierarchy: ["Substitution", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Roof work or work near fragile surfaces",
    hazardDescription:
      "Collapse or failure of fragile roof materials, skylights, or weak surfaces",
    whoMayBeHarmed: "Workers, contractors",
    possibleConsequence: "Fall through roof, serious injury, fatality",
    existingMeasures:
      "Fragile surfaces identified; access restricted; warning signs used; safe working platforms or crawling boards provided where needed",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Conduct pre-work roof survey; mark fragile areas clearly; use fall arrest systems; install temporary edge protection; ensure rescue plan and emergency arrangements are available",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 2,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Outdoor work at height",
    hazardDescription:
      "Adverse weather conditions such as wind, rain, poor visibility, or slippery surfaces affecting safe work at height",
    whoMayBeHarmed: "Workers, contractors",
    possibleConsequence: "Slip, fall from height, serious injury, fatality",
    existingMeasures:
      "Weather conditions checked before work; work stopped during unsafe weather; surfaces inspected for water, ice, or contamination",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Define weather stop-work criteria; monitor wind speed; postpone work during heavy rain or strong wind; improve anti-slip access; communicate weather-related restrictions during toolbox talk",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Emergency response after fall arrest activation",
    hazardDescription:
      "Suspension trauma or delayed rescue after fall arrest system activation",
    whoMayBeHarmed: "Workers using fall arrest systems",
    possibleConsequence: "Suspension trauma, serious injury, fatality",
    existingMeasures:
      "Fall arrest equipment available; emergency contacts known; supervisors aware of work at height activity",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Prepare and communicate rescue plan before work starts; ensure rescue equipment is available; train workers and supervisors in rescue procedures; do not rely only on emergency services",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const toRiskValue = (value: string): RiskValue => Number(value) as RiskValue;

const riskScore = (probability: RiskValue, severity: RiskValue) =>
  probability * severity;

const riskLevel = (score: number): RiskLevel => {
  if (score <= 3) {
    return "Low";
  }

  if (score <= 12) {
    return "Medium";
  }

  return "High";
};

const riskTone = (level: RiskLevel) => {
  if (level === "High") {
    return {
      badge:
        "border-rose-400/40 bg-rose-500/12 text-rose-200 ring-1 ring-rose-400/20",
      cell: "bg-rose-500/16 text-rose-100 border-rose-400/25",
      exportBg: "#FEE2E2",
      exportText: "#991B1B",
    };
  }

  if (level === "Medium") {
    return {
      badge:
        "border-amber-400/35 bg-amber-400/12 text-amber-100 ring-1 ring-amber-400/20",
      cell: "bg-amber-400/15 text-amber-100 border-amber-300/25",
      exportBg: "#FEF3C7",
      exportText: "#92400E",
    };
  }

  return {
    badge:
      "border-emerald-400/35 bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-400/20",
    cell: "bg-emerald-400/12 text-emerald-100 border-emerald-300/20",
    exportBg: "#DCFCE7",
    exportText: "#166534",
  };
};

const getLegacyRiskAssessmentStorageKey = () => "laboria_risk_assessments";

const getRiskAssessmentStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_risk_assessments`
    : getLegacyRiskAssessmentStorageKey();

const parseSavedRiskAssessments = (
  value: string | null,
): SavedRiskAssessment[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is SavedRiskAssessment => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<SavedRiskAssessment>;
      return (
        typeof candidate.id === "number" &&
        Boolean(candidate.header) &&
        Array.isArray(candidate.hazards)
      );
    });
  } catch {
    return [];
  }
};

const mergeSavedRiskAssessments = (items: SavedRiskAssessment[]) => {
  const seen = new Set<number>();

  return items
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.savedAt).getTime();
      const bTime = new Date(b.savedAt).getTime();

      return (
        (Number.isFinite(bTime) ? bTime : b.id) -
        (Number.isFinite(aTime) ? aTime : a.id)
      );
    });
};

const readRiskAssessments = (userId: string | null) => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [getRiskAssessmentStorageKey(userId)];
  const legacyKey = getLegacyRiskAssessmentStorageKey();

  if (userId && !keys.includes(legacyKey)) {
    keys.push(legacyKey);
  }

  return mergeSavedRiskAssessments(
    keys.flatMap((key) =>
      parseSavedRiskAssessments(window.localStorage.getItem(key)),
    ),
  ).map((assessment) => normalizeSavedRiskAssessment(assessment));
};

const writeRiskAssessments = (
  userId: string | null,
  assessments: SavedRiskAssessment[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getRiskAssessmentStorageKey(userId),
    JSON.stringify(assessments),
  );

  if (userId) {
    window.localStorage.removeItem(getLegacyRiskAssessmentStorageKey());
  }
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#4DEBFF]/45 focus:bg-white/[0.075]"
    />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
      {label}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-[#4DEBFF]/45 focus:bg-white/[0.075]"
    />
  </label>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
      {label}
    </span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="w-full rounded-xl border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none transition focus:border-[#4DEBFF]/45 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const RiskBadge = ({ score }: { score: number }) => {
  const level = riskLevel(score);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${riskTone(level).badge}`}
    >
      {score} - {level}
    </span>
  );
};

const RiskMatrixGuide = () => (
  <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-white">5x5 Risk Matrix</h3>
        <p className="mt-1 text-xs text-slate-400">
          Risk Score = Probability x Severity
        </p>
      </div>
      <div className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4DEBFF]">
        Manual scoring
      </div>
    </div>

    <div className="mt-4 grid grid-cols-6 gap-1 text-center text-[11px] font-bold">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-slate-400">
        S / P
      </div>
      {riskValues.map((probability) => (
        <div
          key={`probability-${probability}`}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-slate-300"
        >
          P{probability}
        </div>
      ))}
      {riskValues
        .slice()
        .reverse()
        .map((severity) => (
          <Fragment key={`severity-row-${severity}`}>
            <div
              key={`severity-${severity}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-slate-300"
            >
              S{severity}
            </div>
            {riskValues.map((probability) => {
              const score = riskScore(probability, severity);
              const level = riskLevel(score);

              return (
                <div
                  key={`${probability}-${severity}`}
                  className={`rounded-lg border p-2 ${riskTone(level).cell}`}
                  title={`${score} - ${level}`}
                >
                  {score}
                </div>
              );
            })}
          </Fragment>
        ))}
    </div>
  </div>
);

export default function RiskAssessmentsModule({
  userId,
}: RiskAssessmentsModuleProps) {
  const [header, setHeader] = useState<RiskAssessmentHeader>(
    createEmptyHeader,
  );
  const [hazards, setHazards] = useState<HazardRow[]>([createEmptyHazard()]);
  const [savedAssessments, setSavedAssessments] = useState<
    SavedRiskAssessment[]
  >([]);
  const [currentAssessmentId, setCurrentAssessmentId] = useState<number | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [customSectorMode, setCustomSectorMode] = useState(false);
  const [customActivityMode, setCustomActivityMode] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const assessments = readRiskAssessments(userId);
        setSavedAssessments(assessments);

        if (userId) {
          writeRiskAssessments(userId, assessments);
        }
      } catch {
        setNotice("Could not load saved risk assessments.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const summary = useMemo(() => {
    const highInitialRisks = hazards.filter(
      (hazard) =>
        riskLevel(
          riskScore(hazard.initialProbability, hazard.initialSeverity),
        ) === "High",
    ).length;
    const highResidualRisks = hazards.filter(
      (hazard) =>
        riskLevel(
          riskScore(hazard.residualProbability, hazard.residualSeverity),
        ) === "High",
    ).length;
    const openActions = hazards.filter(
      (hazard) => hazard.status !== "Closed",
    ).length;

    return {
      totalHazards: hazards.length,
      highInitialRisks,
      highResidualRisks,
      openActions,
    };
  }, [hazards]);
  const isLibrarySector = sectorOptions.includes(header.sector);
  const sectorSelectValue =
    customSectorMode || (header.sector && !isLibrarySector)
      ? customLibraryOption
      : header.sector;
  const activityOptions = activitiesBySector[header.sector] ?? [];
  const isLibraryActivity = activityOptions.includes(header.activity);
  const activitySelectValue =
    customActivityMode || (header.activity && !isLibraryActivity)
      ? customLibraryOption
      : header.activity;
  const sectorSelectOptions = [
    ...sectorOptions.map((sector) => ({ value: sector, label: sector })),
    { value: customLibraryOption, label: "Other / Manual" },
  ];
  const activitySelectOptions = [
    ...activityOptions.map((activity) => ({
      value: activity,
      label: activity,
    })),
    { value: customLibraryOption, label: "Other / Manual" },
  ];
  const canGenerateWorkingAtHeight =
    header.sector === "Construction" && header.activity === "Working at Height";
  const hasEnteredHazardData = hazards.some((hazard) => {
    const emptyHazard = createEmptyHazard();

    return (
      hazard.workplaceActivity.trim().length > 0 ||
      hazard.hazardDescription.trim().length > 0 ||
      hazard.whoMayBeHarmed.trim().length > 0 ||
      hazard.possibleConsequence.trim().length > 0 ||
      hazard.existingMeasures.trim().length > 0 ||
      hazard.additionalMeasures.trim().length > 0 ||
      hazard.responsiblePerson.trim().length > 0 ||
      hazard.completionDeadline.trim().length > 0 ||
      hazard.comments.trim().length > 0 ||
      hazard.initialProbability !== emptyHazard.initialProbability ||
      hazard.initialSeverity !== emptyHazard.initialSeverity ||
      hazard.residualProbability !== emptyHazard.residualProbability ||
      hazard.residualSeverity !== emptyHazard.residualSeverity ||
      hazard.status !== emptyHazard.status ||
      hazard.controlHierarchy.join("|") !== emptyHazard.controlHierarchy.join("|")
    );
  });

  const updateHeader = (
    field: keyof RiskAssessmentHeader,
    value: string,
  ) => {
    setHeader((current) => ({ ...current, [field]: value }));
  };

  const updateSector = (sector: string) => {
    if (sector === customLibraryOption) {
      setCustomSectorMode(true);
      setCustomActivityMode(false);
      setHeader((current) => ({
        ...current,
        sector: sectorOptions.includes(current.sector) ? "" : current.sector,
        activity: "",
      }));
      return;
    }

    setCustomSectorMode(false);
    setCustomActivityMode(false);
    setHeader((current) => {
      const nextActivities = activitiesBySector[sector] ?? [];

      return {
        ...current,
        sector,
        activity: nextActivities.includes(current.activity)
          ? current.activity
          : "",
      };
    });
  };

  const updateActivity = (activity: string) => {
    if (activity === customLibraryOption) {
      setCustomActivityMode(true);
      setHeader((current) => ({
        ...current,
        activity: activityOptions.includes(current.activity)
          ? ""
          : current.activity,
      }));
      return;
    }

    setCustomActivityMode(false);
    updateHeader("activity", activity);
  };

  const updateHazard = <Key extends keyof HazardRow>(
    id: string,
    field: Key,
    value: HazardRow[Key],
  ) => {
    setHazards((current) =>
      current.map((hazard) =>
        hazard.id === id ? { ...hazard, [field]: value } : hazard,
      ),
    );
  };

  const addHazard = () => {
    setHazards((current) => [...current, createEmptyHazard()]);
  };

  const duplicateHazard = (hazard: HazardRow) => {
    setHazards((current) => [
      ...current,
      {
        ...hazard,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    ]);
  };

  const deleteHazard = (id: string) => {
    setHazards((current) => current.filter((hazard) => hazard.id !== id));
  };

  const toggleControlHierarchy = (id: string, option: ControlHierarchy) => {
    setHazards((current) =>
      current.map((hazard) => {
        if (hazard.id !== id) {
          return hazard;
        }

        const hasOption = hazard.controlHierarchy.includes(option);
        return {
          ...hazard,
          controlHierarchy: hasOption
            ? hazard.controlHierarchy.filter((item) => item !== option)
            : [...hazard.controlHierarchy, option],
        };
      }),
    );
  };

  const generateWorkingAtHeightAssessment = () => {
    if (hazards.length > 0 && hasEnteredHazardData) {
      const shouldReplace = window.confirm(
        "This will replace current hazard rows. Continue?",
      );

      if (!shouldReplace) {
        return;
      }
    }

    setHeader((current) => ({
      ...current,
      sector: "Construction",
      activity: "Working at Height",
      title:
        current.title.trim().length > 0
          ? current.title
          : "Construction - Working at Height Risk Assessment",
    }));
    setCustomSectorMode(false);
    setCustomActivityMode(false);
    setHazards(createWorkingAtHeightHazards());
    setCurrentAssessmentId(null);
    setNotice("Risk assessment generated from Laboria HSE Library.");
  };

  const newAssessment = () => {
    setHeader(createEmptyHeader());
    setHazards([createEmptyHazard()]);
    setCurrentAssessmentId(null);
    setCustomSectorMode(false);
    setCustomActivityMode(false);
    setNotice("New risk assessment started.");
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };

  const saveAssessment = () => {
    try {
      const assessment: SavedRiskAssessment = {
        id: currentAssessmentId ?? Date.now(),
        header,
        hazards,
        savedAt: new Date().toISOString(),
      };
      const updated = mergeSavedRiskAssessments([
        assessment,
        ...savedAssessments.filter((item) => item.id !== assessment.id),
      ]);

      writeRiskAssessments(userId, updated);
      setSavedAssessments(updated);
      setCurrentAssessmentId(assessment.id);
      setNotice("Risk assessment saved.");
    } catch {
      setNotice("Could not save this risk assessment.");
    }
  };

  const loadAssessment = (assessment: SavedRiskAssessment) => {
    const normalizedAssessment = normalizeSavedRiskAssessment(assessment);
    const nextActivities =
      activitiesBySector[normalizedAssessment.header.sector] ?? [];

    setHeader({
      ...createEmptyHeader(),
      ...normalizedAssessment.header,
    });
    setHazards(
      normalizedAssessment.hazards.length > 0
        ? normalizedAssessment.hazards
        : [createEmptyHazard()],
    );
    setCustomSectorMode(
      Boolean(normalizedAssessment.header.sector) &&
        !sectorOptions.includes(normalizedAssessment.header.sector),
    );
    setCustomActivityMode(
      Boolean(normalizedAssessment.header.activity) &&
        !nextActivities.includes(normalizedAssessment.header.activity),
    );
    setCurrentAssessmentId(normalizedAssessment.id);
    setNotice("Risk assessment loaded.");
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };

  const deleteAssessment = (id: number) => {
    try {
      const updated = savedAssessments.filter((item) => item.id !== id);
      writeRiskAssessments(userId, updated);
      setSavedAssessments(updated);

      if (currentAssessmentId === id) {
        setCurrentAssessmentId(null);
      }

      setNotice("Saved risk assessment deleted.");
    } catch {
      setNotice("Could not delete this risk assessment.");
    }
  };

  const exportRiskAssessmentPDF = async () => {
    const element = document.getElementById("risk-assessment-export");
    if (!element) {
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sideMargin = 10;
    const topMargin = 10;
    const footerTop = pageHeight - 22;
    const contentHeight = footerTop - topMargin;
    const imgWidth = pageWidth - sideMargin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let pageIndex = 0;

    pdf.addImage(imgData, "PNG", sideMargin, topMargin, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    while (heightLeft > 0) {
      pageIndex += 1;
      pdf.addPage();
      pdf.addImage(
        imgData,
        "PNG",
        sideMargin,
        topMargin - pageIndex * contentHeight,
        imgWidth,
        imgHeight,
      );
      heightLeft -= contentHeight;
    }

    const totalPages = pdf.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      pdf.setPage(pageNumber);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, footerTop, pageWidth, pageHeight - footerTop, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.line(sideMargin, footerTop + 2, pageWidth - sideMargin, footerTop + 2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        "Generated by Laboria HSE Workspace",
        sideMargin,
        footerTop + 8,
      );
      pdf.text("Confidential risk assessment report", sideMargin, footerTop + 13);
      pdf.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - sideMargin,
        footerTop + 11,
        { align: "right" },
      );
    }

    const safeName = (header.title || "Risk_Assessment")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    pdf.save(`LABORIA_${safeName || "Risk_Assessment"}.pdf`);
  };

  const summaryCards = [
    { label: "Total hazards", value: summary.totalHazards, tone: "text-white" },
    {
      label: "High initial risks",
      value: summary.highInitialRisks,
      tone: "text-rose-300",
    },
    {
      label: "High residual risks",
      value: summary.highResidualRisks,
      tone: "text-amber-200",
    },
    { label: "Open actions", value: summary.openActions, tone: "text-cyan-200" },
  ];

  return (
    <div className="relative z-10 min-h-screen w-full min-w-0 px-4 py-24 text-[#F5F7FA] sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#071225]/82 shadow-[0_30px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div className="border-b border-white/10 bg-white/[0.035] px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Risk Assessments
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  5x5 Workplace Risk Assessment
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Manually document hazards, evaluate initial and residual risk,
                  assign controls, and export a professional Laboria report.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={newAssessment}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
                >
                  <FileText size={16} aria-hidden />
                  New
                </button>
                <button
                  type="button"
                  onClick={saveAssessment}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                >
                  <Save size={16} aria-hidden />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => void exportRiskAssessmentPDF()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#4DEBFF]/30 bg-[#4DEBFF]/10 px-4 py-3 text-sm font-semibold text-[#DDFBFF] transition hover:bg-[#4DEBFF]/15"
                >
                  <Download size={16} aria-hidden />
                  Export PDF
                </button>
              </div>
            </div>

            {notice ? (
              <div className="mt-4 rounded-xl border border-[#4DEBFF]/20 bg-[#4DEBFF]/10 px-4 py-3 text-sm font-semibold text-[#DDFBFF]">
                {notice}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {card.label}
                </div>
                <div className={`mt-3 text-3xl font-bold ${card.tone}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#071225]/72 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Assessment header</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Core context for the risk assessment report.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field
                  label="Company name"
                  value={header.company}
                  onChange={(value) => updateHeader("company", value)}
                />
                <Field
                  label="Site / Location"
                  value={header.site}
                  onChange={(value) => updateHeader("site", value)}
                />
                <Field
                  label="Department / Area"
                  value={header.department}
                  onChange={(value) => updateHeader("department", value)}
                />
                <Field
                  label="Assessment title"
                  value={header.title}
                  onChange={(value) => updateHeader("title", value)}
                />
                <Field
                  label="Assessor"
                  value={header.assessor}
                  onChange={(value) => updateHeader("assessor", value)}
                />
                <Field
                  label="Assessment date"
                  value={header.assessmentDate}
                  onChange={(value) => updateHeader("assessmentDate", value)}
                  type="date"
                />
                <SelectField
                  label="Sector / Category"
                  value={sectorSelectValue}
                  onChange={updateSector}
                  options={sectorSelectOptions}
                  placeholder="Select sector"
                />
                {customSectorMode ? (
                  <Field
                    label="Custom sector / category"
                    value={header.sector}
                    onChange={(value) => updateHeader("sector", value)}
                  />
                ) : null}
                {!customSectorMode ? (
                  <SelectField
                    label="Activity / Task"
                    value={activitySelectValue}
                    onChange={updateActivity}
                    options={activitySelectOptions}
                    placeholder={
                      header.sector
                        ? "Select activity"
                        : "Select sector first"
                    }
                    disabled={!header.sector}
                  />
                ) : (
                  <Field
                    label="Activity / Task"
                    value={header.activity}
                    onChange={(value) => updateHeader("activity", value)}
                  />
                )}
                {!customSectorMode && customActivityMode ? (
                  <Field
                    label="Custom activity / task"
                    value={header.activity}
                    onChange={(value) => updateHeader("activity", value)}
                  />
                ) : null}
              </div>

              {canGenerateWorkingAtHeight ? (
                <div className="mt-5 rounded-2xl border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#DDFBFF]">
                        Laboria HSE Library prototype available
                      </div>
                      <p className="mt-1 text-sm text-slate-300">
                        Generate a complete editable 6-hazard assessment for
                        Construction - Working at Height.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateWorkingAtHeightAssessment}
                      className="rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                    >
                      Generate Risk Assessment
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#071225]/72 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Hazard register</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Add hazards and score initial and residual risk using the
                    5x5 matrix.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addHazard}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  Add hazard
                </button>
              </div>

              <div className="mt-5 space-y-5">
                {hazards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center text-sm text-slate-400">
                    No hazards added yet.
                  </div>
                ) : null}

                {hazards.map((hazard, index) => {
                  const initialScore = riskScore(
                    hazard.initialProbability,
                    hazard.initialSeverity,
                  );
                  const residualScore = riskScore(
                    hazard.residualProbability,
                    hazard.residualSeverity,
                  );

                  return (
                    <div
                      key={hazard.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#4DEBFF]">
                            Hazard row {index + 1}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <RiskBadge score={initialScore} />
                            <RiskBadge score={residualScore} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => duplicateHazard(hazard)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.09]"
                          >
                            <Copy size={14} aria-hidden />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHazard(hazard.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
                          >
                            <Trash2 size={14} aria-hidden />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Field
                          label="Workplace / Process / Activity"
                          value={hazard.workplaceActivity}
                          onChange={(value) =>
                            updateHazard(
                              hazard.id,
                              "workplaceActivity",
                              value,
                            )
                          }
                        />
                        <Field
                          label="Who may be harmed"
                          value={hazard.whoMayBeHarmed}
                          onChange={(value) =>
                            updateHazard(hazard.id, "whoMayBeHarmed", value)
                          }
                        />
                        <TextAreaField
                          label="Hazard description"
                          value={hazard.hazardDescription}
                          onChange={(value) =>
                            updateHazard(hazard.id, "hazardDescription", value)
                          }
                        />
                        <TextAreaField
                          label="Possible consequence"
                          value={hazard.possibleConsequence}
                          onChange={(value) =>
                            updateHazard(
                              hazard.id,
                              "possibleConsequence",
                              value,
                            )
                          }
                        />
                        <TextAreaField
                          label="Existing preventive measures"
                          value={hazard.existingMeasures}
                          onChange={(value) =>
                            updateHazard(hazard.id, "existingMeasures", value)
                          }
                        />
                        <TextAreaField
                          label="Additional preventive measures"
                          value={hazard.additionalMeasures}
                          onChange={(value) =>
                            updateHazard(
                              hazard.id,
                              "additionalMeasures",
                              value,
                            )
                          }
                        />
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-[#071225]/60 p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold">
                              Initial risk
                            </h3>
                            <RiskBadge score={initialScore} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label>
                              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                                Initial Probability
                              </span>
                              <select
                                value={hazard.initialProbability}
                                onChange={(event) =>
                                  updateHazard(
                                    hazard.id,
                                    "initialProbability",
                                    toRiskValue(event.target.value),
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-[#4DEBFF]/45"
                              >
                                {riskValues.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                                Initial Severity
                              </span>
                              <select
                                value={hazard.initialSeverity}
                                onChange={(event) =>
                                  updateHazard(
                                    hazard.id,
                                    "initialSeverity",
                                    toRiskValue(event.target.value),
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-[#4DEBFF]/45"
                              >
                                {riskValues.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                Initial Risk Score
                              </div>
                              <div className="mt-2 text-2xl font-bold text-white">
                                {initialScore}
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                Initial Risk Level
                              </div>
                              <div className="mt-2">
                                <RiskBadge score={initialScore} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#071225]/60 p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold">
                              Residual risk
                            </h3>
                            <RiskBadge score={residualScore} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label>
                              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                                Residual Probability
                              </span>
                              <select
                                value={hazard.residualProbability}
                                onChange={(event) =>
                                  updateHazard(
                                    hazard.id,
                                    "residualProbability",
                                    toRiskValue(event.target.value),
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-[#4DEBFF]/45"
                              >
                                {riskValues.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                                Residual Severity
                              </span>
                              <select
                                value={hazard.residualSeverity}
                                onChange={(event) =>
                                  updateHazard(
                                    hazard.id,
                                    "residualSeverity",
                                    toRiskValue(event.target.value),
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-[#4DEBFF]/45"
                              >
                                {riskValues.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                Residual Risk Score
                              </div>
                              <div className="mt-2 text-2xl font-bold text-white">
                                {residualScore}
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                Residual Risk Level
                              </div>
                              <div className="mt-2">
                                <RiskBadge score={residualScore} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                            Control hierarchy used
                          </span>
                          <div className="grid gap-2">
                            {controlHierarchyOptions.map((option) => (
                              <label
                                key={option}
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                  hazard.controlHierarchy.includes(option)
                                    ? "border-[#4DEBFF]/40 bg-[#4DEBFF]/10 text-[#DDFBFF]"
                                    : "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={hazard.controlHierarchy.includes(
                                    option,
                                  )}
                                  onChange={() =>
                                    toggleControlHierarchy(hazard.id, option)
                                  }
                                  className="h-4 w-4 accent-[#1E90FF]"
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        </div>
                        <Field
                          label="Responsible person"
                          value={hazard.responsiblePerson}
                          onChange={(value) =>
                            updateHazard(hazard.id, "responsiblePerson", value)
                          }
                        />
                        <Field
                          label="Completion deadline / date"
                          value={hazard.completionDeadline}
                          onChange={(value) =>
                            updateHazard(
                              hazard.id,
                              "completionDeadline",
                              value,
                            )
                          }
                          type="date"
                        />
                        <label>
                          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                            Status
                          </span>
                          <select
                            value={hazard.status}
                            onChange={(event) =>
                              updateHazard(
                                hazard.id,
                                "status",
                                event.target.value as ActionStatus,
                              )
                            }
                            className="w-full rounded-xl border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-[#4DEBFF]/45"
                          >
                            {actionStatusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-5">
                        <TextAreaField
                          label="Comments / Notes"
                          value={hazard.comments}
                          onChange={(value) =>
                            updateHazard(hazard.id, "comments", value)
                          }
                          rows={2}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <RiskMatrixGuide />

            <section className="rounded-3xl border border-white/10 bg-[#071225]/72 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Saved assessments</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Load previous manual risk assessments.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {savedAssessments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-sm text-slate-400">
                    No saved risk assessments yet.
                  </div>
                ) : null}

                {savedAssessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className={`rounded-2xl border p-4 transition ${
                      currentAssessmentId === assessment.id
                        ? "border-[#4DEBFF]/35 bg-[#4DEBFF]/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <div className="font-semibold text-white">
                      {assessment.header.title || "Untitled risk assessment"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      {assessment.header.company || "No company"} -{" "}
                      {assessment.header.assessmentDate || "No date"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadAssessment(assessment)}
                        className="rounded-lg bg-[#1E90FF] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1878d6]"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAssessment(assessment.id)}
                        className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <div
        id="risk-assessment-export"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "1120px",
          background: "#F8FAFC",
          color: "#0F172A",
          padding: "34px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            borderRadius: "22px",
            overflow: "hidden",
            background: "#071225",
            color: "#FFFFFF",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              padding: "24px 28px",
              background:
                "radial-gradient(circle at 85% 18%, rgba(77,235,255,0.20), transparent 28%), linear-gradient(135deg, #071225 0%, #0B1A33 62%, #102B4E 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "24px",
              }}
            >
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "12px 16px",
                  width: "190px",
                  minHeight: "58px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Image
                  src="/laboria-logo.png"
                  alt="Laboria"
                  width={168}
                  height={54}
                  style={{ width: "160px", height: "auto", objectFit: "contain" }}
                  priority
                />
              </div>
              <div style={{ textAlign: "right", fontSize: "12px" }}>
                <div
                  style={{
                    color: "#4DEBFF",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                  }}
                >
                  RISK ASSESSMENT REPORT
                </div>
                <div style={{ marginTop: "8px", color: "#D6E7F7" }}>
                  Assessment date
                </div>
                <div style={{ fontWeight: 800 }}>
                  {header.assessmentDate || "Not provided"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "26px" }}>
              <div
                style={{
                  color: "#4DEBFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Laboria HSE Workspace
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "30px",
                  lineHeight: 1.15,
                  fontWeight: 900,
                }}
              >
                {header.title || "Risk Assessment"}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  maxWidth: "720px",
                  color: "#D6E7F7",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Manual 5x5 matrix assessment with initial and residual risk
                scoring.
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {[
            ["Company", header.company],
            ["Site / Location", header.site],
            ["Department / Area", header.department],
            ["Assessor", header.assessor],
            ["Sector / Category", header.sector],
            ["Activity / Task", header.activity],
            ["Assessment date", header.assessmentDate],
            ["Saved hazards", String(hazards.length)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  color: "#64748B",
                  fontSize: "10px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 800 }}>
                {value || "Not provided"}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {summaryCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  color: "#64748B",
                  fontSize: "10px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  color: "#071225",
                  fontSize: "28px",
                  fontWeight: 900,
                  marginTop: "8px",
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "18px",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "10px",
            }}
          >
            <thead>
              <tr style={{ background: "#0B1A33", color: "#FFFFFF" }}>
                {[
                  "Activity",
                  "Hazard",
                  "Harmed",
                  "Consequence",
                  "Existing controls",
                  "Initial",
                  "Additional controls",
                  "Hierarchy",
                  "Residual",
                  "Owner / Date",
                  "Status",
                  "Notes",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "9px",
                      textAlign: "left",
                      borderRight: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hazards.map((hazard) => {
                const initialScore = riskScore(
                  hazard.initialProbability,
                  hazard.initialSeverity,
                );
                const residualScore = riskScore(
                  hazard.residualProbability,
                  hazard.residualSeverity,
                );
                const initialLevel = riskLevel(initialScore);
                const residualLevel = riskLevel(residualScore);

                return (
                  <tr key={hazard.id}>
                    {[
                      hazard.workplaceActivity,
                      hazard.hazardDescription,
                      hazard.whoMayBeHarmed,
                      hazard.possibleConsequence,
                      hazard.existingMeasures,
                      `${hazard.initialProbability} x ${hazard.initialSeverity} = ${initialScore} (${initialLevel})`,
                      hazard.additionalMeasures,
                      hazard.controlHierarchy.join(", "),
                      `${hazard.residualProbability} x ${hazard.residualSeverity} = ${residualScore} (${residualLevel})`,
                      `${hazard.responsiblePerson || "Not assigned"} / ${
                        hazard.completionDeadline || "No date"
                      }`,
                      hazard.status,
                      hazard.comments,
                    ].map((value, index) => {
                      const isInitial = index === 5;
                      const isResidual = index === 8;
                      const tone = riskTone(
                        isInitial ? initialLevel : residualLevel,
                      );

                      return (
                        <td
                          key={`${hazard.id}-${index}`}
                          style={{
                            padding: "9px",
                            verticalAlign: "top",
                            borderTop: "1px solid #E2E8F0",
                            borderRight: "1px solid #E2E8F0",
                            background:
                              isInitial || isResidual ? tone.exportBg : "#FFFFFF",
                            color:
                              isInitial || isResidual
                                ? tone.exportText
                                : "#0F172A",
                            fontWeight: isInitial || isResidual ? 800 : 500,
                            lineHeight: 1.45,
                          }}
                        >
                          {value || "Not provided"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
