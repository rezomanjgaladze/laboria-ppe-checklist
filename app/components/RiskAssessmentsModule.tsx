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

const constructionActivityOptions = [
  "Working at Height",
  "Excavation and trenching",
  "Scaffolding erection",
  "Electrical installation",
  "Welding",
  "Confined space entry",
  "Crane lifting operations",
  "Forklift operation",
  "Demolition",
  "Manual handling of materials",
  "Site mobilization and demobilization",
  "Temporary fencing and access control",
  "Temporary power distribution",
  "Site traffic route setup",
  "Pedestrian walkway setup",
  "Material laydown area setup",
  "Housekeeping and waste segregation",
  "Shoring and trench support",
  "Dewatering works",
  "Backfilling and compaction",
  "Ground leveling and grading",
  "Pile driving",
  "Bored piling",
  "Foundation preparation",
  "Underground utility locating",
  "Work near buried services",
  "Rebar cutting and bending",
  "Rebar fixing",
  "Formwork installation",
  "Formwork removal",
  "Concrete pouring",
  "Concrete pumping",
  "Concrete curing",
  "Masonry block laying",
  "Steel fixing",
  "Structural steel erection",
  "Bolting and torqueing",
  "Precast concrete installation",
  "Ladder work",
  "Roof work",
];

const sectorOptions = ["Construction"];
const activitiesBySector: Record<string, string[]> = {
  Construction: constructionActivityOptions,
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

const createLibraryHazards = (
  hazards: Array<Partial<HazardRow>>,
): HazardRow[] => hazards.map((hazard) => createLibraryHazard(hazard));

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

const createExcavationAndTrenchingHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Excavation and trenching works",
    hazardDescription:
      "Collapse of trench or excavation side walls due to unsupported ground, vibration, surcharge loading, or changing soil conditions",
    whoMayBeHarmed: "Workers inside excavation, supervisors, contractors",
    possibleConsequence:
      "Crushing injury, asphyxiation, serious injury, fatality",
    existingMeasures:
      "Excavation inspected before work; access restricted; spoil kept away from edges; workers briefed on excavation hazards",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use engineered shoring, trench boxes, battering, or benching; competent person to inspect after weather changes; keep plant and materials away from excavation edges; stop work if ground movement is observed",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Access around open excavations",
    hazardDescription:
      "Falls of persons into open excavations due to unprotected edges, poor lighting, or unclear walkways",
    whoMayBeHarmed: "Workers, contractors, visitors, delivery drivers",
    possibleConsequence: "Fractures, head injury, sprains, serious injury",
    existingMeasures:
      "Excavation areas identified; basic barricades or warning tape used; site access routes communicated",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Install rigid edge protection and warning signs; provide safe crossing points; maintain lighting for low visibility work; keep pedestrian routes clear and separated from excavation edges",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Excavation near buried services",
    hazardDescription:
      "Contact with buried electrical cables, gas lines, water mains, or communication services during digging",
    whoMayBeHarmed: "Excavator operators, ground workers, nearby workers",
    possibleConsequence:
      "Electric shock, explosion, burns, flooding, service outage, fatality",
    existingMeasures:
      "Available service drawings reviewed; excavation permit used; visual checks completed before digging",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Scan and mark services before work; hand dig near known services; isolate services where possible; use permit-to-dig controls; brief operators and spotters on service locations",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Excavations exposed to rain, groundwater, or flooding",
    hazardDescription:
      "Water ingress causing ground instability, slippery access, or rapid flooding of excavation",
    whoMayBeHarmed: "Workers inside excavation, plant operators",
    possibleConsequence: "Drowning, slips, collapse injury, equipment damage",
    existingMeasures:
      "Weather conditions checked; excavation visually inspected; pumps available where required",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Install dewatering controls; define stop-work criteria for water ingress; inspect after rain; provide safe drainage; remove workers immediately if water affects excavation stability",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Movement of plant and vehicles near excavations",
    hazardDescription:
      "Collision between mobile plant and pedestrians, or plant operating too close to excavation edges",
    whoMayBeHarmed: "Ground workers, plant operators, banksmen, visitors",
    possibleConsequence:
      "Crushing injury, struck-by injury, excavation collapse, fatality",
    existingMeasures:
      "Plant operators trained; reversing alarms used; basic pedestrian routes established",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Create plant exclusion zones; use banksmen for reversing and tight areas; define minimum approach distances from excavation edges; separate pedestrian and plant routes with barriers",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Deep excavations or excavations with poor ventilation",
    hazardDescription:
      "Hazardous atmosphere, oxygen deficiency, or accumulation of gases in excavation",
    whoMayBeHarmed: "Workers entering excavation, rescue personnel",
    possibleConsequence:
      "Asphyxiation, poisoning, loss of consciousness, fatality",
    existingMeasures:
      "Supervisors aware of excavation depth; workers instructed not to enter if unusual odor or symptoms are present",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Test atmosphere before entry where risk exists; ventilate excavation; classify as confined space if required; prepare emergency rescue arrangements; restrict unauthorized entry",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Storage of spoil and materials near excavation edges",
    hazardDescription:
      "Spoil, materials, or loose ground falling into excavation or increasing pressure on excavation walls",
    whoMayBeHarmed: "Workers in excavation, ground workers nearby",
    possibleConsequence: "Struck-by injury, burial, fractures, fatality",
    existingMeasures:
      "Spoil piles positioned away from immediate work area where possible; housekeeping checks completed",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Set minimum spoil setback distance; secure loose materials; remove excess spoil from site; inspect edge condition frequently; prohibit storage on unsupported excavation edges",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
];

const createScaffoldingErectionHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Scaffold erection, alteration, and dismantling",
    hazardDescription:
      "Fall from height during scaffold erection before full guardrails, decks, or access systems are in place",
    whoMayBeHarmed: "Scaffolders, contractors, supervisors",
    possibleConsequence:
      "Serious injury, fractures, spinal injury, fatality",
    existingMeasures:
      "Scaffolders trained; fall protection equipment available; erection sequence planned before work starts",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use advanced guardrail or collective protection systems where possible; follow approved erection method statement; maintain 100 percent tie-off where required; supervise high-risk stages",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Handling scaffold components at height",
    hazardDescription:
      "Falling tubes, boards, couplers, or tools during lifting and assembly",
    whoMayBeHarmed: "Workers below, scaffolders, pedestrians, visitors",
    possibleConsequence: "Head injury, cuts, fractures, fatality",
    existingMeasures:
      "Hard hats required; work area controlled; scaffold components stacked in designated areas",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Establish exclusion zone below scaffold work; use tool lanyards and controlled lifting methods; secure loose components immediately; install warning signs and barriers",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Use of incomplete or unauthorized scaffold",
    hazardDescription:
      "Workers accessing unstable, incomplete, or uninspected scaffold before handover",
    whoMayBeHarmed: "All site workers, contractors, visitors",
    possibleConsequence: "Fall injury, scaffold failure, serious injury",
    existingMeasures:
      "Scaffold tags used; supervisors instructed to restrict access to incomplete scaffold",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use clear scaffold status tagging; physically prevent access to incomplete lifts; complete formal inspection and handover before use; communicate restrictions during toolbox talks",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Manual handling of scaffold tubes, boards, and fittings",
    hazardDescription:
      "Musculoskeletal injury from lifting heavy or awkward scaffold components repeatedly",
    whoMayBeHarmed: "Scaffolders, laborers",
    possibleConsequence: "Back injury, strains, sprains, hand injury",
    existingMeasures:
      "Workers briefed on lifting technique; gloves available; components stored near work area",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Use mechanical aids or gin wheels where practical; team lift long or heavy components; plan material laydown close to erection point; rotate tasks to reduce repetition",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Scaffold foundation and base preparation",
    hazardDescription:
      "Poor ground conditions, inadequate sole boards, or uneven bases causing scaffold instability",
    whoMayBeHarmed: "Scaffold users, scaffolders, workers nearby",
    possibleConsequence: "Scaffold movement, collapse, serious injury, fatality",
    existingMeasures:
      "Ground visually checked; base plates and sole boards available; scaffold design considered for height and loading",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Assess ground bearing capacity; use suitable sole boards and base plates; level scaffold before loading; inspect after rain, settlement, or impact; follow design for loading and ties",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Scaffolding near overhead electrical services",
    hazardDescription:
      "Contact with overhead power lines or energized services during scaffold erection",
    whoMayBeHarmed: "Scaffolders, plant operators, nearby workers",
    possibleConsequence: "Electric shock, burns, arc flash, fatality",
    existingMeasures:
      "Overhead services visually identified; workers advised to maintain clearance",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Isolate or reroute services where possible; establish exclusion distances; use non-conductive controls if needed; include overhead service controls in method statement and permit",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createElectricalInstallationHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Electrical installation and connection work",
    hazardDescription:
      "Electric shock from contact with live conductors, exposed terminals, or improperly isolated circuits",
    whoMayBeHarmed: "Electricians, assistants, contractors, nearby workers",
    possibleConsequence: "Electric shock, burns, cardiac arrest, fatality",
    existingMeasures:
      "Qualified electricians assigned; insulated tools available; basic isolation procedures used",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Verify isolation and test before touch; apply lockout/tagout; use permit-to-work for energized risk; maintain barriers around open panels; supervise non-routine work",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Switchgear, panels, and distribution boards",
    hazardDescription:
      "Arc flash or electrical burns during testing, fault finding, or switching operations",
    whoMayBeHarmed: "Electricians, commissioning team, nearby workers",
    possibleConsequence: "Severe burns, eye injury, blast injury, fatality",
    existingMeasures:
      "Access restricted to competent persons; panel covers kept closed where possible; PPE available",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Complete arc flash risk assessment; use remote switching where possible; wear arc-rated PPE where required; keep non-essential workers outside arc flash boundary",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Temporary power and extension leads on site",
    hazardDescription:
      "Damaged temporary wiring, overloaded circuits, poor cable routing, or wet electrical connections",
    whoMayBeHarmed: "All site workers, contractors, visitors",
    possibleConsequence: "Electric shock, fire, burns, trips",
    existingMeasures:
      "Temporary distribution boards used; visual checks completed; damaged leads removed when identified",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Inspect and tag temporary electrical equipment; protect cables from damage; use RCD/GFCI protection; keep connections raised and dry; remove unauthorized adapters",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Electrical work near live or adjacent circuits",
    hazardDescription:
      "Accidental contact with adjacent energized circuits while installing or modifying electrical systems",
    whoMayBeHarmed: "Electricians, contractors, maintenance personnel",
    possibleConsequence: "Electric shock, burns, arc flash, fatality",
    existingMeasures:
      "Work areas identified; workers instructed to avoid exposed live parts; competent supervision available",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "De-energize adjacent circuits where possible; install insulated barriers and covers; mark live equipment clearly; use controlled access and detailed switching plan",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Isolation and lockout before electrical work",
    hazardDescription:
      "Incorrect isolation, unexpected energization, or failure to verify zero energy",
    whoMayBeHarmed: "Electricians, commissioning team, other trades",
    possibleConsequence: "Electric shock, burns, fatality, equipment damage",
    existingMeasures:
      "Isolation points identified; supervisors authorize electrical work; workers trained in basic lockout controls",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use formal lockout/tagout register; apply personal locks; test for dead using approved tester; control stored energy; record handover between shifts",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Cable installation and work area housekeeping",
    hazardDescription:
      "Trips, slips, and damaged cables caused by poor routing, cluttered work areas, or trailing leads",
    whoMayBeHarmed: "Electricians, other trades, visitors",
    possibleConsequence: "Sprains, falls, cable damage, electric shock",
    existingMeasures:
      "Housekeeping checks carried out; cable routes reviewed during installation",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Route cables overhead or through protected cable ramps; remove unused leads; maintain tidy work zones; inspect cable protection daily in active areas",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
];

const createWeldingHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Welding and hot work",
    hazardDescription:
      "Contact with hot metal, sparks, slag, or welding equipment causing burns",
    whoMayBeHarmed: "Welders, helpers, nearby workers",
    possibleConsequence: "Skin burns, eye injury, fire ignition, serious injury",
    existingMeasures:
      "Welders trained; welding gloves, helmet, and protective clothing available; hot work area identified",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Use fire-resistant clothing and screens; keep hot materials marked and isolated; allow cooling time before handling; brief helpers on hot surfaces and spark direction",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Hot work near combustible materials",
    hazardDescription:
      "Fire caused by sparks, molten metal, or heat transfer to combustible materials",
    whoMayBeHarmed: "Welders, nearby workers, emergency responders",
    possibleConsequence: "Fire, smoke inhalation, burns, property damage, fatality",
    existingMeasures:
      "Hot work permit used; fire extinguisher available; obvious combustible materials removed where possible",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Clear or protect combustibles within the hot work zone; assign fire watch; inspect hidden voids; continue fire watch after work; verify extinguishers and emergency access",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Welding fumes and airborne contaminants",
    hazardDescription:
      "Exposure to welding fumes, gases, or metal particulates in poorly ventilated areas",
    whoMayBeHarmed: "Welders, assistants, nearby workers",
    possibleConsequence: "Respiratory irritation, metal fume fever, chronic health effects",
    existingMeasures:
      "General ventilation available; workers instructed to avoid breathing welding plume; respirators available for some tasks",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Use local exhaust ventilation; position workers out of fume plume; select lower-fume consumables where practical; wear suitable respiratory protection after exposure assessment",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Arc welding and cutting operations",
    hazardDescription:
      "Eye injury or arc flash exposure from welding arc, reflected radiation, or inadequate screening",
    whoMayBeHarmed: "Welders, helpers, nearby workers, visitors",
    possibleConsequence: "Arc eye, burns, temporary vision loss, eye injury",
    existingMeasures:
      "Welding helmets used; basic welding screens available; workers informed before welding starts",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Install welding screens around hot work; enforce correct shade eye protection; restrict access to welding area; inspect helmets and lenses before use",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Storage and movement of gas cylinders",
    hazardDescription:
      "Gas cylinder impact, valve damage, leakage, fire, or cylinder instability during handling",
    whoMayBeHarmed: "Welders, material handlers, nearby workers",
    possibleConsequence: "Explosion, fire, crushing injury, asphyxiation",
    existingMeasures:
      "Cylinders stored upright; caps used during transport; gas hoses visually checked",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Secure cylinders to trolleys or racks; separate oxygen and fuel gases; check regulators and flashback arrestors; keep cylinders away from heat and impact zones",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Electric welding equipment",
    hazardDescription:
      "Electric shock from damaged leads, poor grounding, wet conditions, or faulty welding equipment",
    whoMayBeHarmed: "Welders, helpers, electrical maintenance workers",
    possibleConsequence: "Electric shock, burns, fatality",
    existingMeasures:
      "Equipment visually inspected; damaged leads removed when identified; trained welders use equipment",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Inspect welding machines and leads before use; keep electrical connections dry; ensure correct grounding; use RCD/GFCI protection where appropriate; isolate faulty equipment",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createConfinedSpaceEntryHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Entry into tanks, pits, shafts, ducts, or confined areas",
    hazardDescription:
      "Oxygen deficiency or oxygen enrichment due to poor ventilation, displacement, or process residue",
    whoMayBeHarmed: "Entrants, attendants, supervisors, rescue team",
    possibleConsequence:
      "Loss of consciousness, asphyxiation, fire risk, fatality",
    existingMeasures:
      "Confined space entry permit used; entry supervised; workers briefed on confined space hazards",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Test atmosphere before and during entry; ventilate space; prohibit entry if oxygen levels are outside safe range; use competent attendant and rescue-ready arrangements",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Confined space with possible process residues",
    hazardDescription:
      "Toxic or flammable atmosphere from gases, vapors, sludge, or chemical residue",
    whoMayBeHarmed: "Entrants, attendants, rescue personnel",
    possibleConsequence:
      "Poisoning, explosion, fire, respiratory injury, fatality",
    existingMeasures:
      "Known contents reviewed; space isolated where possible; gas detector available",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Clean and purge space before entry; isolate connected lines; use calibrated multi-gas monitoring; control ignition sources; provide suitable respiratory protection if required",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Work in silos, pits, or areas containing loose material",
    hazardDescription:
      "Engulfment or entrapment by loose material, liquid, sludge, or unstable stored product",
    whoMayBeHarmed: "Entrants, cleaners, maintenance workers",
    possibleConsequence: "Crushing, drowning, asphyxiation, fatality",
    existingMeasures:
      "Material levels checked; workers instructed not to stand on unstable material; entry authorized by supervisor",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Empty and isolate materials before entry; lock out filling and discharge equipment; use fall prevention and retrieval systems; prohibit entry onto bridging material",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Emergency rescue from confined space",
    hazardDescription:
      "Delayed rescue or unsafe rescue attempt due to restricted access, poor retrieval systems, or lack of rescue plan",
    whoMayBeHarmed: "Entrants, attendants, rescue personnel",
    possibleConsequence: "Serious injury, multiple casualties, fatality",
    existingMeasures:
      "Emergency contacts known; attendant assigned; basic first aid arrangements available",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Prepare task-specific rescue plan; provide tripod, winch, harness, or retrieval equipment; train rescue team; do not rely only on external emergency services",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Confined space work in hot or humid conditions",
    hazardDescription:
      "Heat stress or fatigue caused by restricted ventilation, PPE, physical effort, or high ambient temperature",
    whoMayBeHarmed: "Entrants, attendants",
    possibleConsequence:
      "Heat exhaustion, dehydration, reduced alertness, collapse",
    existingMeasures:
      "Workers allowed breaks; drinking water available; supervisors monitor worker condition",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Set work/rest cycles; monitor temperature and worker symptoms; use ventilation or cooling; rotate workers; stop work when heat stress indicators are present",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Communication during confined space entry",
    hazardDescription:
      "Poor communication between entrant, attendant, and supervisor leading to delayed response or unsafe work continuation",
    whoMayBeHarmed: "Entrants, attendants, supervisors",
    possibleConsequence: "Delayed rescue, injury escalation, fatality",
    existingMeasures:
      "Attendant positioned at entry point; workers briefed before entry; radios or verbal communication used",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Define communication method and check-in frequency; test radios before entry; use backup signal method; stop work if communication is lost",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Access control around confined spaces",
    hazardDescription:
      "Unauthorized entry into confined space or entry without permit controls in place",
    whoMayBeHarmed: "Untrained workers, contractors, visitors",
    possibleConsequence: "Exposure to hazardous atmosphere, entrapment, fatality",
    existingMeasures:
      "Confined space entry points known to supervisors; permit required for planned entry",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Lock or barricade entry points; post confined space warning signs; control permits at entry; brief all site personnel that unauthorized entry is prohibited",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createCraneLiftingOperationsHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Crane lifting and load movement",
    hazardDescription:
      "Dropped load due to lifting equipment failure, incorrect rigging, overload, or load instability",
    whoMayBeHarmed: "Riggers, signalers, crane operator, workers nearby",
    possibleConsequence: "Crushing injury, struck-by injury, fatality",
    existingMeasures:
      "Lifting equipment inspected; trained riggers assigned; lift area reviewed before lifting",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Prepare approved lift plan; verify load weight and center of gravity; inspect slings, shackles, hooks, and safety latches; keep workers out of suspended load zone",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Mobile crane setup and operation",
    hazardDescription:
      "Crane overturning due to poor ground conditions, overload, incorrect outrigger setup, or excessive radius",
    whoMayBeHarmed: "Crane operator, riggers, nearby workers, public",
    possibleConsequence: "Multiple serious injuries, fatality, property damage",
    existingMeasures:
      "Crane operator licensed; outriggers used; lifting capacity chart available",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Assess ground bearing capacity; use mats under outriggers; verify radius and load chart; monitor crane level; stop lifting if setup conditions change",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Rigging, slinging, and load attachment",
    hazardDescription:
      "Poor slinging angle, damaged lifting accessories, incorrect attachment points, or unbalanced load",
    whoMayBeHarmed: "Riggers, signalers, workers nearby",
    possibleConsequence: "Dropped load, struck-by injury, crushing, fatality",
    existingMeasures:
      "Riggers trained; lifting accessories visually checked; tag lines available",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use competent rigger to select lifting gear; confirm sling angles and working load limits; protect slings from sharp edges; conduct test lift before full movement",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Lifting operations near people or active work areas",
    hazardDescription:
      "Workers entering lifting exclusion zone or standing beneath suspended loads",
    whoMayBeHarmed: "Site workers, contractors, visitors, public",
    possibleConsequence: "Struck-by injury, crushing injury, fatality",
    existingMeasures:
      "Banksman or signaler used; workers warned before lift; basic barriers installed where possible",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Create controlled lifting zone with barriers; stop adjacent work during lift; use dedicated spotters; never route suspended loads over people",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Crane operations near overhead power lines",
    hazardDescription:
      "Crane boom, load, or rigging contacting overhead electrical lines",
    whoMayBeHarmed: "Crane operator, riggers, signalers, nearby workers",
    possibleConsequence: "Electric shock, burns, fire, fatality",
    existingMeasures:
      "Overhead lines visually identified; operators informed of power line locations",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Isolate power lines where possible; establish no-go zones and physical markers; use dedicated spotter; include power line controls in lift plan",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Communication during lifting operations",
    hazardDescription:
      "Poor signaling, unclear radio communication, or multiple signalers causing unintended crane movement",
    whoMayBeHarmed: "Riggers, crane operator, workers nearby",
    possibleConsequence: "Struck-by injury, dropped load, collision",
    existingMeasures:
      "Signal person assigned; standard hand signals used; radios available for complex lifts",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Agree single signaler before lift; test radios; stop lift if visual or radio contact is lost; conduct pre-lift briefing with all involved workers",
    controlHierarchy: ["Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Outdoor lifting in wind or poor weather",
    hazardDescription:
      "Adverse weather causing load swing, reduced visibility, loss of control, or crane instability",
    whoMayBeHarmed: "Crane operator, riggers, workers nearby",
    possibleConsequence: "Dropped load, collision, overturning, fatality",
    existingMeasures:
      "Weather checked before lifting; lifting stopped during obvious unsafe weather",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Set wind speed limits for lift type and load shape; monitor wind speed during lift; postpone lifts in gusty conditions; use tag lines only where safe and effective",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createForkliftOperationHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Forklift movement in shared work areas",
    hazardDescription:
      "Collision between forklift and pedestrians due to shared routes, blind corners, or poor segregation",
    whoMayBeHarmed: "Pedestrians, forklift operators, contractors, visitors",
    possibleConsequence: "Crushing injury, fractures, fatality",
    existingMeasures:
      "Forklift operators trained; horns and reversing alarms used; some pedestrian routes marked",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Separate pedestrian and forklift routes with barriers; use mirrors at blind corners; enforce speed limits; create controlled crossing points; brief visitors on traffic routes",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Forklift travel and turning",
    hazardDescription:
      "Forklift overturning due to excessive speed, sharp turns, uneven ground, slopes, or elevated load",
    whoMayBeHarmed: "Forklift operator, pedestrians nearby",
    possibleConsequence: "Crushing injury, serious injury, fatality",
    existingMeasures:
      "Operators trained; seatbelts fitted; forklift inspection completed before use",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Enforce seatbelt use; lower loads during travel; avoid sharp turns and slopes; inspect route surfaces; remove forklifts from uneven or unsuitable ground",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Transporting palletized or loose materials",
    hazardDescription:
      "Falling loads caused by unstable stacking, damaged pallets, poor load securing, or incorrect fork positioning",
    whoMayBeHarmed: "Forklift operator, warehouse workers, nearby contractors",
    possibleConsequence: "Struck-by injury, crushing, fractures",
    existingMeasures:
      "Loads checked visually; damaged pallets rejected when identified; operators trained in load handling",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Secure unstable loads before movement; keep forks fully inserted and level; do not move loads above rated capacity; use attachments only when approved",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Reversing and maneuvering forklifts",
    hazardDescription:
      "Poor visibility while reversing, turning, or moving around stacked materials and vehicles",
    whoMayBeHarmed: "Pedestrians, banksmen, delivery drivers, operators",
    possibleConsequence: "Collision, crushing injury, serious injury",
    existingMeasures:
      "Forklifts fitted with mirrors or alarms; operators instructed to look in direction of travel",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Use spotter for restricted visibility; keep travel routes clear; improve lighting; install cameras or proximity aids where needed; reverse slowly and sound horn at blind points",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Loading and unloading vehicles",
    hazardDescription:
      "Unsafe loading, trailer movement, dock edge falls, or forklift entering unstable trailers",
    whoMayBeHarmed: "Forklift operators, drivers, loaders",
    possibleConsequence: "Falls, crushing injury, vehicle impact, fatality",
    existingMeasures:
      "Drivers instructed to wait in safe area; loading areas designated; forklift operators trained",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Chock wheels or use vehicle restraint; confirm trailer floor condition; control dock edges; agree loading sequence; prevent vehicle departure until loading is complete",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Forklift battery charging or refueling",
    hazardDescription:
      "Fire, explosion, acid exposure, or fuel spill during battery charging or refueling",
    whoMayBeHarmed: "Forklift operators, maintenance workers, nearby workers",
    possibleConsequence: "Burns, chemical injury, fire, explosion",
    existingMeasures:
      "Charging or refueling area identified; basic spill kit available; operators trained",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Provide ventilation in charging areas; prohibit ignition sources; wear chemical PPE for battery work; inspect chargers and hoses; keep emergency eyewash and spill response available",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Forklift travel on uneven or temporary construction routes",
    hazardDescription:
      "Loss of stability or load control due to potholes, debris, ramps, temporary surfaces, or poor housekeeping",
    whoMayBeHarmed: "Forklift operator, pedestrians, nearby workers",
    possibleConsequence: "Overturning, falling load, collision, injury",
    existingMeasures:
      "Routes visually checked; operators report unsafe surfaces; housekeeping completed periodically",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Inspect and maintain forklift routes; repair potholes and remove debris; restrict forklift use on unsuitable gradients; use alternative equipment for rough terrain",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
];

const createDemolitionHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Structural demolition and dismantling",
    hazardDescription:
      "Uncontrolled structural collapse due to unknown structural condition, incorrect sequence, or removal of load-bearing elements",
    whoMayBeHarmed: "Demolition workers, plant operators, nearby trades, public",
    possibleConsequence: "Crushing, entrapment, multiple fatalities",
    existingMeasures:
      "Demolition sequence planned; access restricted; experienced supervisors assigned",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Complete structural survey and engineered demolition plan; verify temporary support needs; follow approved sequence; stop work if unexpected movement or cracking is observed",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Demolition work below or beside elevated materials",
    hazardDescription:
      "Falling debris, tools, or materials from demolition areas",
    whoMayBeHarmed: "Demolition workers, adjacent trades, visitors, public",
    possibleConsequence: "Head injury, fractures, lacerations, fatality",
    existingMeasures:
      "Hard hats required; work zone identified; debris removed periodically",
    initialProbability: 4,
    initialSeverity: 4,
    additionalMeasures:
      "Install exclusion zones and debris netting where required; use controlled drop zones; remove loose materials progressively; prevent access below active demolition work",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Cutting, breaking, and removal of masonry or concrete",
    hazardDescription:
      "Exposure to dust including respirable crystalline silica during demolition and breaking works",
    whoMayBeHarmed: "Demolition workers, nearby workers, cleaners",
    possibleConsequence:
      "Respiratory irritation, silicosis risk, chronic lung disease",
    existingMeasures:
      "Dust masks available; workers instructed to avoid visible dust clouds; some wetting down used",
    initialProbability: 4,
    initialSeverity: 4,
    additionalMeasures:
      "Use water suppression or on-tool extraction; select lower-dust methods; establish exclusion zones; wear suitable respiratory protection based on exposure assessment",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Use of breakers, saws, and demolition plant",
    hazardDescription:
      "Noise and vibration exposure from demolition equipment and powered tools",
    whoMayBeHarmed: "Operators, nearby workers, supervisors",
    possibleConsequence:
      "Hearing damage, hand-arm vibration injury, fatigue, reduced communication",
    existingMeasures:
      "Hearing protection available; equipment maintained; workers rotate tasks informally",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Use lower-noise and lower-vibration equipment where practical; set exposure limits and task rotation; maintain tools; enforce hearing protection zones",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Demolition near hidden or live services",
    hazardDescription:
      "Contact with hidden electrical, gas, water, or mechanical services during demolition",
    whoMayBeHarmed: "Demolition workers, plant operators, nearby trades",
    possibleConsequence: "Electric shock, explosion, flooding, burns, fatality",
    existingMeasures:
      "Available drawings reviewed; visual checks made; supervisors coordinate with client or facility team",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Survey, isolate, and clearly mark all services before demolition; use permit controls; hand expose uncertain services; verify isolation before cutting or breaking",
    controlHierarchy: [
      "Elimination",
      "Engineering Controls",
      "Administrative Controls",
      "PPE",
    ],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Demolition of older or unknown materials",
    hazardDescription:
      "Exposure to asbestos, lead paint, contaminated dust, or unidentified hazardous materials",
    whoMayBeHarmed: "Demolition workers, cleaners, other trades, public",
    possibleConsequence:
      "Occupational illness, respiratory disease, contamination, regulatory breach",
    existingMeasures:
      "Workers told to stop if suspect materials are found; waste areas designated",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Complete hazardous materials survey before demolition; isolate and label suspect materials; use licensed removal where required; control waste handling and decontamination",
    controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Demolition plant and pedestrian interface",
    hazardDescription:
      "Collision or struck-by incident involving excavators, loaders, dumpers, or workers on foot",
    whoMayBeHarmed: "Ground workers, plant operators, signalers, visitors",
    possibleConsequence: "Crushing injury, fractures, fatality",
    existingMeasures:
      "Plant operators trained; banksmen used for some movements; reversing alarms fitted",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Create plant exclusion zones; use traffic management plan; appoint dedicated banksmen; separate pedestrian routes; maintain visibility aids and communication",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
];

const createManualHandlingHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Manual lifting and carrying of construction materials",
    hazardDescription:
      "Back injury from lifting heavy bags, blocks, equipment, or materials without suitable aids",
    whoMayBeHarmed: "Workers, laborers, installers, delivery personnel",
    possibleConsequence: "Back strain, disc injury, lost time injury",
    existingMeasures:
      "Workers briefed on safe lifting; team lifting used for some heavy items; gloves available",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Use mechanical aids, trolleys, hoists, or pallet trucks; reduce load weight where possible; plan deliveries close to point of use; avoid unnecessary manual carrying",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Repeated lifting, pushing, pulling, or carrying",
    hazardDescription:
      "Strains and sprains from repetitive manual handling or sustained physical effort",
    whoMayBeHarmed: "Workers, warehouse staff, installers",
    possibleConsequence: "Shoulder injury, sprains, muscle strain, fatigue",
    existingMeasures:
      "Workers take informal breaks; supervisors assign additional help for larger moves",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Rotate tasks; set maximum manual handling limits; schedule rest breaks; use handling aids; review work sequence to reduce repeated movement",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Handling materials in confined or awkward positions",
    hazardDescription:
      "Awkward posture, twisting, reaching, or lifting from floor level causing musculoskeletal injury",
    whoMayBeHarmed: "Installers, fitters, laborers, maintenance personnel",
    possibleConsequence: "Back injury, neck strain, shoulder injury",
    existingMeasures:
      "Work areas reviewed by supervisor; workers instructed to ask for assistance with difficult lifts",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Raise materials to waist height where practical; redesign storage layout; use adjustable stands or lifting aids; break tasks into smaller controlled movements",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Manual movement of heavy, long, or unstable loads",
    hazardDescription:
      "Loss of control of heavy or unstable materials such as boards, pipes, glass, doors, or rebar",
    whoMayBeHarmed: "Workers carrying load, nearby workers, visitors",
    possibleConsequence: "Crushing injury, cuts, struck-by injury, fractures",
    existingMeasures:
      "Team lifting used when obvious; materials checked before movement; gloves and safety footwear available",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Use lifting frames, trolleys, stillages, or cranes where practical; secure unstable loads before movement; clear route before lift; assign one person to coordinate team lifts",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Carrying materials through active work areas",
    hazardDescription:
      "Slips, trips, or falls while carrying materials due to uneven ground, debris, stairs, or poor visibility",
    whoMayBeHarmed: "Workers carrying materials, nearby workers",
    possibleConsequence: "Sprains, fractures, dropped load injuries",
    existingMeasures:
      "Housekeeping checks completed; workers instructed to keep routes clear; safety footwear required",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Clear and inspect carrying routes before movement; improve lighting; avoid carrying loads on stairs where aids are available; use spotter for bulky loads",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Team lifting and coordinated handling",
    hazardDescription:
      "Poor communication or mismatched lifting technique during team lifts causing sudden load shift",
    whoMayBeHarmed: "Workers involved in team lift, nearby workers",
    possibleConsequence: "Crush injury, strains, dropped load, hand injury",
    existingMeasures:
      "Team lifting used for larger items; workers communicate verbally during movement",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Nominate lift leader; agree commands and route before lifting; match team size to load; stop lift if grip, balance, or route becomes unsafe",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
];

const createSiteMobilizationAndDemobilizationHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Site mobilization and demobilization planning",
    hazardDescription:
      "Uncontrolled movement of vehicles, equipment, and workers during setup or removal of site facilities",
    whoMayBeHarmed: "Workers, contractors, drivers, visitors, public",
    possibleConsequence: "Collision, crushing injury, struck-by injury, fatality",
    existingMeasures:
      "Mobilization schedule prepared; supervisors coordinate deliveries; site access points identified",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Prepare mobilization traffic plan; sequence deliveries to avoid congestion; assign banksmen for vehicle movements; separate pedestrians from setup zones; brief all contractors before arrival",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Delivery and unloading of temporary site facilities",
    hazardDescription:
      "Dropped or unstable cabins, containers, barriers, or equipment during lifting and unloading",
    whoMayBeHarmed: "Delivery drivers, riggers, site workers, installers",
    possibleConsequence: "Crushing injury, fractures, fatality, property damage",
    existingMeasures:
      "Delivery area designated; lifting equipment inspected; trained operators used",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use approved lift plans for cabins or containers; verify ground bearing capacity; keep non-essential workers outside unloading zone; inspect lifting points before lifting",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Establishing site welfare, offices, and storage areas",
    hazardDescription:
      "Trips, slips, poor access, or unstable temporary layouts during early site setup",
    whoMayBeHarmed: "Workers, subcontractors, visitors",
    possibleConsequence: "Sprains, falls, minor injuries, lost time injury",
    existingMeasures:
      "Temporary walkways identified; housekeeping completed during setup; lighting available where installed",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Install stable access routes early; provide temporary lighting; keep setup materials organized; inspect welfare and office access before occupation",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Removal of temporary services and site facilities",
    hazardDescription:
      "Unexpected live services, disconnected utilities, or residual energy during demobilization",
    whoMayBeHarmed: "Workers, electricians, maintenance personnel, contractors",
    possibleConsequence: "Electric shock, burns, fire, equipment damage",
    existingMeasures:
      "Supervisors coordinate shutdown; utility connections identified; competent persons assigned",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Verify isolation before removal; use lockout/tagout for temporary power and utilities; label disconnected services; prohibit unauthorized reconnection during demobilization",
    controlHierarchy: ["Elimination", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Final site clearance and reinstatement",
    hazardDescription:
      "Leftover debris, protruding fixings, open excavations, or unsecured materials after demobilization",
    whoMayBeHarmed: "Remaining workers, client personnel, public, cleaners",
    possibleConsequence: "Cuts, trips, falls, puncture wounds, vehicle damage",
    existingMeasures:
      "Final walkdown planned; waste removal arranged; supervisors check work areas",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Complete formal demobilization inspection; remove or cap protrusions; secure remaining hazards; hand over documented residual risks to client or site owner",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
];

const createTemporaryFencingAndAccessControlHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Installation of temporary fencing and hoarding",
    hazardDescription:
      "Fence panels, hoarding, or posts falling due to poor installation, wind loading, or unstable ground",
    whoMayBeHarmed: "Workers, pedestrians, visitors, public",
    possibleConsequence: "Struck-by injury, cuts, fractures, property damage",
    existingMeasures:
      "Temporary fencing materials inspected; installers briefed; obvious public interfaces identified",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Use suitable bases, bracing, and ties; assess wind exposure; inspect after storms or impact; secure sharp edges and protruding ties",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Site access gates and controlled entry points",
    hazardDescription:
      "Unauthorized entry by public, visitors, or uninducted workers into active construction areas",
    whoMayBeHarmed: "Public, visitors, uninducted workers, children",
    possibleConsequence: "Exposure to site hazards, serious injury, fatality",
    existingMeasures:
      "Access gate identified; site signage installed; supervisors monitor visitors",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Lock unattended access points; use visitor sign-in and induction controls; display clear warning signs; assign security or access controller where public interface risk is high",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Pedestrian and vehicle gate interface",
    hazardDescription:
      "Pedestrians struck by vehicles entering or exiting through temporary access gates",
    whoMayBeHarmed: "Workers, delivery drivers, visitors, public pedestrians",
    possibleConsequence: "Crushing injury, fractures, fatality",
    existingMeasures:
      "Gate area marked; drivers instructed to slow down; high-visibility clothing required",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Separate pedestrian and vehicle gates where possible; use banksmen for deliveries; install mirrors or warning lights; keep public footpaths protected from reversing vehicles",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Emergency access through temporary perimeter controls",
    hazardDescription:
      "Blocked or poorly marked emergency access preventing rapid response by rescue, fire, or ambulance services",
    whoMayBeHarmed: "Workers, emergency responders, visitors",
    possibleConsequence: "Delayed rescue, injury escalation, fatality",
    existingMeasures:
      "Emergency contact numbers posted; main access gate known to supervisors",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Keep emergency access routes clear; label emergency gates; brief gate controllers; share access plan with emergency services where required; inspect access daily",
    controlHierarchy: ["Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Maintenance of temporary fencing and access control",
    hazardDescription:
      "Damaged fence panels, missing clips, open gaps, or poor lighting creating insecure perimeter conditions",
    whoMayBeHarmed: "Workers, public, visitors, trespassers",
    possibleConsequence: "Unauthorized access, cuts, trips, struck-by injury",
    existingMeasures:
      "Perimeter checked periodically; damaged panels repaired when reported",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Complete documented perimeter inspections; repair gaps immediately; improve lighting at gates and public interfaces; remove damaged panels from service",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
];

const createTemporaryPowerDistributionHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Temporary power distribution boards and site supplies",
    hazardDescription:
      "Electric shock from incorrectly installed, damaged, wet, or overloaded temporary distribution equipment",
    whoMayBeHarmed: "Electricians, site workers, subcontractors, visitors",
    possibleConsequence: "Electric shock, burns, cardiac arrest, fatality",
    existingMeasures:
      "Temporary boards installed by competent electricians; visual inspections completed; RCD/GFCI protection used where available",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use certified temporary power design; protect boards from weather and impact; inspect and test circuits regularly; keep access restricted to competent persons",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Temporary cables routed through active work areas",
    hazardDescription:
      "Trips, cable damage, or electric shock caused by trailing leads and unprotected temporary cables",
    whoMayBeHarmed: "All site workers, contractors, visitors",
    possibleConsequence: "Falls, sprains, cable failure, electric shock",
    existingMeasures:
      "Cable routes identified; damaged leads removed when reported; housekeeping checks completed",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Route cables overhead where possible; use cable ramps or covers; avoid wet or traffic routes; remove unused leads; include cable checks in daily inspections",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Use of generators and temporary power sources",
    hazardDescription:
      "Fire, carbon monoxide exposure, fuel spill, or electrical fault from temporary generators",
    whoMayBeHarmed: "Workers, maintenance personnel, nearby occupants",
    possibleConsequence: "Poisoning, burns, fire, explosion, fatality",
    existingMeasures:
      "Generators positioned in designated areas; fuel stored separately; operators instructed on basic use",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Locate generators outdoors or in ventilated areas; protect fuel storage; use spill controls; inspect grounding and electrical protection; prohibit exhaust near occupied spaces",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Temporary lighting installation",
    hazardDescription:
      "Poor lighting, glare, damaged fittings, or unstable lighting stands affecting safe access and work quality",
    whoMayBeHarmed: "Workers, drivers, inspectors, visitors",
    possibleConsequence: "Trips, slips, vehicle collision, poor task visibility",
    existingMeasures:
      "Temporary lighting provided in main work areas; damaged fittings reported to supervisors",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Assess lighting levels for access routes and tasks; secure lighting stands; protect cables; provide emergency or backup lighting for critical routes",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Isolation and modification of temporary power",
    hazardDescription:
      "Unauthorized changes, incorrect isolation, or unexpected energization during temporary power modifications",
    whoMayBeHarmed: "Electricians, workers using equipment, supervisors",
    possibleConsequence: "Electric shock, burns, equipment damage, fire",
    existingMeasures:
      "Electrical changes assigned to competent persons; supervisors coordinate planned changes",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Apply lockout/tagout before modifications; update temporary power drawings; label circuits clearly; prohibit unauthorized connections and adapters",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createSiteTrafficRouteSetupHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Design and setup of site vehicle routes",
    hazardDescription:
      "Collision between vehicles, plant, and pedestrians due to unclear traffic routes or mixed movement areas",
    whoMayBeHarmed: "Workers, plant operators, delivery drivers, visitors",
    possibleConsequence: "Crushing injury, struck-by injury, fatality",
    existingMeasures:
      "Main access route identified; operators trained; high-visibility clothing required",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Prepare traffic management plan; separate pedestrian and vehicle routes; mark one-way routes where possible; install barriers, signs, speed limits, and crossing points",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Reversing and maneuvering areas",
    hazardDescription:
      "Vehicles reversing into workers, structures, other vehicles, or public interfaces",
    whoMayBeHarmed: "Ground workers, banksmen, drivers, pedestrians",
    possibleConsequence: "Crushing injury, collision, serious injury, fatality",
    existingMeasures:
      "Reversing alarms used; banksmen available for some deliveries; drivers instructed to report to site office",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Design routes to minimize reversing; use dedicated turning areas; appoint trained banksmen; keep reversing zones clear; install mirrors or cameras where visibility is restricted",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Temporary traffic route surfaces",
    hazardDescription:
      "Uneven, muddy, soft, or poorly maintained routes causing loss of vehicle control or plant instability",
    whoMayBeHarmed: "Drivers, plant operators, pedestrians nearby",
    possibleConsequence: "Overturning, collision, slips, stuck vehicles",
    existingMeasures:
      "Routes visually checked; obvious defects repaired when reported; weather monitored",
    initialProbability: 4,
    initialSeverity: 4,
    additionalMeasures:
      "Install suitable temporary road surface; maintain drainage; repair potholes; restrict heavy vehicles from unsuitable areas; inspect after rain or heavy traffic",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Traffic signs, barriers, and route communication",
    hazardDescription:
      "Drivers following wrong routes due to missing signs, poor lighting, or unclear instructions",
    whoMayBeHarmed: "Drivers, pedestrians, workers in restricted zones",
    possibleConsequence: "Vehicle collision, struck-by injury, property damage",
    existingMeasures:
      "Basic site signs installed; delivery instructions issued by supervisors",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Install clear directional signs and speed limits; brief drivers at gate; update route information when site layout changes; provide lighting for night or early work",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Interface between site traffic and public roads",
    hazardDescription:
      "Vehicles entering or leaving site causing collision with public traffic or pedestrians",
    whoMayBeHarmed: "Drivers, public pedestrians, cyclists, workers",
    possibleConsequence: "Road traffic collision, serious injury, fatality",
    existingMeasures:
      "Site entrance identified; drivers instructed to reduce speed; gate area monitored",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use traffic marshals for busy periods; maintain sight lines; clean mud from public roads; install warning signs; coordinate abnormal deliveries outside peak traffic where practical",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createPedestrianWalkwaySetupHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Temporary pedestrian walkway installation",
    hazardDescription:
      "Pedestrians exposed to vehicles, plant, or work fronts due to incomplete walkway segregation",
    whoMayBeHarmed: "Workers, visitors, inspectors, public pedestrians",
    possibleConsequence: "Struck-by injury, crushing injury, fatality",
    existingMeasures:
      "Pedestrian routes identified; high-visibility clothing required; basic signs installed",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Install continuous physical barriers between walkways and vehicle routes; mark controlled crossings; brief workers and visitors on approved routes; review routes as work fronts change",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Walkway surface and access condition",
    hazardDescription:
      "Slips, trips, or falls caused by uneven surfaces, mud, debris, slopes, or temporary ramps",
    whoMayBeHarmed: "Workers, visitors, delivery personnel",
    possibleConsequence: "Sprains, fractures, falls, lost time injury",
    existingMeasures:
      "Housekeeping checks completed; obvious trip hazards removed; safety footwear required",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Provide stable, drained, and level walkway surfaces; use anti-slip ramps; remove mud and debris daily; repair damaged boards or mats immediately",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Walkway lighting and visibility",
    hazardDescription:
      "Poor visibility on temporary walkways causing trips, wrong-route access, or pedestrian conflict with vehicles",
    whoMayBeHarmed: "Workers, visitors, security personnel",
    possibleConsequence: "Trips, falls, vehicle collision, injury",
    existingMeasures:
      "Temporary lighting used in key areas; reflective clothing required",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Install lighting along all primary walkways and crossings; use reflective barriers and signs; inspect lighting before night or early shift work",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Pedestrian route changes during construction phases",
    hazardDescription:
      "Workers or visitors using outdated routes after layout changes, exposing them to active work areas",
    whoMayBeHarmed: "Workers, visitors, inspectors, subcontractors",
    possibleConsequence: "Falls, struck-by injury, unauthorized exposure to hazards",
    existingMeasures:
      "Supervisors communicate major route changes; old routes closed when identified",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Update walkway signs immediately after changes; block old routes physically; include route changes in daily briefings; update induction maps and visitor instructions",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Emergency egress from temporary walkways",
    hazardDescription:
      "Walkways blocked by materials, waste, plant, or locked gates during emergency evacuation",
    whoMayBeHarmed: "Workers, visitors, emergency responders",
    possibleConsequence: "Delayed evacuation, injury escalation, fatality",
    existingMeasures:
      "Emergency routes identified; supervisors check main access routes",
    initialProbability: 2,
    initialSeverity: 5,
    additionalMeasures:
      "Keep emergency egress routes clear at all times; label escape routes; include walkways in emergency drills; inspect access at start and end of each shift",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createMaterialLaydownAreaSetupHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Selection and preparation of material laydown areas",
    hazardDescription:
      "Materials stored on unstable, sloped, overloaded, or poorly drained ground causing collapse or movement",
    whoMayBeHarmed: "Workers, plant operators, delivery drivers",
    possibleConsequence: "Crushing injury, struck-by injury, property damage",
    existingMeasures:
      "Laydown area identified; deliveries coordinated by supervisors; storage locations reviewed visually",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Assess ground bearing capacity and drainage; level and compact laydown surface; define maximum stacking heights; segregate incompatible or unstable materials",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Stacking and storage of construction materials",
    hazardDescription:
      "Stored materials falling, rolling, or sliding due to poor stacking, missing chocks, or damaged pallets",
    whoMayBeHarmed: "Workers, forklift operators, pedestrians, visitors",
    possibleConsequence: "Crushing injury, fractures, cuts, fatality",
    existingMeasures:
      "Materials stacked in designated zones; damaged pallets removed when identified; safety footwear required",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use racks, stillages, chocks, or banding; keep heavy items low; inspect stacks after deliveries and weather; prohibit climbing on stored materials",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Vehicle and forklift access to laydown areas",
    hazardDescription:
      "Collision between mobile plant, delivery vehicles, and workers during material loading or collection",
    whoMayBeHarmed: "Forklift operators, delivery drivers, riggers, pedestrians",
    possibleConsequence: "Struck-by injury, crushing injury, fatality",
    existingMeasures:
      "Operators trained; loading areas marked; high-visibility clothing required",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Design one-way access where practical; separate pedestrian routes; assign banksman for busy deliveries; control loading zones with barriers or exclusion markings",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Manual retrieval of materials from laydown areas",
    hazardDescription:
      "Manual handling injuries from lifting heavy, awkward, or poorly positioned materials",
    whoMayBeHarmed: "Workers, installers, laborers",
    possibleConsequence: "Back injury, strains, sprains, hand injury",
    existingMeasures:
      "Workers instructed to ask for help with heavy loads; gloves available; materials grouped by type",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Store frequently used items between knee and shoulder height; use trolleys, forklifts, or hoists; split heavy loads; plan pickup points close to work fronts",
    controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Housekeeping and access within laydown areas",
    hazardDescription:
      "Trips, slips, cuts, or blocked access caused by loose packaging, banding, protruding materials, or waste",
    whoMayBeHarmed: "Workers, delivery drivers, visitors",
    possibleConsequence: "Cuts, puncture wounds, trips, falls",
    existingMeasures:
      "Waste bins provided; supervisors complete periodic housekeeping checks",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Remove packaging and banding immediately; keep access aisles marked and clear; cap protruding rebar or sharp materials; inspect laydown housekeeping daily",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
];

const createHousekeepingAndWasteSegregationHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "General site housekeeping",
    hazardDescription:
      "Slips, trips, and falls caused by debris, offcuts, cables, packaging, or poor material storage",
    whoMayBeHarmed: "All site workers, contractors, visitors",
    possibleConsequence: "Sprains, fractures, cuts, lost time injury",
    existingMeasures:
      "Waste bins available; housekeeping expectations communicated during toolbox talks; supervisors monitor work areas",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Set clean-as-you-go requirements; assign housekeeping responsibilities by work area; inspect routes daily; remove trip hazards before end of shift",
    controlHierarchy: ["Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Waste segregation and disposal",
    hazardDescription:
      "Incorrect segregation of general, recyclable, sharp, hazardous, or contaminated waste",
    whoMayBeHarmed: "Workers, cleaners, waste handlers, environment",
    possibleConsequence: "Cuts, chemical exposure, fire, environmental contamination",
    existingMeasures:
      "Waste containers provided; workers instructed to separate obvious waste streams",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Label waste skips clearly; provide dedicated containers for hazardous and sharp waste; brief workers on waste rules; inspect waste areas for cross-contamination",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Handling sharp waste and offcuts",
    hazardDescription:
      "Cuts and puncture injuries from nails, sharp metal, broken glass, rebar offcuts, or splinters",
    whoMayBeHarmed: "Workers, cleaners, waste handlers",
    possibleConsequence: "Cuts, puncture wounds, infection, hand injury",
    existingMeasures:
      "Gloves required; sharp waste collected in designated areas when identified",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Use puncture-resistant containers for sharp waste; remove nails or bend them over; cap protruding sharp items; require suitable cut-resistant gloves for handling",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 2,
  }),
  createLibraryHazard({
    workplaceActivity: "Combustible waste accumulation",
    hazardDescription:
      "Fire load increased by cardboard, timber, packaging, rags, or waste stored near ignition sources",
    whoMayBeHarmed: "Workers, visitors, emergency responders",
    possibleConsequence: "Fire, smoke inhalation, burns, property damage",
    existingMeasures:
      "Waste removed periodically; fire extinguishers available; hot work permits used where required",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Remove combustible waste daily; keep waste away from hot work and electrical equipment; use covered skips where needed; include waste areas in fire inspections",
    controlHierarchy: ["Elimination", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Waste collection and skip exchange",
    hazardDescription:
      "Vehicle collision, dropped waste containers, or worker exposure during skip movement and waste collection",
    whoMayBeHarmed: "Waste contractors, site workers, pedestrians, drivers",
    possibleConsequence: "Crushing injury, struck-by injury, cuts, fatality",
    existingMeasures:
      "Waste collection arranged with supervisor; collection area identified; drivers report to site office",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Create exclusion zone during skip exchange; use banksman for reversing; keep pedestrians away; verify skip condition and lifting points before movement",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
];

const createShoringAndTrenchSupportHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Installation of shoring, trench boxes, or trench support",
    hazardDescription:
      "Trench collapse during installation before support system is fully in place",
    whoMayBeHarmed: "Ground workers, installers, supervisors",
    possibleConsequence: "Burial, crushing injury, asphyxiation, fatality",
    existingMeasures:
      "Excavation inspected; trained workers assigned; shoring equipment available",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use engineered support method; install support from safe position where possible; keep workers out of unsupported excavations; competent person to inspect before entry",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Selection of trench support system",
    hazardDescription:
      "Incorrect shoring type, insufficient capacity, or poor fit for soil and excavation depth",
    whoMayBeHarmed: "Workers in excavation, plant operators, nearby workers",
    possibleConsequence: "Support failure, collapse, serious injury, fatality",
    existingMeasures:
      "Shoring selected based on experience; excavation depth reviewed by supervisor",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Confirm soil conditions and design requirements; follow manufacturer limits; obtain engineering input for deep or complex excavations; verify support dimensions before use",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Lifting and positioning trench boxes or support components",
    hazardDescription:
      "Dropped shoring component, pinch points, or workers struck during lifting and positioning",
    whoMayBeHarmed: "Riggers, ground workers, excavator operators",
    possibleConsequence: "Crushing injury, hand injury, fractures, fatality",
    existingMeasures:
      "Lifting equipment inspected; operators trained; workers instructed to stand clear",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use approved lifting points and rated accessories; keep hands clear of pinch points; establish exclusion zone; use tag lines where safe and effective",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Inspection and maintenance of shoring systems",
    hazardDescription:
      "Damaged, displaced, or poorly maintained trench support reducing excavation stability",
    whoMayBeHarmed: "Workers inside trench, supervisors, inspectors",
    possibleConsequence: "Collapse, entrapment, crushing injury, fatality",
    existingMeasures:
      "Visual checks completed; obvious damage reported; support inspected after installation",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Inspect support daily and after weather, impact, or ground movement; remove damaged components from service; record inspections; stop work if support shifts",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Removal of shoring or trench support",
    hazardDescription:
      "Collapse or worker entrapment during premature or incorrect removal of trench support",
    whoMayBeHarmed: "Ground workers, excavator operators, supervisors",
    possibleConsequence: "Burial, crushing injury, fatality",
    existingMeasures:
      "Removal supervised; workers briefed on sequence; plant available to assist removal",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Remove support in controlled sequence with backfilling where required; keep workers out of unsupported zones; maintain exclusion areas during extraction",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
];

const createDewateringWorksHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Installation and operation of dewatering pumps",
    hazardDescription:
      "Electric shock or equipment failure from pumps, cables, or generators used in wet excavation areas",
    whoMayBeHarmed: "Ground workers, electricians, pump operators",
    possibleConsequence: "Electric shock, burns, drowning, fatality",
    existingMeasures:
      "Pumps installed by competent workers; cables visually checked; equipment positioned away from water where possible",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use suitable electrical protection and waterproof connections; keep generators and panels clear of water; inspect pump cables daily; isolate equipment before maintenance",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 5,
  }),
  createLibraryHazard({
    workplaceActivity: "Water accumulation in excavations or low areas",
    hazardDescription:
      "Slips, falls, drowning, or excavation instability due to uncontrolled water ingress",
    whoMayBeHarmed: "Ground workers, plant operators, inspectors",
    possibleConsequence: "Falls, drowning, collapse injury, equipment damage",
    existingMeasures:
      "Water levels monitored visually; pumps available; work stopped during obvious unsafe water conditions",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Define maximum water levels for safe work; provide safe access; inspect excavation stability after dewatering; prohibit entry where water affects ground support",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Discharge of pumped water",
    hazardDescription:
      "Environmental contamination, flooding, erosion, or uncontrolled discharge to drains or adjacent property",
    whoMayBeHarmed: "Workers, public, environment, client operations",
    possibleConsequence: "Pollution, slips, property damage, regulatory breach",
    existingMeasures:
      "Discharge route identified; visible sediment checked; hoses directed away from work areas",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Use settlement tanks, filters, or silt controls; obtain discharge approvals where required; monitor water quality; secure hoses to prevent uncontrolled movement",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Temporary hoses, pipes, and drainage lines",
    hazardDescription:
      "Trips, hose bursts, whipping, or leaks from temporary dewatering hoses across work areas",
    whoMayBeHarmed: "Workers, plant operators, visitors",
    possibleConsequence: "Falls, impact injury, flooding, slips",
    existingMeasures:
      "Hoses routed away from main access where possible; leaks repaired when reported",
    initialProbability: 4,
    initialSeverity: 3,
    additionalMeasures:
      "Route hoses through protected corridors; use hose ramps or covers; secure couplings; inspect hose condition and pressure during operation",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Manual handling and maintenance of pumps",
    hazardDescription:
      "Injury while lifting pumps, clearing blockages, or maintaining equipment in wet and muddy conditions",
    whoMayBeHarmed: "Pump operators, ground workers, maintenance personnel",
    possibleConsequence: "Back injury, strains, cuts, slips, hand injury",
    existingMeasures:
      "Workers use gloves and safety footwear; pumps handled by trained workers; maintenance performed when faults occur",
    initialProbability: 3,
    initialSeverity: 3,
    additionalMeasures:
      "Use mechanical assistance for heavy pumps; isolate energy before clearing blockages; provide stable working platform; clean mud from access points",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 2,
  }),
];

const createBackfillingAndCompactionHazards = (): HazardRow[] => [
  createLibraryHazard({
    workplaceActivity: "Backfilling excavations and trenches",
    hazardDescription:
      "Workers struck or buried by moving fill material, unstable trench edges, or plant operating near excavation",
    whoMayBeHarmed: "Ground workers, plant operators, supervisors",
    possibleConsequence: "Crushing injury, burial, fractures, fatality",
    existingMeasures:
      "Backfilling supervised; workers briefed to stay clear of plant; excavation inspected before work",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Keep workers out of active backfill drop zones; use banksman for plant movements; maintain edge protection or exclusion zones; sequence backfill to preserve support stability",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Use of compactors, rollers, and vibrating plates",
    hazardDescription:
      "Contact with moving compaction equipment, vibration exposure, or loss of control on uneven ground",
    whoMayBeHarmed: "Operators, ground workers nearby, supervisors",
    possibleConsequence: "Crush injury, hand-arm vibration injury, sprains",
    existingMeasures:
      "Operators trained; equipment inspected before use; hearing and hand protection available",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Maintain exclusion zone around compactors; monitor vibration exposure; use suitable equipment for ground conditions; stop work on unsafe slopes or unstable surfaces",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Plant movement during backfilling",
    hazardDescription:
      "Collision between reversing plant, dumpers, trucks, and workers during delivery and placement of fill",
    whoMayBeHarmed: "Ground workers, plant operators, delivery drivers",
    possibleConsequence: "Crushing injury, struck-by injury, fatality",
    existingMeasures:
      "Reversing alarms fitted; operators trained; high-visibility clothing required",
    initialProbability: 3,
    initialSeverity: 5,
    additionalMeasures:
      "Use traffic management plan and banksmen; separate pedestrians from plant; designate tipping areas; avoid reversing where route design allows forward movement",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 2,
    residualSeverity: 4,
  }),
  createLibraryHazard({
    workplaceActivity: "Dust generation from dry fill or compacted materials",
    hazardDescription:
      "Airborne dust exposure during tipping, spreading, or compaction of dry material",
    whoMayBeHarmed: "Operators, ground workers, nearby trades, public",
    possibleConsequence: "Respiratory irritation, reduced visibility, nuisance dust",
    existingMeasures:
      "Water available on site; dust masks available; work stopped if visibility becomes poor",
    initialProbability: 3,
    initialSeverity: 3,
    additionalMeasures:
      "Dampen dry material before placement; use dust suppression during tipping; position workers upwind where possible; wear respiratory protection where exposure remains",
    controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
  createLibraryHazard({
    workplaceActivity: "Quality checks and work around partially backfilled trenches",
    hazardDescription:
      "Trips, falls, or ground settlement around uneven backfilled areas, open edges, or uncompacted material",
    whoMayBeHarmed: "Inspectors, ground workers, surveyors, visitors",
    possibleConsequence: "Falls, sprains, fractures, vehicle instability",
    existingMeasures:
      "Work area inspected; barriers used around open trenches; supervisors monitor surface condition",
    initialProbability: 3,
    initialSeverity: 4,
    additionalMeasures:
      "Maintain barriers until backfill is complete and stable; mark soft spots; compact in specified layers; restrict vehicle access until compaction quality is confirmed",
    controlHierarchy: ["Engineering Controls", "Administrative Controls"],
    residualProbability: 1,
    residualSeverity: 3,
  }),
];

const createGroundLevelingAndGradingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Ground leveling and grading with earthmoving plant",
      hazardDescription:
        "Collision between graders, excavators, rollers, dumpers, and workers on foot during shaping and leveling works",
      whoMayBeHarmed: "Ground workers, plant operators, surveyors, visitors",
      possibleConsequence: "Crushing injury, struck-by injury, fatality",
      existingMeasures:
        "Plant operators trained; high-visibility clothing required; supervisors coordinate grading zones",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Establish plant exclusion zones; use trained banksmen for close work; separate pedestrian routes; brief workers on grading sequence and no-go areas",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Grading of uneven or sloped ground",
      hazardDescription:
        "Plant instability, rollover, or loss of control on soft ground, slopes, voids, or poorly compacted surfaces",
      whoMayBeHarmed: "Plant operators, ground workers nearby",
      possibleConsequence: "Rollover, crushing injury, serious injury, fatality",
      existingMeasures:
        "Ground condition visually checked; operators instructed to avoid unsafe slopes; machinery inspected before use",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Assess ground bearing and slope limits before work; mark soft spots and voids; use suitable plant for terrain; stop work after heavy rain until reassessed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Leveling dry soil, aggregate, or dusty surfaces",
      hazardDescription:
        "Dust generation reducing visibility and exposing workers to respirable particulates",
      whoMayBeHarmed: "Plant operators, ground workers, nearby trades, public",
      possibleConsequence: "Respiratory irritation, reduced visibility, traffic collision",
      existingMeasures:
        "Water available on site; dust masks available; supervisors monitor visible dust",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use water suppression during grading; reduce vehicle speeds; schedule dusty works away from sensitive boundaries; provide suitable respiratory protection when needed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Setting finished levels and survey control",
      hazardDescription:
        "Surveyors or spotters exposed to moving plant while checking levels, pins, pegs, or laser equipment",
      whoMayBeHarmed: "Surveyors, engineers, ground workers",
      possibleConsequence: "Struck-by injury, trips, falls, serious injury",
      existingMeasures:
        "Survey work coordinated with supervisor; high-visibility clothing worn; workers communicate with operators",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Stop plant movement during close survey checks; create temporary survey exclusion zones; use radios or agreed hand signals; keep survey equipment out of traffic routes",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Grading near drainage lines, pits, or existing services",
      hazardDescription:
        "Damage to shallow buried services, drainage structures, or temporary utilities during ground trimming",
      whoMayBeHarmed: "Plant operators, ground workers, service users",
      possibleConsequence: "Electric shock, flooding, service outage, burns, environmental release",
      existingMeasures:
        "Known services reviewed; service markers used where available; supervisors brief operators",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Confirm service locations before grading; use spotters and reduced-depth passes near known services; hand expose uncertain services; protect covers, pits, and chambers",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
  ]);

const createPileDrivingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Pile driving rig setup and operation",
      hazardDescription:
        "Pile driving rig instability or overturn due to poor platform, slope, overload, or incorrect setup",
      whoMayBeHarmed: "Rig operators, banksmen, ground workers, nearby trades",
      possibleConsequence: "Crushing injury, multiple serious injuries, fatality",
      existingMeasures:
        "Rig operated by competent personnel; working platform visually checked; exclusion area identified",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Verify working platform certificate or ground assessment; maintain rig within operating limits; inspect platform daily; stop work if settlement or instability is observed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Lifting and pitching piles",
      hazardDescription:
        "Dropped, swinging, or uncontrolled pile during lifting, pitching, or alignment",
      whoMayBeHarmed: "Riggers, banksmen, rig operators, workers nearby",
      possibleConsequence: "Crushing injury, struck-by injury, fatality",
      existingMeasures:
        "Lifting accessories inspected; trained slingers used; workers instructed to stand clear",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use approved lifting points and lift plan; establish exclusion zone; use tag lines only where safe; conduct test lift and confirm communication before pitching",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Impact or vibratory pile driving",
      hazardDescription:
        "High noise and vibration exposure affecting workers and nearby structures or services",
      whoMayBeHarmed: "Rig crew, nearby workers, occupants, adjacent property",
      possibleConsequence: "Hearing damage, hand-arm vibration effects, structural damage complaints",
      existingMeasures:
        "Hearing protection available; work hours coordinated; equipment maintained",
      initialProbability: 4,
      initialSeverity: 4,
      additionalMeasures:
        "Establish hearing protection zones; monitor vibration where sensitive structures or services exist; select lower-vibration method where practical; communicate noisy works schedule",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Pile head trimming and driving area housekeeping",
      hazardDescription:
        "Flying debris, sharp pile edges, or trip hazards around pile heads and driving equipment",
      whoMayBeHarmed: "Pile crew, ground workers, inspectors",
      possibleConsequence: "Eye injury, cuts, trips, fractures",
      existingMeasures:
        "Eye protection required; pile locations marked; work area cleaned periodically",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use screens or exclusion zones during trimming; cap or mark exposed pile heads; remove offcuts and debris; enforce eye and hand protection",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Pile driving near overhead or underground services",
      hazardDescription:
        "Contact with overhead lines or damage to buried utilities from piling activities and rig movement",
      whoMayBeHarmed: "Rig crew, utility users, nearby workers",
      possibleConsequence: "Electric shock, explosion, service outage, fatality",
      existingMeasures:
        "Service drawings reviewed; overhead lines visually checked; supervisors brief crew",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Survey and mark services; maintain exclusion distances from overhead lines; isolate services where possible; include service constraints in piling platform and lift plan",
      controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createBoredPilingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Bored piling rig operation",
      hazardDescription:
        "Entanglement, crushing, or contact with rotating auger, kelly bar, or piling rig components",
      whoMayBeHarmed: "Rig crew, banksmen, ground workers, inspectors",
      possibleConsequence: "Crushing injury, amputation, fatality",
      existingMeasures:
        "Rig operated by competent crew; exclusion zone established; workers briefed on rotating equipment",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Maintain physical exclusion zone around rotating equipment; prohibit manual clearing while rotating; use emergency stops; keep non-essential workers away from rig operating radius",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Open boreholes and pile excavations",
      hazardDescription:
        "Falls into open boreholes or collapse of unprotected pile openings",
      whoMayBeHarmed: "Ground workers, inspectors, visitors, rig crew",
      possibleConsequence: "Fall injury, entrapment, drowning, fatality",
      existingMeasures:
        "Borehole locations identified; crew supervises open holes; covers available where used",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Cover or barrier open boreholes immediately; maintain exclusion zones; illuminate pile locations; inspect covers for strength and security",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Handling drilling spoil, slurry, or bentonite",
      hazardDescription:
        "Slips, ground contamination, or skin and eye contact from wet spoil, slurry, or drilling fluids",
      whoMayBeHarmed: "Pile crew, plant operators, waste handlers, environment",
      possibleConsequence: "Slips, dermatitis, eye irritation, environmental contamination",
      existingMeasures:
        "Spoil area designated; gloves and eye protection available; waste disposal arranged",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Contain slurry and spoil; maintain clean access routes; use bunds or drip trays where needed; dispose of drilling fluids through approved route",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Lifting and placing reinforcement cages",
      hazardDescription:
        "Reinforcement cage instability, dropped load, or workers caught between cage and borehole",
      whoMayBeHarmed: "Riggers, crane operator, pile crew, steel fixers",
      possibleConsequence: "Crushing injury, impalement, fractures, fatality",
      existingMeasures:
        "Lifting gear inspected; trained riggers used; cage lifting points reviewed",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use engineered lifting frames or spreader beams where required; keep workers clear of suspended cage; secure cage before release; control tag lines and communication",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Concrete placement into bored piles",
      hazardDescription:
        "Concrete hose movement, splashes, unstable ground, or uncontrolled discharge around borehole",
      whoMayBeHarmed: "Concrete crew, pile crew, pump operator",
      possibleConsequence: "Chemical burns, eye injury, slips, struck-by injury",
      existingMeasures:
        "Concrete crew trained; PPE available; pump operator coordinates discharge",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Secure tremie or hose during pour; maintain stable working platform; wash concrete from skin immediately; keep workers clear of hose whip and open borehole edge",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
  ]);

const createFoundationPreparationHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Foundation excavation trimming and preparation",
      hazardDescription:
        "Falls, slips, or collapse around foundation excavations and stepped levels",
      whoMayBeHarmed: "Ground workers, steel fixers, inspectors, supervisors",
      possibleConsequence: "Falls, fractures, collapse injury, fatality",
      existingMeasures:
        "Excavations inspected; access routes identified; workers briefed on edge hazards",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Install edge protection or exclusion zones; provide safe access ladders or ramps; inspect excavation sides and base before entry; keep spoil away from edges",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Blinding, base preparation, and leveling",
      hazardDescription:
        "Exposure to wet concrete, uneven base surfaces, or manual spreading injuries during blinding works",
      whoMayBeHarmed: "Concrete workers, ground workers, inspectors",
      possibleConsequence: "Chemical burns, slips, strains, eye injury",
      existingMeasures:
        "Concrete PPE available; workers trained in manual handling; wash water available",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use suitable waterproof gloves and boots; provide safe wash-off facilities; use tools to spread concrete; keep access routes clear of wet concrete",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Starter bars, dowels, and exposed reinforcement",
      hazardDescription:
        "Impalement, cuts, or trips from exposed starter bars and projecting reinforcement",
      whoMayBeHarmed: "Steel fixers, concrete crew, inspectors, visitors",
      possibleConsequence: "Puncture wounds, lacerations, impalement, serious injury",
      existingMeasures:
        "Rebar caps used where available; workers wear gloves and safety boots; reinforcement areas identified",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Cap or protect all exposed vertical bars; maintain clear walkways around reinforcement; barricade dense rebar zones; remove unnecessary offcuts promptly",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Foundation preparation near existing services",
      hazardDescription:
        "Damage to buried utilities, drainage, or temporary services during trimming, breaking, or compaction",
      whoMayBeHarmed: "Ground workers, plant operators, service users",
      possibleConsequence: "Electric shock, explosion, flooding, service outage, fatality",
      existingMeasures:
        "Service drawings reviewed; permit controls used where required; supervisors brief workers",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Verify and mark services before final excavation; hand dig around uncertain services; isolate where possible; support exposed services during foundation work",
      controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Compaction and preparation of foundation base",
      hazardDescription:
        "Vibration, noise, struck-by, or loss of control from compactors operating in confined foundation areas",
      whoMayBeHarmed: "Ground workers, compactor operators, nearby trades",
      possibleConsequence: "Crush injury, hearing damage, vibration injury, sprains",
      existingMeasures:
        "Compactors inspected; hearing protection available; workers trained on equipment use",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Keep exclusion distance around compactors; monitor vibration exposure; select smaller equipment for confined areas; provide stable access and ventilation where required",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
  ]);

const createUndergroundUtilityLocatingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Review of utility records and site drawings",
      hazardDescription:
        "Inaccurate, incomplete, or outdated records leading to missed underground services",
      whoMayBeHarmed: "Surveyors, ground workers, excavator operators, public",
      possibleConsequence: "Electric shock, explosion, flooding, service outage, fatality",
      existingMeasures:
        "Available drawings collected; site team briefed on known services; permit-to-dig used",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Cross-check records with client and utility owners; verify on site using detection equipment; treat all unverified areas as containing unknown services",
      controlHierarchy: ["Administrative Controls"],
      residualProbability: 2,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Cable avoidance tool and locator scanning",
      hazardDescription:
        "Incorrect use, poor calibration, or limitations of scanning equipment causing services to be missed",
      whoMayBeHarmed: "Utility locators, ground workers, plant operators",
      possibleConsequence: "Service strike, electric shock, explosion, fatality",
      existingMeasures:
        "Locator available; users trained; batteries and basic function checked",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use competent locator; apply multiple scanning modes; calibrate and function-check equipment; mark confidence level and limitations on site drawings",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Marking and protecting located utilities",
      hazardDescription:
        "Utility markings lost, unclear, or misinterpreted due to traffic, weather, or changing site conditions",
      whoMayBeHarmed: "Excavation crew, plant operators, subcontractors",
      possibleConsequence: "Service strike, burns, flooding, project delay",
      existingMeasures:
        "Detected services marked on ground; supervisors communicate findings to work crew",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use durable color-coded markings and tags; refresh markings after rain or disturbance; transfer utility information to permits and daily briefings",
      controlHierarchy: ["Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Trial holes and hand excavation for verification",
      hazardDescription:
        "Injury during hand digging or exposure of unknown services, sharp objects, contaminated soil, or unstable ground",
      whoMayBeHarmed: "Ground workers, utility locators, supervisors",
      possibleConsequence: "Cuts, strains, electric shock, gas exposure, collapse injury",
      existingMeasures:
        "Hand tools used near suspected services; workers wear gloves and safety footwear",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use insulated tools where electrical services may exist; dig in thin layers; stop work if warning tape, ducts, odor, or unusual material is found; support exposed services",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Utility locating near active roads or plant routes",
      hazardDescription:
        "Locator or survey crew struck by vehicles while scanning, marking, or inspecting service routes",
      whoMayBeHarmed: "Surveyors, utility locators, road users, plant operators",
      possibleConsequence: "Struck-by injury, fractures, fatality",
      existingMeasures:
        "High-visibility clothing worn; spotter used in some traffic areas; work coordinated with supervisor",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Set temporary traffic controls; separate scanning crew from plant routes; use barriers or cones; schedule locating work outside peak vehicle movement periods",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
  ]);

const createWorkNearBuriedServicesHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Excavation or ground works near buried electrical cables",
      hazardDescription:
        "Contact with buried live electrical cable using mechanical plant, hand tools, or stakes",
      whoMayBeHarmed: "Ground workers, plant operators, electricians, nearby workers",
      possibleConsequence: "Electric shock, arc flash burns, fire, fatality",
      existingMeasures:
        "Known cables marked; permit-to-dig used; workers briefed to use caution near services",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Isolate services where possible; hand expose cables before mechanical excavation; use insulated tools; maintain exclusion distances and stop if service location is uncertain",
      controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Work near buried gas or fuel lines",
      hazardDescription:
        "Damage to gas or fuel line causing leak, fire, explosion, or toxic exposure",
      whoMayBeHarmed: "Ground workers, public, emergency responders, nearby occupants",
      possibleConsequence: "Explosion, burns, poisoning, multiple fatalities",
      existingMeasures:
        "Gas service information reviewed; suspected routes marked; emergency contacts available",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Confirm line location with utility owner; prohibit ignition sources; hand dig near service; maintain emergency response plan; evacuate area immediately if gas odor or damage occurs",
      controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Mechanical excavation around known service corridors",
      hazardDescription:
        "Plant bucket or breaker striking multiple services in congested underground corridors",
      whoMayBeHarmed: "Plant operators, banksmen, ground workers, service users",
      possibleConsequence: "Service outage, flooding, electric shock, serious injury",
      existingMeasures:
        "Banksman used; services marked; plant operators briefed on known corridors",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use vacuum excavation or hand digging in congested service zones; define no-mechanical-dig areas; expose and support services before deeper excavation",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Exposed services during construction",
      hazardDescription:
        "Unsupported, unprotected, or poorly identified exposed services damaged by workers, plant, or backfill",
      whoMayBeHarmed: "Workers, utility users, plant operators",
      possibleConsequence: "Electric shock, flooding, service outage, environmental contamination",
      existingMeasures:
        "Exposed services visible to crew; supervisors advise workers to avoid contact",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Support and protect exposed services; label service type and status; install barriers; agree backfill method with service owner where needed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Emergency response to service strike",
      hazardDescription:
        "Delayed or incorrect response after service damage, increasing injury and escalation risk",
      whoMayBeHarmed: "Workers, supervisors, public, emergency responders",
      possibleConsequence: "Explosion, electrocution, flooding, environmental harm, fatality",
      existingMeasures:
        "Emergency contact numbers available; supervisors trained to stop work after incidents",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Brief service strike response procedure; evacuate and isolate area; do not touch damaged cables or pipes; contact utility owner and emergency services immediately",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createRebarCuttingAndBendingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Mechanical rebar cutting and bending",
      hazardDescription:
        "Hands, fingers, clothing, or gloves caught in cutting or bending machine moving parts",
      whoMayBeHarmed: "Steel fixers, machine operators, helpers",
      possibleConsequence: "Crush injury, amputation, lacerations",
      existingMeasures:
        "Operators trained; machine guards fitted; emergency stop available",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Inspect guarding before use; keep hands clear with push tools; prohibit loose clothing; isolate machine before adjustments or clearing jams",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Cutting rebar with saws, grinders, or shears",
      hazardDescription:
        "Flying metal fragments, sparks, sharp edges, or disc failure during cutting",
      whoMayBeHarmed: "Steel fixers, nearby workers, visitors",
      possibleConsequence: "Eye injury, cuts, burns, facial injury",
      existingMeasures:
        "Eye protection required; grinders inspected; cutting area identified",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use face shield and cut-resistant gloves; install spark screens; inspect discs and guards; keep bystanders outside cutting zone",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Manual handling of rebar bundles and cut lengths",
      hazardDescription:
        "Strains, sprains, or struck-by injury from lifting, dragging, or carrying heavy and awkward rebar",
      whoMayBeHarmed: "Steel fixers, laborers, material handlers",
      possibleConsequence: "Back injury, shoulder strain, foot injury, cuts",
      existingMeasures:
        "Team lifting used for longer bars; gloves and safety boots required; rebar stored in bundles",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use mechanical lifting aids for bundles; cut bars near point of use; limit manual carrying distance; coordinate team lifts with one leader",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Storage of cut and bent rebar",
      hazardDescription:
        "Trips, puncture wounds, or material collapse from poorly stacked rebar and offcuts",
      whoMayBeHarmed: "Steel fixers, other trades, inspectors",
      possibleConsequence: "Cuts, puncture wounds, falls, fractures",
      existingMeasures:
        "Rebar stored in designated areas; housekeeping checks completed periodically",
      initialProbability: 3,
      initialSeverity: 3,
      additionalMeasures:
        "Use racks or stillages; separate offcuts from walkways; cap sharp ends where exposure exists; maintain clear access around rebar storage",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Electrical equipment for rebar cutting",
      hazardDescription:
        "Electric shock from damaged leads, wet cutting areas, or poorly maintained electrical tools",
      whoMayBeHarmed: "Steel fixers, electricians, nearby workers",
      possibleConsequence: "Electric shock, burns, fatality",
      existingMeasures:
        "Tools visually inspected; RCD/GFCI protection used where available; damaged tools reported",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Inspect cables and plugs before use; keep connections dry; remove defective equipment from service; use low-voltage or battery tools where practical",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
  ]);

const createRebarFixingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Fixing reinforcement mats, cages, and starter bars",
      hazardDescription:
        "Impalement or puncture injury from exposed vertical bars, sharp tie wire, or rebar ends",
      whoMayBeHarmed: "Steel fixers, concrete workers, inspectors, visitors",
      possibleConsequence: "Puncture wounds, lacerations, impalement, serious injury",
      existingMeasures:
        "Gloves and safety boots worn; some exposed bars capped; reinforcement areas identified",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Cap or cover exposed starter bars; barricade dense reinforcement zones; bend or remove sharp tie wire ends; maintain clear access routes",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Working on or around reinforcement mats",
      hazardDescription:
        "Trips, slips, or falls while walking on uneven reinforcement, mesh, spacers, or chairs",
      whoMayBeHarmed: "Steel fixers, concrete crew, inspectors",
      possibleConsequence: "Sprains, fractures, falls onto rebar, cuts",
      existingMeasures:
        "Workers wear safety footwear; access routes planned; housekeeping maintained",
      initialProbability: 4,
      initialSeverity: 4,
      additionalMeasures:
        "Use temporary walk boards or access platforms; restrict unnecessary walking on rebar; secure loose mesh; keep offcuts and tie wire clear",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Manual tying and fixing of reinforcement",
      hazardDescription:
        "Musculoskeletal strain from prolonged bending, kneeling, twisting, and repetitive tying",
      whoMayBeHarmed: "Steel fixers, helpers",
      possibleConsequence: "Back injury, knee strain, wrist strain, fatigue",
      existingMeasures:
        "Workers take informal breaks; tying tools available; supervisors allocate work areas",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Rotate tasks; use automatic tying tools where practical; provide kneeling pads; plan work height and access to reduce awkward posture",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Lifting prefabricated reinforcement cages or mats",
      hazardDescription:
        "Unstable reinforcement load, dropped cage, or workers caught between load and structure",
      whoMayBeHarmed: "Riggers, steel fixers, crane operator, workers nearby",
      possibleConsequence: "Crushing injury, impalement, fractures, fatality",
      existingMeasures:
        "Lifting accessories inspected; trained riggers used; workers briefed to stand clear",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use engineered lift points or spreader beams; establish exclusion zone; secure cages before release; verify cage rigidity before lifting",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Rebar fixing near edges, openings, or excavations",
      hazardDescription:
        "Fall from edge or into opening while positioning reinforcement or working near foundation edges",
      whoMayBeHarmed: "Steel fixers, inspectors, supervisors",
      possibleConsequence: "Fall injury, fractures, fatality",
      existingMeasures:
        "Openings identified; workers instructed to remain clear of edges; fall protection available where required",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Install edge protection or covers before fixing; provide safe access platforms; use fall restraint where collective protection is not practical; keep materials away from edges",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createFormworkInstallationHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Formwork panel installation and alignment",
      hazardDescription:
        "Formwork panel collapse, instability, or sudden movement during positioning and fixing",
      whoMayBeHarmed: "Carpenters, formwork installers, crane crew, nearby workers",
      possibleConsequence: "Crushing injury, fractures, fatality",
      existingMeasures:
        "Formwork installed by trained crew; panels braced during installation; supervisors monitor work",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Follow engineered formwork design and sequence; install temporary bracing before release; inspect ties and supports; keep workers clear of unsupported panels",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Working at height during formwork installation",
      hazardDescription:
        "Falls from ladders, platforms, decks, or edges while installing formwork components",
      whoMayBeHarmed: "Formwork installers, carpenters, inspectors",
      possibleConsequence: "Serious injury, fractures, fatality",
      existingMeasures:
        "Access equipment available; workers trained; fall protection equipment provided where needed",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use scaffold or MEWP instead of ladders for extended work; install guardrails and covers; maintain fall restraint or arrest systems; inspect access before use",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Manual handling of formwork panels and props",
      hazardDescription:
        "Strains, crush injuries, or hand injuries from lifting and carrying heavy or awkward formwork components",
      whoMayBeHarmed: "Formwork installers, laborers, carpenters",
      possibleConsequence: "Back injury, strains, crushed fingers, foot injury",
      existingMeasures:
        "Team lifts used; gloves and safety boots required; panels stored close to work area",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use mechanical lifting aids; limit manual carry distance; plan panel laydown and sequence; use handles or lifting frames where available",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Use of saws, drills, nail guns, and hand tools for formwork",
      hazardDescription:
        "Cuts, puncture injuries, noise, flying particles, or tool kickback during formwork fabrication",
      whoMayBeHarmed: "Carpenters, helpers, nearby workers",
      possibleConsequence: "Lacerations, eye injury, hearing damage, puncture wounds",
      existingMeasures:
        "Tools inspected; eye protection available; operators trained in tool use",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use guarded tools and dust extraction where possible; enforce eye and hearing protection; secure materials before cutting; isolate defective tools",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Access beneath or beside formwork during installation",
      hazardDescription:
        "Workers struck by falling tools, timber, props, or unsecured formwork components",
      whoMayBeHarmed: "Installers, workers below, inspectors, visitors",
      possibleConsequence: "Head injury, fractures, lacerations, fatality",
      existingMeasures:
        "Hard hats required; work area controlled; materials stacked in designated area",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Create exclusion zones below formwork work; secure tools and loose materials; avoid simultaneous work above and below; inspect housekeeping before continuing",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
  ]);

const createFormworkRemovalHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Stripping and removal of formwork",
      hazardDescription:
        "Premature formwork removal causing concrete instability, collapse, or unexpected load release",
      whoMayBeHarmed: "Formwork crew, concrete workers, inspectors, nearby trades",
      possibleConsequence: "Crushing injury, structural collapse, fatality",
      existingMeasures:
        "Removal supervised; curing time considered; workers follow site sequence",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Confirm concrete strength before stripping; follow engineered removal sequence; keep temporary supports until authorized; stop work if cracking or movement is observed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Lowering and handling removed formwork panels",
      hazardDescription:
        "Falling panels, props, tools, or debris during stripping and lowering operations",
      whoMayBeHarmed: "Formwork crew, workers below, crane crew",
      possibleConsequence: "Struck-by injury, fractures, head injury, fatality",
      existingMeasures:
        "Hard hats required; workers instructed to clear area; panels lowered under supervision",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Set exclusion zones; lower materials in controlled manner; do not drop panels or props; use mechanical lifting for large panels; secure loose components before release",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Manual prying, pulling, and dismantling formwork",
      hazardDescription:
        "Pinch points, sudden release, sharp edges, and ergonomic strain while removing tight panels or props",
      whoMayBeHarmed: "Carpenters, formwork installers, helpers",
      possibleConsequence: "Hand injury, strains, cuts, eye injury",
      existingMeasures:
        "Workers use gloves and hand tools; supervisors coordinate dismantling sequence",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use suitable pry tools and controlled force; keep body out of release line; rotate manual tasks; wear eye and hand protection",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Formwork removal at height or near slab edges",
      hazardDescription:
        "Fall from height while stripping formwork from elevated decks, soffits, or edge areas",
      whoMayBeHarmed: "Formwork crew, supervisors, inspectors",
      possibleConsequence: "Serious injury, fractures, fatality",
      existingMeasures:
        "Access equipment provided; fall protection available; workers briefed on edge hazards",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Install guardrails and safe working platforms before stripping; use fall restraint where needed; cover openings; prohibit removal from unsafe ladders or improvised platforms",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Storage and cleanup of stripped formwork materials",
      hazardDescription:
        "Trips, puncture injuries, and fire load from nails, timber offcuts, panels, and scattered props",
      whoMayBeHarmed: "Formwork crew, other trades, cleaners, visitors",
      possibleConsequence: "Puncture wounds, cuts, trips, fire spread",
      existingMeasures:
        "Waste bins available; housekeeping checks completed; safety footwear required",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Remove or bend nails immediately; stack panels and props in designated areas; clear walkways; segregate reusable timber from waste",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 2,
    },
  ]);

const createConcretePouringHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Concrete pouring into slabs, foundations, or formwork",
      hazardDescription:
        "Contact with wet concrete causing chemical burns, eye irritation, or skin damage",
      whoMayBeHarmed: "Concrete crew, finishers, pump crew, laborers",
      possibleConsequence: "Chemical burns, dermatitis, eye injury",
      existingMeasures:
        "Concrete PPE available; wash water provided; workers briefed on cement hazards",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Wear waterproof gloves, boots, eye protection, and long sleeves; wash off concrete immediately; provide emergency eyewash; prohibit kneeling directly in wet concrete",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Concrete delivery, chute, and placement area",
      hazardDescription:
        "Workers struck by moving truck, chute, hose, or concrete bucket during placement",
      whoMayBeHarmed: "Concrete crew, drivers, banksmen, workers nearby",
      possibleConsequence: "Crushing injury, struck-by injury, fractures",
      existingMeasures:
        "Drivers guided by site personnel; pour area identified; high-visibility clothing required",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use banksman for reversing trucks; keep workers clear of rotating chutes and buckets; create exclusion zones around discharge points; agree signals before pour",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Concrete pouring on reinforcement and formwork",
      hazardDescription:
        "Trips, slips, or falls while moving across rebar, wet surfaces, hoses, and changing pour levels",
      whoMayBeHarmed: "Concrete crew, finishers, inspectors",
      possibleConsequence: "Sprains, fractures, falls, cuts",
      existingMeasures:
        "Workers wear safety boots; access routes planned; housekeeping maintained during pour",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Provide stable walkways over rebar; manage hoses and cables; clear excess concrete from access routes; maintain lighting and edge protection",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Use of concrete vibrators and finishing tools",
      hazardDescription:
        "Hand-arm vibration, electric shock, noise, or manual strain from vibrating and finishing equipment",
      whoMayBeHarmed: "Concrete finishers, laborers, electricians",
      possibleConsequence: "Vibration injury, electric shock, strains, hearing damage",
      existingMeasures:
        "Equipment inspected; operators trained; hearing protection and gloves available",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Limit vibration exposure duration; inspect electrical leads and use RCD/GFCI protection; rotate operators; keep connectors dry and away from wet concrete",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Concrete pour into elevated or deep formwork",
      hazardDescription:
        "Formwork failure, overloading, or uncontrolled concrete pressure during rapid pour",
      whoMayBeHarmed: "Concrete crew, formwork crew, workers below",
      possibleConsequence: "Collapse, crushing injury, multiple serious injuries",
      existingMeasures:
        "Formwork inspected before pour; pour supervised; workers monitor obvious leaks or movement",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Confirm formwork inspection and pour rate limits; monitor ties and supports during pour; stop pouring if movement, leakage, or distress is observed; keep workers out from below",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createConcretePumpingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Concrete pump setup and outrigger deployment",
      hazardDescription:
        "Pump truck overturning due to poor ground conditions, inadequate outrigger setup, or unstable working platform",
      whoMayBeHarmed: "Pump operator, concrete crew, workers nearby, public",
      possibleConsequence: "Crushing injury, multiple serious injuries, fatality",
      existingMeasures:
        "Pump operator competent; outriggers used; setup area visually checked",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Assess ground bearing capacity; use outrigger mats; keep outriggers away from excavation edges and voids; stop pumping if setup conditions change",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Concrete pump boom operation",
      hazardDescription:
        "Contact between boom and overhead power lines, structures, or workers during movement",
      whoMayBeHarmed: "Pump operator, hoseman, concrete crew, nearby workers",
      possibleConsequence: "Electric shock, struck-by injury, crushing, fatality",
      existingMeasures:
        "Overhead hazards visually checked; operator controls boom; work area identified",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Maintain exclusion distances from power lines; use spotter for restricted visibility; define boom movement zone; include overhead hazards in pump plan",
      controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Concrete delivery hose handling",
      hazardDescription:
        "Hose whip, blockage release, or sudden hose movement during pumping",
      whoMayBeHarmed: "Hoseman, concrete workers, finishers, nearby workers",
      possibleConsequence: "Struck-by injury, fractures, eye injury, chemical burns",
      existingMeasures:
        "Hose handled by trained workers; pump operator communicates with hose crew; PPE worn",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Inspect hose and clamps before use; keep workers out of hose end danger zone; reduce pressure before clearing blockages; use agreed stop signals",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Priming, washout, and cleaning concrete pump lines",
      hazardDescription:
        "High-pressure discharge, concrete splash, or uncontrolled washout causing injury or contamination",
      whoMayBeHarmed: "Pump crew, concrete workers, waste handlers, environment",
      possibleConsequence: "Eye injury, chemical burns, slips, environmental harm",
      existingMeasures:
        "Washout area designated; PPE used; pump crew trained in cleaning procedure",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use controlled washout containers; depressurize lines before opening; keep workers clear of discharge; prevent concrete wash water entering drains or soil",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Pumping concrete near public or active work areas",
      hazardDescription:
        "Unauthorized access into pump operating zone or contact with hoses, outriggers, or delivery trucks",
      whoMayBeHarmed: "Workers, visitors, public, delivery drivers",
      possibleConsequence: "Struck-by injury, trips, crushing injury",
      existingMeasures:
        "Work area identified; high-visibility clothing required; supervisors monitor access",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Set barriers around pump, outriggers, and hose routes; manage concrete truck queue; keep pedestrians away from pump zone; assign traffic marshal where needed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
  ]);

const createConcreteCuringHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Application of curing compounds and sealers",
      hazardDescription:
        "Skin, eye, or respiratory exposure to curing compounds, sealers, or chemical additives",
      whoMayBeHarmed: "Concrete finishers, laborers, nearby workers",
      possibleConsequence: "Dermatitis, eye irritation, respiratory irritation, chemical burns",
      existingMeasures:
        "Safety data sheets available; gloves and eye protection used; workers trained in application",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use low-hazard products where practical; provide ventilation; wear chemical-resistant PPE; store and label curing chemicals correctly",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Wet curing and water application",
      hazardDescription:
        "Slips, trips, or electrical hazards from wet curing areas, hoses, and standing water",
      whoMayBeHarmed: "Concrete crew, inspectors, other trades, visitors",
      possibleConsequence: "Slips, falls, electric shock, sprains",
      existingMeasures:
        "Curing areas identified; hoses routed away from main access where possible; electrical tools inspected",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Barricade wet curing zones; route hoses through protected corridors; keep electrical equipment out of wet areas; use anti-slip access where inspections are needed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Protection of curing concrete slabs and edges",
      hazardDescription:
        "Workers entering curing areas too early or falling from slab edges and openings during curing inspections",
      whoMayBeHarmed: "Workers, inspectors, supervisors, visitors",
      possibleConsequence: "Falls, surface damage, fractures, serious injury",
      existingMeasures:
        "Curing area marked; supervisors restrict access; slab edges identified",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Install barriers and signage around curing concrete; maintain edge protection and opening covers; define safe inspection routes and access times",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Use of curing blankets, plastic sheeting, or covers",
      hazardDescription:
        "Trips, wind-blown covers, or manual handling injuries while placing and removing curing materials",
      whoMayBeHarmed: "Concrete workers, laborers, inspectors",
      possibleConsequence: "Falls, strains, struck-by injury, cuts",
      existingMeasures:
        "Covers stored near work area; team handling used for large sheets; workers wear gloves",
      initialProbability: 3,
      initialSeverity: 3,
      additionalMeasures:
        "Secure covers against wind; keep sheet edges away from walkways; use team lifts for heavy blankets; remove damaged covers from service",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Hot weather or cold weather curing controls",
      hazardDescription:
        "Heat stress, cold exposure, or unsafe temporary heating arrangements during curing protection",
      whoMayBeHarmed: "Concrete crew, finishers, supervisors",
      possibleConsequence: "Heat illness, burns, fire, hypothermia, fatigue",
      existingMeasures:
        "Weather monitored; drinking water available; temporary heaters used by competent workers when required",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Set weather-specific work/rest controls; ventilate temporary heating areas; keep heaters away from combustibles; provide shaded or warmed rest areas as needed",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
  ]);

const createMasonryBlockLayingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Manual lifting and laying of masonry blocks",
      hazardDescription:
        "Musculoskeletal injury from repetitive lifting, twisting, and placing heavy blocks or mortar",
      whoMayBeHarmed: "Masons, laborers, helpers",
      possibleConsequence: "Back injury, shoulder strain, wrist injury, fatigue",
      existingMeasures:
        "Workers trained in manual handling; blocks delivered near work face; team lifting used for heavy units",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use mechanical aids or block lifts where practical; store blocks at suitable height; rotate tasks; limit manual carry distance and load weight",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Mixing and using mortar",
      hazardDescription:
        "Cement contact, dust exposure, or eye injury from mortar mixing and application",
      whoMayBeHarmed: "Masons, laborers, nearby workers",
      possibleConsequence: "Chemical burns, dermatitis, respiratory irritation, eye injury",
      existingMeasures:
        "Gloves and eye protection available; water available for washing; workers briefed on cement hazards",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use wet cutting or dust control; wear suitable gloves, eye protection, and respiratory protection where dust remains; provide wash station close to work area",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Block laying from scaffolds or platforms",
      hazardDescription:
        "Falls from height or dropped blocks and tools from masonry work platforms",
      whoMayBeHarmed: "Masons, scaffold users, workers below, visitors",
      possibleConsequence: "Fall injury, head injury, fractures, fatality",
      existingMeasures:
        "Scaffold inspected; guardrails installed; hard hats required; materials stored on platform",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Maintain toe boards and brick guards; keep platform loading within limits; create exclusion zone below masonry work; secure tools and materials",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Cutting masonry blocks",
      hazardDescription:
        "Silica dust, flying fragments, noise, and cuts during block cutting",
      whoMayBeHarmed: "Masons, laborers, nearby workers",
      possibleConsequence: "Respiratory disease, eye injury, hearing damage, lacerations",
      existingMeasures:
        "Cutting area identified; eye and hearing protection available; water suppression used for some cuts",
      initialProbability: 4,
      initialSeverity: 4,
      additionalMeasures:
        "Use wet cutting or on-tool extraction; restrict access to cutting zone; wear suitable RPE; inspect blades and guards before use",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Partially built masonry walls",
      hazardDescription:
        "Wall instability, collapse, or wind damage before masonry reaches design strength or restraint",
      whoMayBeHarmed: "Masons, nearby trades, visitors, public",
      possibleConsequence: "Crushing injury, struck-by injury, fatality",
      existingMeasures:
        "Work supervised; walls built in stages; obvious unstable sections reported",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Provide temporary bracing for freestanding or high walls; follow lift height limits; stop work in high winds; keep people clear of unrestrained wall zones",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createSteelFixingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Steel fixing for slabs, beams, columns, and walls",
      hazardDescription:
        "Cuts, punctures, and impalement from sharp reinforcement, tie wire, and exposed starter bars",
      whoMayBeHarmed: "Steel fixers, concrete crew, inspectors, other trades",
      possibleConsequence: "Lacerations, puncture wounds, impalement, serious injury",
      existingMeasures:
        "Workers wear gloves and safety boots; some rebar caps used; work areas identified",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Cap exposed bars; trim or bend tie wire ends; maintain clear access; barricade high-density reinforcement zones when not actively worked",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Positioning reinforcement in congested areas",
      hazardDescription:
        "Pinch points, trapped hands, and crush injuries when aligning bars, cages, spacers, and chairs",
      whoMayBeHarmed: "Steel fixers, helpers, riggers",
      possibleConsequence: "Crushed fingers, hand injury, fractures",
      existingMeasures:
        "Team lifting used; gloves worn; workers communicate during positioning",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Use tag lines or positioning tools; keep hands out of pinch zones; appoint a lift leader for coordinated moves; pre-plan bar sequence in congested areas",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Steel fixing in columns, walls, or vertical cages",
      hazardDescription:
        "Falling objects or cage instability while working on vertical reinforcement assemblies",
      whoMayBeHarmed: "Steel fixers, workers below, inspectors",
      possibleConsequence: "Head injury, cage collapse, struck-by injury, fatality",
      existingMeasures:
        "Hard hats required; cages tied progressively; supervisors inspect stability",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Brace vertical cages; restrict access below fixing work; secure loose bars immediately; verify ties and supports before workers climb or work adjacent",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Access over fixed reinforcement",
      hazardDescription:
        "Trips and falls from walking over mesh, bars, chairs, couplers, and uneven reinforcement",
      whoMayBeHarmed: "Steel fixers, inspectors, concrete crew",
      possibleConsequence: "Sprains, fractures, cuts, falls onto rebar",
      existingMeasures:
        "Workers wear safety footwear; temporary access discussed before work; housekeeping maintained",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Provide temporary walk boards; restrict walking on reinforcement where possible; secure mesh and chairs; keep access paths clear of offcuts and tie wire",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Lifting reinforcement bundles and prefabricated cages",
      hazardDescription:
        "Dropped, swinging, or unstable reinforcement loads during crane or telehandler lifting",
      whoMayBeHarmed: "Steel fixers, riggers, crane operators, nearby workers",
      possibleConsequence: "Crushing injury, impalement, fatality",
      existingMeasures:
        "Lifting gear inspected; trained slingers used; workers briefed to stand clear",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Bundle and secure loads before lifting; use approved lifting points; create exclusion zone; inspect cage rigidity and lifting method before lift",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createStructuralSteelErectionHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Erection of structural steel columns, beams, and frames",
      hazardDescription:
        "Dropped, swinging, or unstable steel member during crane lifting and positioning",
      whoMayBeHarmed: "Steel erectors, riggers, crane operator, workers nearby",
      possibleConsequence: "Crushing injury, struck-by injury, fatality",
      existingMeasures:
        "Lift plan prepared; trained riggers used; lifting accessories inspected",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use engineered lift points and tag lines; maintain exclusion zone; conduct pre-lift briefing; verify load weight, center of gravity, and weather limits",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Connecting steel at height",
      hazardDescription:
        "Fall from height while bolting, aligning, or connecting steel members",
      whoMayBeHarmed: "Steel erectors, connectors, inspectors",
      possibleConsequence: "Serious injury, fractures, fatality",
      existingMeasures:
        "Fall protection equipment available; MEWPs or access platforms used where possible; workers trained",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use collective protection and MEWPs where practical; maintain 100 percent tie-off where required; plan safe access and rescue; inspect anchor points before use",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Temporary stability of steel frame",
      hazardDescription:
        "Frame instability or collapse before permanent bracing, bolting, or decking is complete",
      whoMayBeHarmed: "Steel erectors, other trades, crane crew, public",
      possibleConsequence: "Structural collapse, multiple serious injuries, fatality",
      existingMeasures:
        "Erection sequence followed; temporary bolts and bracing used; supervisor monitors frame stability",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Follow engineered erection plan; install temporary bracing as specified; do not release crane until member is stable; restrict access beneath incomplete frame",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Steel erection near other work areas",
      hazardDescription:
        "Dropped tools, bolts, drift pins, or materials falling from elevated steel work",
      whoMayBeHarmed: "Workers below, riggers, inspectors, visitors",
      possibleConsequence: "Head injury, lacerations, fractures, fatality",
      existingMeasures:
        "Hard hats required; work area controlled; tool bags used by some workers",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use tool lanyards and bolt bags; establish exclusion zones below steel erection; install debris netting where needed; prevent simultaneous work below",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Steel erection in wind or poor weather",
      hazardDescription:
        "Loss of load control, unsafe access, or reduced visibility due to wind, rain, lightning, or icy surfaces",
      whoMayBeHarmed: "Steel erectors, crane crew, riggers, workers nearby",
      possibleConsequence: "Fall from height, dropped load, collision, fatality",
      existingMeasures:
        "Weather checked before lift; work stopped during obvious unsafe conditions",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Set wind speed limits for lifts and access; stop work during lightning or icy conditions; monitor gusts; postpone complex lifts in poor visibility",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createBoltingAndTorqueingHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Bolting and torqueing structural connections",
      hazardDescription:
        "Hand and finger injuries from pinch points, spanners, impact wrenches, and aligning holes",
      whoMayBeHarmed: "Steel erectors, mechanics, helpers",
      possibleConsequence: "Crushed fingers, cuts, sprains, fractures",
      existingMeasures:
        "Workers trained; gloves worn; correct tools available",
      initialProbability: 4,
      initialSeverity: 3,
      additionalMeasures:
        "Keep hands clear of pinch points; use drift pins and alignment tools correctly; inspect sockets and reaction arms; avoid placing fingers in bolt holes",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 2,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Use of impact wrenches, torque tools, and hydraulic tensioners",
      hazardDescription:
        "Tool kickback, reaction arm movement, high-pressure hydraulic failure, or noise exposure",
      whoMayBeHarmed: "Bolting crew, nearby workers, inspectors",
      possibleConsequence: "Hand injury, injection injury, hearing damage, bruising",
      existingMeasures:
        "Tools inspected; operators trained; hearing protection available",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use correct tool for bolt size; inspect hoses and fittings; keep body clear of reaction arms; maintain hearing protection zones; isolate defective tools",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Bolting at height or on incomplete structures",
      hazardDescription:
        "Falls from height while accessing connections, using tools, or carrying bolts",
      whoMayBeHarmed: "Steel erectors, inspectors, supervisors",
      possibleConsequence: "Serious injury, fractures, fatality",
      existingMeasures:
        "Fall protection available; access equipment used; workers trained for working at height",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use MEWPs or scaffold platforms where practical; maintain tie-off; provide safe bolt storage at height; plan rescue arrangements before work",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Handling bolts, nuts, washers, and tools at height",
      hazardDescription:
        "Dropped objects from elevated bolting work striking workers below",
      whoMayBeHarmed: "Workers below, riggers, inspectors, visitors",
      possibleConsequence: "Head injury, cuts, fractures, fatality",
      existingMeasures:
        "Hard hats required; bolt bags used; work area controlled",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use tethered tools and sealed bolt bags; create exclusion zone below; account for loose fasteners; inspect platforms for dropped-object gaps",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Verification and marking of torqued connections",
      hazardDescription:
        "Incorrect torque sequence, missed bolts, or over-tightening causing structural integrity issues",
      whoMayBeHarmed: "Steel erectors, future users, inspectors, other trades",
      possibleConsequence: "Connection failure, structural movement, serious injury",
      existingMeasures:
        "Torque settings specified; supervisors inspect completed connections; bolts marked after tightening",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Use calibrated torque tools; record torque checks; follow specified sequence; segregate completed and incomplete connections with clear marking",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createPrecastConcreteInstallationHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Lifting and positioning precast concrete elements",
      hazardDescription:
        "Dropped, swinging, or unstable precast panel, beam, or slab during lifting and positioning",
      whoMayBeHarmed: "Riggers, installers, crane operator, workers nearby",
      possibleConsequence: "Crushing injury, struck-by injury, multiple fatalities",
      existingMeasures:
        "Lift plan prepared; lifting inserts inspected; trained riggers used",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Verify lifting anchor capacity and element weight; use approved rigging and tag lines; maintain exclusion zone; conduct test lift before movement",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Temporary propping and stability of precast elements",
      hazardDescription:
        "Precast element overturning or collapsing before permanent connections are complete",
      whoMayBeHarmed: "Installers, riggers, nearby trades, inspectors",
      possibleConsequence: "Crushing injury, structural collapse, fatality",
      existingMeasures:
        "Temporary props available; installation sequence supervised; connections installed progressively",
      initialProbability: 2,
      initialSeverity: 5,
      additionalMeasures:
        "Follow engineered temporary works design; install props before crane release; inspect fixings and prop foundations; restrict access around unrestrained elements",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Precast installation at height or near edges",
      hazardDescription:
        "Falls from height during alignment, fixing, grouting, or connection of precast elements",
      whoMayBeHarmed: "Installers, inspectors, supervisors",
      possibleConsequence: "Serious injury, fractures, fatality",
      existingMeasures:
        "Fall protection available; access platforms used where possible; workers trained",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use MEWPs, scaffold, or engineered access platforms; maintain edge protection; plan tie-off and rescue; avoid climbing on precast elements",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Alignment, shimming, and connection of precast elements",
      hazardDescription:
        "Crush injuries and pinch points while aligning heavy precast components and inserting shims or fixings",
      whoMayBeHarmed: "Installers, riggers, helpers",
      possibleConsequence: "Crushed fingers, hand injury, fractures, amputation",
      existingMeasures:
        "Workers use gloves; installation supervised; communication maintained with crane operator",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use alignment tools and hands-free positioning where possible; keep hands out of pinch zones; hold load stable until fixed; agree clear stop commands",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Delivery and storage of precast components",
      hazardDescription:
        "Precast elements tipping, sliding, or being struck by vehicles during delivery and storage",
      whoMayBeHarmed: "Drivers, riggers, installers, forklift operators",
      possibleConsequence: "Crushing injury, struck-by injury, property damage, fatality",
      existingMeasures:
        "Storage area designated; delivery supervised; components supported in racks or stillages where available",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use engineered storage frames; keep components on level ground; inspect transport restraints before release; separate delivery vehicles from pedestrians",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
  ]);

const createLadderWorkHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Use of portable ladders for access or short-duration work",
      hazardDescription:
        "Fall from ladder due to incorrect angle, poor footing, overreaching, or unsecured ladder",
      whoMayBeHarmed: "Workers, contractors, maintenance personnel",
      possibleConsequence: "Fall injury, fractures, head injury, fatality",
      existingMeasures:
        "Workers instructed on three points of contact; ladders visually inspected; damaged ladders removed when reported",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Use scaffold, platform, or MEWP where task is long or heavy; secure ladder; maintain correct angle; prohibit overreaching; use a second person where needed",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Ladder placement on construction surfaces",
      hazardDescription:
        "Ladder slipping or sinking due to wet, uneven, muddy, or unstable surfaces",
      whoMayBeHarmed: "Workers using ladders, nearby workers",
      possibleConsequence: "Falls, sprains, fractures, serious injury",
      existingMeasures:
        "Ladders placed on visually stable ground; workers check footing before use",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Place ladders on firm level base; use anti-slip feet or boards where suitable; do not use ladders on loose materials; stop ladder work in unsafe weather or surface conditions",
      controlHierarchy: ["Engineering Controls", "Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Carrying tools and materials on ladders",
      hazardDescription:
        "Loss of balance or dropped objects while climbing with tools, cables, or materials",
      whoMayBeHarmed: "Ladder user, workers below, visitors",
      possibleConsequence: "Falls, head injury, cuts, fractures",
      existingMeasures:
        "Workers use tool belts where available; hard hats required; work area checked before task",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Use tool lanyards and hoisting methods; keep both hands available for climbing; barricade area below; avoid carrying bulky materials on ladders",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Ladder work near doors, routes, or vehicles",
      hazardDescription:
        "Ladder struck by door, pedestrian, vehicle, or mobile plant while in use",
      whoMayBeHarmed: "Ladder user, pedestrians, drivers",
      possibleConsequence: "Fall from height, struck-by injury, fractures",
      existingMeasures:
        "Workers position ladders away from obvious traffic; high-visibility clothing worn",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Lock or control doors; barricade ladder work area; use spotter near routes; avoid ladder work in vehicle movement zones unless isolated",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 3,
    },
    {
      workplaceActivity: "Inspection and storage of ladders",
      hazardDescription:
        "Use of damaged, contaminated, or unsuitable ladder causing failure during work",
      whoMayBeHarmed: "Workers, contractors, inspectors",
      possibleConsequence: "Fall injury, fractures, serious injury",
      existingMeasures:
        "Ladders visually checked before use; damaged equipment reported; ladders stored in site storage areas",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Implement ladder inspection register; remove damaged ladders from service immediately; keep rungs clean from mud and oil; select ladder type and rating for task",
      controlHierarchy: ["Administrative Controls"],
      residualProbability: 1,
      residualSeverity: 4,
    },
  ]);

const createRoofWorkHazards = (): HazardRow[] =>
  createLibraryHazards([
    {
      workplaceActivity: "Roof work near edges, openings, or leading edges",
      hazardDescription:
        "Fall from roof edge, opening, or leading edge due to missing edge protection or unsafe access",
      whoMayBeHarmed: "Roof workers, contractors, inspectors",
      possibleConsequence: "Serious injury, fractures, fatality",
      existingMeasures:
        "Workers trained in working at height; fall protection available; roof access controlled",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Install guardrails, covers, or parapet protection; use fall restraint or arrest systems; inspect anchor points; prepare rescue plan before work starts",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Work on fragile roofs, skylights, or weak surfaces",
      hazardDescription:
        "Fall through fragile roof material, skylight, or deteriorated surface",
      whoMayBeHarmed: "Roof workers, maintenance personnel, contractors",
      possibleConsequence: "Fall through roof, serious injury, fatality",
      existingMeasures:
        "Fragile areas identified where known; workers instructed not to step on skylights; warning signs used",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Conduct roof survey before access; cover or guard skylights; use crawling boards or platforms; mark fragile areas clearly; restrict access to authorized workers",
      controlHierarchy: ["Elimination", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Roof material handling and installation",
      hazardDescription:
        "Falling materials, tools, or roof sheets from elevated work areas",
      whoMayBeHarmed: "Workers below, roof workers, visitors, public",
      possibleConsequence: "Head injury, cuts, fractures, fatality",
      existingMeasures:
        "Hard hats required; materials stored on roof where needed; work area below monitored",
      initialProbability: 3,
      initialSeverity: 4,
      additionalMeasures:
        "Create exclusion zone below roof work; secure materials against wind; use tool lanyards; lift materials using controlled methods; keep roof loads within limits",
      controlHierarchy: ["Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
    {
      workplaceActivity: "Roof work in wind, rain, heat, or poor visibility",
      hazardDescription:
        "Weather conditions causing slips, loss of material control, heat stress, or reduced visibility",
      whoMayBeHarmed: "Roof workers, supervisors, workers below",
      possibleConsequence: "Fall from height, dropped materials, heat illness, fatality",
      existingMeasures:
        "Weather checked before work; work stopped during obvious unsafe conditions; drinking water available",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Set weather stop-work criteria; monitor wind speed; postpone roof sheet handling in gusts; use anti-slip footwear; manage heat stress with breaks and hydration",
      controlHierarchy: ["Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 5,
    },
    {
      workplaceActivity: "Access to and from roof work areas",
      hazardDescription:
        "Unsafe access via ladders, hatches, scaffolds, or temporary stairs causing falls or dropped objects",
      whoMayBeHarmed: "Roof workers, inspectors, contractors, workers below",
      possibleConsequence: "Falls, head injury, fractures, fatality",
      existingMeasures:
        "Access route identified; ladders or scaffold used; workers briefed on access rules",
      initialProbability: 3,
      initialSeverity: 5,
      additionalMeasures:
        "Provide secure scaffold stair tower or fixed access where practical; inspect ladders and hatches; maintain three points of contact; keep access routes clear and protected",
      controlHierarchy: ["Substitution", "Engineering Controls", "Administrative Controls", "PPE"],
      residualProbability: 1,
      residualSeverity: 4,
    },
  ]);

const constructionRiskAssessmentLibrary: Record<
  string,
  { title: string; createHazards: () => HazardRow[] }
> = {
  "Working at Height": {
    title: "Construction - Working at Height Risk Assessment",
    createHazards: createWorkingAtHeightHazards,
  },
  "Excavation and trenching": {
    title: "Construction - Excavation and Trenching Risk Assessment",
    createHazards: createExcavationAndTrenchingHazards,
  },
  "Scaffolding erection": {
    title: "Construction - Scaffolding Erection Risk Assessment",
    createHazards: createScaffoldingErectionHazards,
  },
  "Electrical installation": {
    title: "Construction - Electrical Installation Risk Assessment",
    createHazards: createElectricalInstallationHazards,
  },
  Welding: {
    title: "Construction - Welding Risk Assessment",
    createHazards: createWeldingHazards,
  },
  "Confined space entry": {
    title: "Construction - Confined Space Entry Risk Assessment",
    createHazards: createConfinedSpaceEntryHazards,
  },
  "Crane lifting operations": {
    title: "Construction - Crane Lifting Operations Risk Assessment",
    createHazards: createCraneLiftingOperationsHazards,
  },
  "Forklift operation": {
    title: "Construction - Forklift Operation Risk Assessment",
    createHazards: createForkliftOperationHazards,
  },
  Demolition: {
    title: "Construction - Demolition Risk Assessment",
    createHazards: createDemolitionHazards,
  },
  "Manual handling of materials": {
    title: "Construction - Manual Handling of Materials Risk Assessment",
    createHazards: createManualHandlingHazards,
  },
  "Site mobilization and demobilization": {
    title: "Construction - Site Mobilization and Demobilization Risk Assessment",
    createHazards: createSiteMobilizationAndDemobilizationHazards,
  },
  "Temporary fencing and access control": {
    title: "Construction - Temporary Fencing and Access Control Risk Assessment",
    createHazards: createTemporaryFencingAndAccessControlHazards,
  },
  "Temporary power distribution": {
    title: "Construction - Temporary Power Distribution Risk Assessment",
    createHazards: createTemporaryPowerDistributionHazards,
  },
  "Site traffic route setup": {
    title: "Construction - Site Traffic Route Setup Risk Assessment",
    createHazards: createSiteTrafficRouteSetupHazards,
  },
  "Pedestrian walkway setup": {
    title: "Construction - Pedestrian Walkway Setup Risk Assessment",
    createHazards: createPedestrianWalkwaySetupHazards,
  },
  "Material laydown area setup": {
    title: "Construction - Material Laydown Area Setup Risk Assessment",
    createHazards: createMaterialLaydownAreaSetupHazards,
  },
  "Housekeeping and waste segregation": {
    title: "Construction - Housekeeping and Waste Segregation Risk Assessment",
    createHazards: createHousekeepingAndWasteSegregationHazards,
  },
  "Shoring and trench support": {
    title: "Construction - Shoring and Trench Support Risk Assessment",
    createHazards: createShoringAndTrenchSupportHazards,
  },
  "Dewatering works": {
    title: "Construction - Dewatering Works Risk Assessment",
    createHazards: createDewateringWorksHazards,
  },
  "Backfilling and compaction": {
    title: "Construction - Backfilling and Compaction Risk Assessment",
    createHazards: createBackfillingAndCompactionHazards,
  },
  "Ground leveling and grading": {
    title: "Construction - Ground Leveling and Grading Risk Assessment",
    createHazards: createGroundLevelingAndGradingHazards,
  },
  "Pile driving": {
    title: "Construction - Pile Driving Risk Assessment",
    createHazards: createPileDrivingHazards,
  },
  "Bored piling": {
    title: "Construction - Bored Piling Risk Assessment",
    createHazards: createBoredPilingHazards,
  },
  "Foundation preparation": {
    title: "Construction - Foundation Preparation Risk Assessment",
    createHazards: createFoundationPreparationHazards,
  },
  "Underground utility locating": {
    title: "Construction - Underground Utility Locating Risk Assessment",
    createHazards: createUndergroundUtilityLocatingHazards,
  },
  "Work near buried services": {
    title: "Construction - Work Near Buried Services Risk Assessment",
    createHazards: createWorkNearBuriedServicesHazards,
  },
  "Rebar cutting and bending": {
    title: "Construction - Rebar Cutting and Bending Risk Assessment",
    createHazards: createRebarCuttingAndBendingHazards,
  },
  "Rebar fixing": {
    title: "Construction - Rebar Fixing Risk Assessment",
    createHazards: createRebarFixingHazards,
  },
  "Formwork installation": {
    title: "Construction - Formwork Installation Risk Assessment",
    createHazards: createFormworkInstallationHazards,
  },
  "Formwork removal": {
    title: "Construction - Formwork Removal Risk Assessment",
    createHazards: createFormworkRemovalHazards,
  },
  "Concrete pouring": {
    title: "Construction - Concrete Pouring Risk Assessment",
    createHazards: createConcretePouringHazards,
  },
  "Concrete pumping": {
    title: "Construction - Concrete Pumping Risk Assessment",
    createHazards: createConcretePumpingHazards,
  },
  "Concrete curing": {
    title: "Construction - Concrete Curing Risk Assessment",
    createHazards: createConcreteCuringHazards,
  },
  "Masonry block laying": {
    title: "Construction - Masonry Block Laying Risk Assessment",
    createHazards: createMasonryBlockLayingHazards,
  },
  "Steel fixing": {
    title: "Construction - Steel Fixing Risk Assessment",
    createHazards: createSteelFixingHazards,
  },
  "Structural steel erection": {
    title: "Construction - Structural Steel Erection Risk Assessment",
    createHazards: createStructuralSteelErectionHazards,
  },
  "Bolting and torqueing": {
    title: "Construction - Bolting and Torqueing Risk Assessment",
    createHazards: createBoltingAndTorqueingHazards,
  },
  "Precast concrete installation": {
    title: "Construction - Precast Concrete Installation Risk Assessment",
    createHazards: createPrecastConcreteInstallationHazards,
  },
  "Ladder work": {
    title: "Construction - Ladder Work Risk Assessment",
    createHazards: createLadderWorkHazards,
  },
  "Roof work": {
    title: "Construction - Roof Work Risk Assessment",
    createHazards: createRoofWorkHazards,
  },
};

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
  const selectedLibraryAssessment =
    header.sector === "Construction" && !customSectorMode
      ? constructionRiskAssessmentLibrary[header.activity]
      : undefined;
  const canGenerateLibraryAssessment = Boolean(selectedLibraryAssessment);
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

  const generateLibraryAssessment = () => {
    if (!selectedLibraryAssessment) {
      return;
    }

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
      activity: header.activity,
      title:
        current.title.trim().length > 0
          ? current.title
          : selectedLibraryAssessment.title,
    }));
    setCustomSectorMode(false);
    setCustomActivityMode(false);
    setHazards(selectedLibraryAssessment.createHazards());
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

              {canGenerateLibraryAssessment ? (
                <div className="mt-5 rounded-2xl border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#DDFBFF]">
                        Laboria HSE Library prototype available
                      </div>
                      <p className="mt-1 text-sm text-slate-300">
                        Generate a complete editable assessment for Construction
                        - {header.activity}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateLibraryAssessment}
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
