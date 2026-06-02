"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Copy,
  Download,
  FileText,
  Moon,
  Plus,
  Save,
  Sun,
  Trash2,
} from "lucide-react";
import {
  appendActionTrackerAction,
  createActionFromInput,
  findActionByLinkedSource,
  getDateInputDaysFromNow,
  type ActionPriority,
} from "@/app/lib/actionTracker";
import {
  defaultWorkspaceSettings,
  hasCompanyBranding,
  readWorkspaceSettings,
  workspaceSettingsUpdatedEvent,
  type WorkspaceSettings,
} from "@/app/lib/workspaceSettings";
import type { WorkspaceNavigationIntent } from "@/app/lib/workspaceNavigation";
import OrbitAiToolStrip from "@/app/components/OrbitAiToolStrip";
import type { OrbitAiStructuredRiskAssessment } from "@/app/lib/orbitAiRiskAssessment";

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
  darkMode: boolean;
  onToggleTheme: () => void;
  createdBy: string;
  navigationIntent?: WorkspaceNavigationIntent | null;
  onNavigationIntentHandled?: () => void;
};

type SelectOption = {
  value: string;
  label: string;
};

type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
};

type ActivityGroup = {
  label: string;
  activities: string[];
};

const controlHierarchyOptions: ControlHierarchy[] = [
  "Elimination",
  "Substitution",
  "Engineering Controls",
  "Administrative Controls",
  "PPE",
];

const constructionActivityGroups: ActivityGroup[] = [
  {
    label: "Site Setup & Temporary Works",
    activities: [
      "Site mobilization and demobilization",
      "Temporary fencing and access control",
      "Temporary power distribution",
      "Site traffic route setup",
      "Pedestrian walkway setup",
      "Material laydown area setup",
      "Housekeeping and waste segregation",
      "Welfare facility setup",
      "Temporary lighting installation",
      "Signage and barricade installation",
    ],
  },
  {
    label: "Earthworks, Excavation & Groundworks",
    activities: [
      "Excavation and trenching",
      "Shoring and trench support",
      "Dewatering works",
      "Backfilling and compaction",
      "Ground leveling and grading",
      "Pile driving",
      "Bored piling",
      "Foundation preparation",
      "Underground utility locating",
      "Work near buried services",
    ],
  },
  {
    label: "Concrete, Masonry & Structural Works",
    activities: [
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
    ],
  },
  {
    label: "Work at Height & Access",
    activities: [
      "Working at Height",
      "Scaffolding erection",
      "Ladder work",
      "Roof work",
      "Scaffolding inspection",
      "MEWP operation",
      "Edge protection installation",
      "Fall arrest system use",
      "Facade work",
      "Window installation",
      "Painting at height",
      "Cladding installation",
    ],
  },
  {
    label: "Electrical, MEP & Commissioning",
    activities: [
      "Electrical installation",
      "Welding",
      "Temporary electrical testing",
      "Cable pulling",
      "HVAC installation",
      "Plumbing installation",
      "Oxy-fuel cutting",
      "Grinding and cutting",
      "Hot work in occupied areas",
      "Commissioning and testing",
    ],
  },
  {
    label: "Lifting, Plant & Equipment",
    activities: [
      "Crane lifting operations",
      "Forklift operation",
      "Mobile crane setup",
      "Tower crane operation",
      "Rigging and slinging",
      "Telehandler operation",
      "Excavator operation",
      "Loader operation",
      "Dumper operation",
      "Plant refueling",
      "Plant maintenance on site",
    ],
  },
  {
    label: "High-Risk / Specialist Operations",
    activities: [
      "Confined space entry",
      "Demolition",
      "Manual handling of materials",
      "Work near live traffic",
      "Work near overhead power lines",
      "Work over water",
      "Asbestos disturbance",
      "Silica dust generating work",
      "Night work",
      "Emergency response drill",
    ],
  },
];

const warehouseActivityGroups: ActivityGroup[] = [
  {
    label: "Warehouse Operations",
    activities: [
      "Goods receiving",
      "Loading and unloading",
      "Pallet handling",
      "Order picking",
      "Packing operations",
      "Dispatch operations",
      "Container unloading",
      "Returns handling",
    ],
  },
  {
    label: "Forklifts & Mobile Equipment",
    activities: [
      "Forklift operation",
      "Reach truck operation",
      "Pallet truck operation",
      "Battery charging",
      "Refueling operations",
    ],
  },
  {
    label: "Storage & Racking",
    activities: [
      "Racking inspection",
      "High-level storage",
      "Manual stacking",
      "Storage of hazardous materials",
      "Cold storage operations",
    ],
  },
  {
    label: "Maintenance & Facility",
    activities: [
      "Cleaning operations",
      "Waste handling",
      "Conveyor maintenance",
      "Electrical maintenance",
      "Dock leveler operation",
    ],
  },
  {
    label: "High-Risk Operations",
    activities: [
      "Work at height in warehouse",
      "Confined space entry",
      "Fire emergency response",
      "Spill response",
      "Lone working",
      "Night shift warehouse operations",
    ],
  },
];

const manufacturingActivityGroups: ActivityGroup[] = [
  {
    label: "Production Operations",
    activities: [
      "Machine operation",
      "Assembly line work",
      "Packaging line operation",
      "Material feeding into machines",
      "Product inspection",
      "Quality control sampling",
      "Line changeover",
      "Batch production",
      "Manual sorting",
      "Finished goods handling",
    ],
  },
  {
    label: "Machinery & Equipment",
    activities: [
      "Machine guarding inspection",
      "Use of rotating machinery",
      "Press machine operation",
      "CNC machine operation",
      "Conveyor operation",
      "Lockout/tagout during maintenance",
      "Equipment cleaning",
      "Equipment lubrication",
      "Tool change",
      "Machine troubleshooting",
    ],
  },
  {
    label: "Maintenance & Engineering",
    activities: [
      "Preventive maintenance",
      "Corrective maintenance",
      "Electrical maintenance",
      "Mechanical maintenance",
      "Hydraulic system maintenance",
      "Pneumatic system maintenance",
      "Work at height during maintenance",
      "Confined space maintenance",
      "Hot work maintenance",
      "Contractor maintenance work",
    ],
  },
  {
    label: "Materials & Chemical Handling",
    activities: [
      "Chemical handling",
      "Solvent use",
      "Paint/coating application",
      "Compressed gas cylinder handling",
      "Flammable material storage",
      "Raw material handling",
      "Powder handling",
      "Dust-generating process",
      "Spill response",
      "Waste chemical handling",
    ],
  },
  {
    label: "Workplace Environment",
    activities: [
      "Noise exposure areas",
      "Heat stress areas",
      "Poor ventilation areas",
      "Slip/trip hazard areas",
      "Manual handling tasks",
      "Forklift interaction areas",
      "Pedestrian movement in production area",
      "Cleaning and sanitation",
      "Emergency evacuation",
      "Fire prevention",
    ],
  },
];

const officeActivityGroups: ActivityGroup[] = [
  {
    label: "Office Workstations",
    activities: [
      "Display screen equipment work",
      "Desk-based computer work",
      "Workstation setup",
      "Prolonged sitting",
      "Keyboard and mouse use",
      "Document handling",
      "Shared workstation use",
      "Remote/hybrid office work",
    ],
  },
  {
    label: "Office Movement & Housekeeping",
    activities: [
      "Walking in office corridors",
      "Stair use",
      "Office housekeeping",
      "Cable management",
      "Storage cabinet use",
      "Filing and archive work",
      "Carrying office supplies",
      "Cleaning coordination",
    ],
  },
  {
    label: "Facilities & Building Safety",
    activities: [
      "Fire evacuation",
      "Emergency drills",
      "First aid response",
      "Electrical equipment use",
      "Printer and copier use",
      "Kitchen/pantry use",
      "Meeting room use",
      "Visitor management",
    ],
  },
  {
    label: "Psychosocial & Organizational",
    activities: [
      "Workload pressure",
      "Long screen time",
      "Lone working after hours",
      "Workplace stress",
      "Workplace communication",
      "Working with difficult clients",
      "Fatigue from overtime",
      "New employee onboarding",
    ],
  },
  {
    label: "Office Maintenance & Support",
    activities: [
      "Minor office maintenance",
      "Contractor work in office",
      "Furniture moving",
      "Lighting maintenance",
      "HVAC comfort issues",
      "Indoor air quality concerns",
      "Waste handling",
      "Paper shredding",
    ],
  },
];

const healthcareActivityGroups: ActivityGroup[] = [
  {
    label: "Patient Care",
    activities: [
      "Patient handling and repositioning",
      "Patient transfer",
      "Bedside care",
      "Assisting mobility",
      "Patient bathing",
      "Patient feeding",
      "Handling aggressive patients",
      "Isolation room care",
      "Emergency patient response",
      "Home healthcare visit",
    ],
  },
  {
    label: "Clinical Procedures",
    activities: [
      "Injection administration",
      "Blood sampling",
      "IV line insertion",
      "Wound dressing",
      "Minor procedure assistance",
      "Sharps handling",
      "Specimen collection",
      "Medication preparation",
      "Use of medical devices",
      "Clinical waste disposal",
    ],
  },
  {
    label: "Infection Prevention",
    activities: [
      "Cleaning contaminated surfaces",
      "Handling infectious materials",
      "PPE donning and doffing",
      "Disinfection procedures",
      "Laundry handling",
      "Isolation waste handling",
      "Exposure to blood/body fluids",
      "Respiratory infection control",
      "Sterile area work",
      "Spill cleanup",
    ],
  },
  {
    label: "Laboratory & Diagnostic Work",
    activities: [
      "Sample receiving",
      "Laboratory testing",
      "Chemical reagent handling",
      "Biological sample handling",
      "Centrifuge use",
      "Microscope work",
      "Autoclave operation",
      "Laboratory waste handling",
      "Cold storage/freezer access",
      "Equipment calibration",
    ],
  },
  {
    label: "Facility & Support Services",
    activities: [
      "Medical gas cylinder handling",
      "Cleaning clinical areas",
      "Hospital laundry work",
      "Food service in healthcare",
      "Maintenance in clinical areas",
      "Waste transportation",
      "Emergency evacuation",
      "Fire response",
      "Security incident response",
      "Night shift healthcare work",
    ],
  },
];

const oilGasActivityGroups: ActivityGroup[] = [
  {
    label: "Drilling & Well Operations",
    activities: [
      "Drilling operations",
      "Well intervention",
      "Mud handling",
      "Rig floor operations",
      "Casing installation",
      "Pressure testing",
      "Wellhead maintenance",
      "Blowout prevention equipment inspection",
      "Cementing operations",
      "Wireline operations",
    ],
  },
  {
    label: "Process & Production Operations",
    activities: [
      "Process plant operation",
      "Separator operation",
      "Pump operation",
      "Compressor operation",
      "Valve maintenance",
      "Pipeline pigging",
      "Tank operations",
      "Gas detection monitoring",
      "Flare system operation",
      "Utility system operation",
    ],
  },
  {
    label: "Maintenance & Shutdown",
    activities: [
      "Mechanical maintenance",
      "Electrical maintenance",
      "Instrument maintenance",
      "Hot work during shutdown",
      "Confined space entry",
      "Work at height",
      "Isolation/LOTO",
      "Scaffold use",
      "Contractor maintenance",
      "Emergency repair work",
    ],
  },
  {
    label: "Chemical & Hazardous Materials",
    activities: [
      "Chemical injection",
      "Fuel transfer",
      "Hydrocarbon sampling",
      "Corrosive chemical handling",
      "H2S exposure areas",
      "Flammable liquid handling",
      "Gas cylinder handling",
      "Spill response",
      "Waste oil handling",
      "Hazardous waste storage",
    ],
  },
  {
    label: "Marine & Logistics",
    activities: [
      "Crane lifting operations",
      "Helicopter landing operations",
      "Vessel loading/unloading",
      "Offshore transfer operations",
      "Forklift operation",
      "Material handling",
      "Working over water",
      "Emergency evacuation drill",
      "Lifeboat drill",
      "Night operations",
    ],
  },
];

const miningActivityGroups: ActivityGroup[] = [
  {
    label: "Surface Mining Operations",
    activities: [
      "Excavation operations",
      "Blasting preparation",
      "Rock breaking",
      "Haul truck operation",
      "Loader operation",
      "Bulldozer operation",
      "Drilling operations",
      "Stockpile management",
      "Ore handling",
      "Waste dumping",
    ],
  },
  {
    label: "Underground Mining",
    activities: [
      "Underground drilling",
      "Tunnel support installation",
      "Ventilation system work",
      "Underground transport",
      "Confined underground work",
      "Ground stability inspection",
      "Dewatering underground",
      "Emergency refuge operations",
      "Explosive handling underground",
      "Underground maintenance",
    ],
  },
  {
    label: "Processing Plant Operations",
    activities: [
      "Crushing operations",
      "Screening operations",
      "Conveyor operation",
      "Material transfer",
      "Grinding/milling",
      "Chemical processing",
      "Flotation process",
      "Sampling operations",
      "Tailings management",
      "Dust suppression",
    ],
  },
  {
    label: "Maintenance & Engineering",
    activities: [
      "Heavy equipment maintenance",
      "Conveyor maintenance",
      "Electrical maintenance",
      "Welding and cutting",
      "Hydraulic maintenance",
      "Tire changing",
      "Lifting operations",
      "Work at height",
      "Shutdown maintenance",
      "Lockout/tagout",
    ],
  },
  {
    label: "Health, Safety & Environment",
    activities: [
      "Silica dust exposure work",
      "Noise exposure areas",
      "Heat stress exposure",
      "Explosive storage",
      "Hazardous chemical storage",
      "Fuel handling",
      "Emergency response drill",
      "Slope stability monitoring",
      "Environmental spill response",
      "Remote/lone working",
    ],
  },
];

const foodProductionActivityGroups: ActivityGroup[] = [
  {
    label: "Food Processing Operations",
    activities: [
      "Food preparation",
      "Mixing operations",
      "Cutting and slicing",
      "Cooking operations",
      "Baking operations",
      "Packaging operations",
      "Bottling operations",
      "Labeling operations",
      "Ingredient handling",
      "Product inspection",
    ],
  },
  {
    label: "Machinery & Equipment",
    activities: [
      "Conveyor operation",
      "Machine cleaning",
      "Machine guarding inspection",
      "Mixer operation",
      "Filling machine operation",
      "Refrigeration system operation",
      "Boiler operation",
      "Steam system work",
      "Preventive maintenance",
      "Lockout/tagout",
    ],
  },
  {
    label: "Hygiene & Sanitation",
    activities: [
      "Cleaning and sanitation",
      "Chemical disinfection",
      "Waste handling",
      "Pest control coordination",
      "Spill cleanup",
      "Drain cleaning",
      "High-pressure washing",
      "Food contamination prevention",
      "Hand hygiene operations",
      "Laundry/uniform handling",
    ],
  },
  {
    label: "Storage & Logistics",
    activities: [
      "Cold storage work",
      "Forklift operation",
      "Manual pallet handling",
      "Loading/unloading",
      "Warehouse storage",
      "Raw material storage",
      "Finished product dispatch",
      "Battery charging",
      "Delivery vehicle loading",
      "Container unloading",
    ],
  },
  {
    label: "Quality & Laboratory",
    activities: [
      "Quality control testing",
      "Food sampling",
      "Laboratory testing",
      "Chemical reagent handling",
      "Allergen handling",
      "Temperature monitoring",
      "Glass and brittle plastic inspection",
      "Metal detector testing",
      "Calibration activities",
      "Documentation and traceability work",
    ],
  },
];

const hospitalityActivityGroups: ActivityGroup[] = [
  {
    label: "Kitchen & Food Preparation",
    activities: [
      "Food preparation",
      "Cooking operations",
      "Fryer operation",
      "Knife handling",
      "Food cutting and slicing",
      "Hot surface work",
      "Dishwasher operation",
      "Kitchen cleaning",
      "Waste disposal",
      "Cold storage access",
    ],
  },
  {
    label: "Restaurant & Service Operations",
    activities: [
      "Table service",
      "Tray carrying",
      "Beverage service",
      "Customer interaction",
      "Cash handling",
      "Buffet setup",
      "Event catering",
      "Bar operations",
      "Glass handling",
      "Spill cleanup in dining area",
    ],
  },
  {
    label: "Housekeeping & Cleaning",
    activities: [
      "Room cleaning",
      "Laundry operations",
      "Bathroom sanitation",
      "Chemical cleaning",
      "Bed making",
      "Waste collection",
      "Vacuum cleaning",
      "High-touch surface disinfection",
      "Linen transport",
      "Sharps handling during cleaning",
    ],
  },
  {
    label: "Maintenance & Facility Operations",
    activities: [
      "Minor maintenance",
      "Electrical equipment inspection",
      "HVAC maintenance",
      "Pool maintenance",
      "Pest control coordination",
      "Fire safety inspection",
      "Emergency evacuation drill",
      "Contractor work",
      "Work at height during maintenance",
      "Manual material handling",
    ],
  },
  {
    label: "Hotel & Guest Safety",
    activities: [
      "Reception operations",
      "Lone working night shift",
      "Security incident response",
      "Aggressive guest management",
      "Fire emergency response",
      "Slippery floor management",
      "Elevator use",
      "Parking area management",
      "Deliveries handling",
      "Public area cleaning",
    ],
  },
];

const retailActivityGroups: ActivityGroup[] = [
  {
    label: "Store Operations",
    activities: [
      "Shelf stocking",
      "Cashier operations",
      "Customer assistance",
      "Product display setup",
      "Price labeling",
      "Manual handling of goods",
      "Shopping cart collection",
      "Opening and closing procedures",
      "Queue management",
      "Promotional setup",
    ],
  },
  {
    label: "Storage & Backroom",
    activities: [
      "Warehouse storage",
      "Pallet handling",
      "Loading/unloading deliveries",
      "Stockroom organization",
      "Ladder use",
      "Waste handling",
      "Cardboard compactor use",
      "Forklift operation",
      "Battery charging",
      "Delivery inspection",
    ],
  },
  {
    label: "Cleaning & Maintenance",
    activities: [
      "Floor cleaning",
      "Spill response",
      "Public restroom cleaning",
      "Glass cleaning",
      "Escalator cleaning coordination",
      "Minor maintenance",
      "Lighting replacement",
      "Contractor supervision",
      "HVAC maintenance",
      "Waste segregation",
    ],
  },
  {
    label: "Security & Emergency",
    activities: [
      "Security patrol",
      "Theft prevention",
      "Aggressive customer management",
      "Emergency evacuation",
      "Fire drill",
      "Lone working",
      "Incident response",
      "Parking lot supervision",
      "Crowd control",
      "First aid response",
    ],
  },
  {
    label: "Commercial Facility Operations",
    activities: [
      "Shopping mall operations",
      "Food court cleaning",
      "Delivery dock operations",
      "Public area maintenance",
      "Elevator/escalator use",
      "Event setup",
      "Signage installation",
      "Temporary barricade setup",
      "External contractor work",
      "Night cleaning operations",
    ],
  },
];

const educationActivityGroups: ActivityGroup[] = [
  {
    label: "Classroom & Teaching Activities",
    activities: [
      "Classroom teaching",
      "Computer lab use",
      "Science laboratory teaching",
      "Workshop/practical teaching",
      "Audio-visual equipment use",
      "Classroom setup",
      "Student supervision",
      "Physical education instruction",
      "Art and craft activities",
      "Remote/online teaching",
    ],
  },
  {
    label: "Student & Public Areas",
    activities: [
      "Corridor supervision",
      "Stairway management",
      "Playground supervision",
      "Cafeteria operations",
      "School transport coordination",
      "Event management",
      "Visitor management",
      "Emergency evacuation drill",
      "Crowd supervision",
      "Cleaning coordination",
    ],
  },
  {
    label: "Laboratories & Workshops",
    activities: [
      "Chemical handling in laboratory",
      "Biological sample handling",
      "Laboratory equipment use",
      "Workshop machinery operation",
      "Welding training",
      "Electrical training exercises",
      "Tool handling",
      "Gas cylinder handling",
      "Hazardous waste disposal",
      "PPE management",
    ],
  },
  {
    label: "Maintenance & Facility Management",
    activities: [
      "School maintenance",
      "Electrical maintenance",
      "HVAC maintenance",
      "Cleaning operations",
      "Waste handling",
      "Groundskeeping",
      "Contractor supervision",
      "Work at height maintenance",
      "Fire safety inspection",
      "Manual handling",
    ],
  },
  {
    label: "Administrative & Support Operations",
    activities: [
      "Office work",
      "Display screen equipment use",
      "Filing and archive handling",
      "Printer/copier use",
      "Reception operations",
      "Lone working",
      "Security monitoring",
      "Stress/workload management",
      "First aid response",
      "Documentation handling",
    ],
  },
];

const energyUtilitiesActivityGroups: ActivityGroup[] = [
  {
    label: "Electrical Power Operations",
    activities: [
      "Substation inspection",
      "Transformer maintenance",
      "Switchgear operation",
      "Cable jointing",
      "Overhead line work",
      "Underground cable work",
      "Electrical isolation and lockout",
      "Energized equipment testing",
      "Arc flash risk work",
      "Emergency power restoration",
    ],
  },
  {
    label: "Water & Wastewater Utilities",
    activities: [
      "Pump station operation",
      "Water treatment operation",
      "Wastewater treatment operation",
      "Chlorine handling",
      "Confined space entry in utility chambers",
      "Sewer inspection",
      "Manhole entry",
      "Sludge handling",
      "Chemical dosing",
      "Water sampling",
    ],
  },
  {
    label: "Gas & District Energy",
    activities: [
      "Gas pipeline inspection",
      "Gas leak response",
      "Pressure regulator maintenance",
      "Hot tapping preparation",
      "Meter installation",
      "District heating maintenance",
      "Boiler room operation",
      "Steam line maintenance",
      "Pressure testing",
      "Emergency shutdown response",
    ],
  },
  {
    label: "Field Maintenance & Infrastructure",
    activities: [
      "Utility excavation",
      "Work near buried services",
      "Work near live traffic",
      "Work at height on poles/towers",
      "Mobile plant operation",
      "Vehicle-based field work",
      "Remote/lone working",
      "Night emergency repair",
      "Generator maintenance",
      "Contractor supervision",
    ],
  },
  {
    label: "Emergency & Environmental Response",
    activities: [
      "Storm damage response",
      "Flood response",
      "Fuel spill response",
      "Chemical spill response",
      "Fire response",
      "Public interface during repairs",
      "Temporary traffic management",
      "Emergency communication",
      "Critical infrastructure inspection",
      "Incident investigation",
    ],
  },
];

const agricultureActivityGroups: ActivityGroup[] = [
  {
    label: "Crop Production",
    activities: [
      "Field preparation",
      "Planting operations",
      "Irrigation work",
      "Fertilizer application",
      "Pesticide application",
      "Harvesting",
      "Crop loading",
      "Greenhouse work",
      "Manual crop picking",
      "Grain handling",
    ],
  },
  {
    label: "Machinery & Vehicle Operations",
    activities: [
      "Tractor operation",
      "Harvester operation",
      "Loader operation",
      "Trailer coupling",
      "PTO-driven equipment use",
      "Machinery maintenance",
      "Fueling agricultural equipment",
      "Working near moving machinery",
      "Vehicle movement on farm roads",
      "Equipment cleaning",
    ],
  },
  {
    label: "Livestock Operations",
    activities: [
      "Animal handling",
      "Milking operations",
      "Feeding livestock",
      "Veterinary treatment assistance",
      "Cleaning animal housing",
      "Manure handling",
      "Working with aggressive animals",
      "Livestock transport loading",
      "Biosecurity procedures",
      "Zoonotic disease exposure",
    ],
  },
  {
    label: "Storage & Facilities",
    activities: [
      "Silo work",
      "Grain storage",
      "Hay bale stacking",
      "Cold storage access",
      "Farm workshop work",
      "Chemical storage",
      "Fertilizer storage",
      "Barn maintenance",
      "Working at height on farm buildings",
      "Fire prevention in storage areas",
    ],
  },
  {
    label: "Outdoor & Environmental Conditions",
    activities: [
      "Heat stress outdoor work",
      "Cold weather field work",
      "Working near water/irrigation channels",
      "Remote/lone working",
      "Manual handling",
      "Slips/trips on uneven ground",
      "Noise exposure",
      "Dust exposure",
      "Emergency response on farm",
      "Seasonal worker onboarding",
    ],
  },
];

const portsMarineActivityGroups: ActivityGroup[] = [
  {
    label: "Cargo Handling",
    activities: [
      "Container loading and unloading",
      "Breakbulk cargo handling",
      "Bulk cargo handling",
      "Ro-ro vehicle loading",
      "Cargo securing",
      "Cargo lashing and unlashing",
      "Ship/shore cargo transfer",
      "Cargo inspection",
      "Palletized cargo movement",
      "Heavy lift cargo handling",
    ],
  },
  {
    label: "Vessel & Dock Operations",
    activities: [
      "Mooring operations",
      "Gangway access",
      "Work on quay edge",
      "Ship boarding",
      "Hatch cover operations",
      "Ballast operation coordination",
      "Bunkering support",
      "Vessel maintenance support",
      "Working over water",
      "Pilot/crew transfer support",
    ],
  },
  {
    label: "Mobile Equipment & Traffic",
    activities: [
      "Reach stacker operation",
      "Terminal tractor operation",
      "Forklift operation",
      "Crane operation",
      "Straddle carrier operation",
      "Yard traffic management",
      "Reversing vehicle operations",
      "Pedestrian control in terminal",
      "Trailer coupling",
      "Equipment refueling",
    ],
  },
  {
    label: "Warehousing & Yard Operations",
    activities: [
      "Container yard stacking",
      "Warehouse storage",
      "Dangerous goods storage",
      "Reefer container connection",
      "Container inspection",
      "Yard housekeeping",
      "Waste handling",
      "Spill response",
      "Night shift terminal work",
      "Extreme weather port operations",
    ],
  },
  {
    label: "Emergency & Marine Safety",
    activities: [
      "Man overboard response",
      "Fire emergency response",
      "Oil spill response",
      "Dangerous goods incident response",
      "Evacuation drill",
      "Rescue equipment inspection",
      "Confined space entry on vessel",
      "Hot work on vessel/port area",
      "Security incident response",
      "Emergency communication",
    ],
  },
];

const chemicalIndustryActivityGroups: ActivityGroup[] = [
  {
    label: "Process Operations",
    activities: [
      "Chemical reactor operation",
      "Mixing and blending",
      "Distillation operation",
      "Filtration operation",
      "Pump operation",
      "Valve operation",
      "Process sampling",
      "Batch charging",
      "Process monitoring",
      "Emergency shutdown operation",
    ],
  },
  {
    label: "Chemical Handling & Storage",
    activities: [
      "Raw chemical receiving",
      "Chemical transfer",
      "Drum handling",
      "IBC handling",
      "Flammable liquid storage",
      "Corrosive chemical handling",
      "Toxic chemical handling",
      "Gas cylinder handling",
      "Chemical labeling",
      "Incompatible chemical segregation",
    ],
  },
  {
    label: "Maintenance & Engineering",
    activities: [
      "Mechanical maintenance",
      "Electrical maintenance",
      "Instrument calibration",
      "Pump maintenance",
      "Pipework maintenance",
      "Confined space entry",
      "Hot work permit task",
      "Line breaking",
      "Isolation/LOTO",
      "Contractor maintenance",
    ],
  },
  {
    label: "Laboratory & Quality Control",
    activities: [
      "Laboratory sampling",
      "Chemical reagent handling",
      "Fume hood work",
      "Glassware handling",
      "Waste sample disposal",
      "Chemical analysis",
      "Spill cleanup in laboratory",
      "Laboratory equipment maintenance",
      "PPE management",
      "Emergency shower/eyewash inspection",
    ],
  },
  {
    label: "Emergency, Waste & Environment",
    activities: [
      "Chemical spill response",
      "Fire emergency response",
      "Gas leak response",
      "Hazardous waste storage",
      "Wastewater treatment",
      "Emission control inspection",
      "Emergency drill",
      "Decontamination procedure",
      "Chemical exposure first aid",
      "Incident investigation",
    ],
  },
];

const activityGroupsBySector: Record<string, ActivityGroup[]> = {
  Construction: constructionActivityGroups,
  "Warehouse & Logistics": warehouseActivityGroups,
  Manufacturing: manufacturingActivityGroups,
  "Office & Administrative": officeActivityGroups,
  "Healthcare & Medical Facilities": healthcareActivityGroups,
  "Oil & Gas": oilGasActivityGroups,
  "Mining & Quarrying": miningActivityGroups,
  "Food Production & Processing": foodProductionActivityGroups,
  "Hospitality & HORECA": hospitalityActivityGroups,
  "Retail & Commercial Facilities": retailActivityGroups,
  "Education & Training Facilities": educationActivityGroups,
  "Energy & Utilities": energyUtilitiesActivityGroups,
  "Agriculture & Farming": agricultureActivityGroups,
  "Ports & Marine Operations": portsMarineActivityGroups,
  "Chemical Industry": chemicalIndustryActivityGroups,
};

const sectorOptions = Object.keys(activityGroupsBySector);
const activitiesBySector: Record<string, string[]> = Object.fromEntries(
  Object.entries(activityGroupsBySector).map(([sector, groups]) => [
    sector,
    groups.flatMap((group) => group.activities),
  ]),
);
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

const libraryHazardTemplate = (
  workplaceActivity: string,
  hazardDescription: string,
  whoMayBeHarmed: string,
  possibleConsequence: string,
  existingMeasures: string,
  initialProbability: RiskValue,
  initialSeverity: RiskValue,
  additionalMeasures: string,
  controlHierarchy: ControlHierarchy[],
  residualProbability: RiskValue,
  residualSeverity: RiskValue,
): Partial<HazardRow> => ({
  workplaceActivity,
  hazardDescription,
  whoMayBeHarmed,
  possibleConsequence,
  existingMeasures,
  initialProbability,
  initialSeverity,
  additionalMeasures,
  controlHierarchy,
  residualProbability,
  residualSeverity,
});

const libraryControls = {
  eliminationEngAdminPpe: [
    "Elimination",
    "Engineering Controls",
    "Administrative Controls",
    "PPE",
  ],
  substitutionEngAdminPpe: [
    "Substitution",
    "Engineering Controls",
    "Administrative Controls",
    "PPE",
  ],
  engAdminPpe: ["Engineering Controls", "Administrative Controls", "PPE"],
  engAdmin: ["Engineering Controls", "Administrative Controls"],
  adminPpe: ["Administrative Controls", "PPE"],
  admin: ["Administrative Controls"],
} satisfies Record<string, ControlHierarchy[]>;

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

const additionalConstructionActivityHazardSets: Record<
  string,
  { title: string; hazards: Array<Partial<HazardRow>> }
> = {
  "Welfare facility setup": {
    title: "Construction - Welfare Facility Setup Risk Assessment",
    hazards: [
      libraryHazardTemplate(
        "Delivery and positioning of welfare cabins",
        "Cabins or welfare units moving, swinging, or settling during delivery and placement",
        "Delivery drivers, installers, workers nearby",
        "Crushing injury, struck-by injury, property damage",
        "Delivery area identified; competent plant operators used; workers instructed to stand clear",
        3,
        4,
        "Use a planned lifting or unloading method; verify ground bearing capacity; establish exclusion zone; level and secure welfare units before occupation",
        libraryControls.engAdminPpe,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Connection of welfare utilities",
        "Electric, water, drainage, or gas connections installed incorrectly or damaged during setup",
        "Workers, electricians, plumbers, welfare users",
        "Electric shock, flooding, fire, hygiene issues",
        "Utility connections assigned to competent workers; supervisors coordinate setup sequence",
        3,
        4,
        "Inspect and test all utility connections before use; protect cables and hoses; isolate defective services; label emergency shutoffs clearly",
        libraryControls.engAdminPpe,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Access to welfare facilities",
        "Slips, trips, or falls on temporary steps, ramps, wet surfaces, or poorly lit routes",
        "Workers, visitors, cleaners",
        "Sprains, fractures, falls, lost time injury",
        "Temporary access provided; housekeeping checks completed; lighting available in main routes",
        4,
        3,
        "Install stable steps or ramps with handrails; keep routes clean and drained; provide lighting; grit or clean access in adverse weather",
        libraryControls.engAdmin,
        2,
        3,
      ),
      libraryHazardTemplate(
        "Welfare hygiene and sanitation",
        "Poor sanitation, water supply failure, or inadequate cleaning causing illness or contamination",
        "Workers, visitors, cleaners",
        "Illness, infection, poor welfare conditions",
        "Welfare cleaning arranged; toilets and washing facilities provided; drinking water available",
        3,
        3,
        "Define cleaning frequency; inspect welfare daily; maintain soap, water, and waste disposal; repair blocked drains or water issues promptly",
        libraryControls.admin,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Fire safety in welfare areas",
        "Combustible storage, heaters, chargers, or cooking equipment creating fire risk in welfare cabins",
        "Workers, visitors, emergency responders",
        "Burns, smoke inhalation, fire spread, property damage",
        "Fire extinguishers available; smoking controlled; workers briefed on emergency arrangements",
        3,
        5,
        "Keep exits clear; inspect heaters and electrical equipment; prohibit unauthorized cooking equipment; provide fire detection and evacuation signage",
        libraryControls.engAdminPpe,
        1,
        4,
      ),
    ],
  },
  "Temporary lighting installation": {
    title: "Construction - Temporary Lighting Installation Risk Assessment",
    hazards: [
      libraryHazardTemplate(
        "Installation of temporary lighting towers and fittings",
        "Falls, dropped fittings, or unstable lighting equipment during installation at height or on uneven ground",
        "Electricians, installers, workers nearby",
        "Falls, struck-by injury, fractures",
        "Installers trained; access equipment available; lighting equipment visually checked",
        3,
        4,
        "Use stable access platforms; secure lighting stands against movement; establish exclusion zone below elevated work; inspect fixings before energizing",
        libraryControls.engAdminPpe,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Electrical connection of temporary lighting",
        "Electric shock from damaged cables, wet connections, incorrect wiring, or poor protection",
        "Electricians, workers, visitors",
        "Electric shock, burns, fire, fatality",
        "Competent electricians connect lighting; basic visual inspections completed; RCD/GFCI protection used where available",
        3,
        5,
        "Use weather-rated fittings and protected circuits; keep connections dry; test before use; isolate and tag defective lighting immediately",
        libraryControls.engAdminPpe,
        1,
        5,
      ),
      libraryHazardTemplate(
        "Lighting cable routes across site",
        "Trips or cable damage from trailing temporary lighting cables across walkways and vehicle routes",
        "Workers, visitors, plant operators",
        "Trips, falls, electric shock, cable failure",
        "Cables routed away from main access where possible; damaged cables reported",
        4,
        3,
        "Route cables overhead or through cable ramps; protect from vehicles; remove unused cable loops; inspect cable routes daily",
        libraryControls.engAdmin,
        2,
        3,
      ),
      libraryHazardTemplate(
        "Poor illumination or glare from temporary lighting",
        "Inadequate lighting or glare causing trips, poor task visibility, or traffic conflict",
        "Workers, drivers, visitors, security staff",
        "Falls, collisions, poor-quality work, injury",
        "Lighting installed in main work areas; supervisors review obvious dark spots",
        3,
        4,
        "Assess lighting levels for tasks and access routes; adjust angle to reduce glare; provide backup lighting for critical routes; inspect before night work",
        libraryControls.engAdmin,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Maintenance and relocation of temporary lighting",
        "Unexpected energization, dropped lights, or manual handling injury during relocation or maintenance",
        "Electricians, laborers, maintenance workers",
        "Electric shock, strains, struck-by injury",
        "Maintenance coordinated by supervisor; workers instructed not to move live equipment",
        3,
        4,
        "Isolate power before relocation; use team lifts for towers; inspect stands and lamps after movement; update lighting layout after relocation",
        libraryControls.adminPpe,
        1,
        3,
      ),
    ],
  },
  "Signage and barricade installation": {
    title: "Construction - Signage and Barricade Installation Risk Assessment",
    hazards: [
      libraryHazardTemplate(
        "Installing barricades around active work zones",
        "Installers exposed to moving plant, vehicles, or work activities while placing barriers",
        "Workers, traffic marshals, installers, drivers",
        "Struck-by injury, crushing injury, fractures",
        "High-visibility clothing required; supervisors identify barrier locations; workers briefed on traffic routes",
        3,
        5,
        "Install barricades before high-risk work starts; use spotters near traffic; work from protected positions; coordinate installation with plant shutdown where needed",
        libraryControls.engAdminPpe,
        1,
        4,
      ),
      libraryHazardTemplate(
        "Handling barriers, cones, signs, and bases",
        "Manual handling injuries from carrying heavy barrier bases, signs, or awkward fencing components",
        "Installers, laborers, traffic marshals",
        "Back strain, hand injury, foot injury",
        "Team lifting used for heavy items; gloves and safety footwear worn",
        4,
        3,
        "Use trolleys or mechanical aids for heavy bases; limit carrying distance; stack signs safely; rotate tasks during large setup works",
        libraryControls.engAdminPpe,
        2,
        3,
      ),
      libraryHazardTemplate(
        "Incorrect or unclear safety signage",
        "Workers or visitors entering hazards due to missing, wrong, or poorly positioned signs",
        "Workers, visitors, subcontractors, public",
        "Exposure to excavation, plant, electrical, or falling-object hazards",
        "Standard signs available; supervisors review key access points",
        3,
        4,
        "Use clear task-specific signs; position signs at decision points; remove outdated signs; include signage checks in daily inspections",
        libraryControls.admin,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Barricade stability and visibility",
        "Barricades or signs displaced by wind, impact, poor ground, or low visibility",
        "Workers, drivers, visitors, public",
        "Wrong-route access, collision, struck-by injury",
        "Barriers placed in designated areas; reflective materials used where available",
        3,
        4,
        "Use weighted bases and reflective panels; inspect after wind or vehicle movement; provide lighting for night visibility; repair damaged barriers promptly",
        libraryControls.engAdmin,
        1,
        3,
      ),
      libraryHazardTemplate(
        "Barricade removal or route changes",
        "Controls removed too early or routes changed without communication",
        "Workers, visitors, drivers, supervisors",
        "Unauthorized access, collision, falls, serious injury",
        "Supervisors approve major route changes; workers briefed during toolbox talks",
        3,
        4,
        "Remove barriers only after hazard is eliminated or controlled; update route signs immediately; communicate changes during shift briefings; block obsolete routes",
        libraryControls.admin,
        1,
        3,
      ),
    ],
  },
  "Scaffolding inspection": {
    title: "Construction - Scaffolding Inspection Risk Assessment",
    hazards: [
      libraryHazardTemplate(
        "Accessing scaffold for inspection",
        "Falls while climbing scaffold access, inspecting platforms, or checking edge protection",
        "Scaffold inspectors, supervisors, scaffold users",
        "Fall injury, fractures, fatality",
        "Inspectors competent; scaffold access provided; fall protection available where required",
        3,
        5,
        "Use safe access routes only; do not climb frames or guardrails; stop inspection if scaffold is unstable; use fall protection where access is incomplete",
        libraryControls.engAdminPpe,
        1,
        5,
      ),
      libraryHazardTemplate(
        "Inspection of incomplete or damaged scaffold",
        "Collapse, movement, or missing components exposing inspector to unstable scaffold conditions",
        "Scaffold inspectors, scaffolders, nearby workers",
        "Collapse injury, struck-by injury, fatality",
        "Scaffold tags used; damaged scaffold reported; access restricted to authorized persons",
        3,
        5,
        "Prevent use of unsafe scaffold; install physical barriers; inspect ties, braces, boards, guardrails, and foundations before permitting access; record defects clearly",
        libraryControls.engAdmin,
        1,
        5,
      ),
      libraryHazardTemplate(
        "Objects falling during scaffold inspection",
        "Loose boards, couplers, debris, or tools falling from scaffold levels during inspection",
        "Inspectors, workers below, visitors",
        "Head injury, cuts, fractures",
        "Hard hats required; tools carried by inspector; scaffold housekeeping checked",
        3,
        4,
        "Create exclusion zone below inspection where loose items exist; use tool lanyards; remove debris; stop work below until defects are controlled",
        libraryControls.engAdminPpe,
        1,
        4,
      ),
      libraryHazardTemplate(
        "Scaffold inspection near overhead services or public areas",
        "Inspector exposure to overhead electrical lines, traffic, or public interface while inspecting perimeter scaffold",
        "Inspectors, public, nearby workers",
        "Electric shock, struck-by injury, fatality",
        "Known overhead services identified; public interfaces controlled by barriers",
        2,
        5,
        "Maintain electrical exclusion distances; use spotter near roads; isolate or shield public interface; stop inspection in unsafe wind or weather",
        libraryControls.eliminationEngAdminPpe,
        1,
        5,
      ),
      libraryHazardTemplate(
        "Scaffold inspection documentation and handover",
        "Missed defects or unclear handover leading to unsafe scaffold use after inspection",
        "Scaffold users, contractors, supervisors",
        "Falls, collapse, serious injury",
        "Inspection register used; scaffold status tag updated after inspection",
        3,
        5,
        "Use checklist-based inspection; record load class and restrictions; communicate defects to scaffold users; keep scaffold out of service until critical defects are closed",
        libraryControls.admin,
        1,
        5,
      ),
    ],
  },
};

type CompactConstructionActivityProfile = {
  title: string;
  people: string;
  planningHazard: string;
  equipmentHazard: string;
  accessHazard: string;
  exposureHazard: string;
  emergencyHazard: string;
  specificControls: string;
  consequence: string;
};

const createCompactConstructionHazards = (
  activity: string,
  profile: CompactConstructionActivityProfile,
): HazardRow[] =>
  createLibraryHazards([
    libraryHazardTemplate(
      `${activity} planning and exclusion controls`,
      profile.planningHazard,
      profile.people,
      profile.consequence,
      "Task planned by supervisor; work area identified; workers briefed on main hazards and required controls",
      3,
      5,
      `${profile.specificControls}; confirm permits, exclusion zones, competent supervision, and stop-work criteria before the activity starts`,
      libraryControls.engAdminPpe,
      1,
      4,
    ),
    libraryHazardTemplate(
      `${activity} equipment, tools, and materials`,
      profile.equipmentHazard,
      profile.people,
      "Crush injury, cuts, burns, equipment damage, serious injury",
      "Tools and equipment visually checked; trained workers assigned; PPE available for the task",
      3,
      4,
      `${profile.specificControls}; inspect equipment before use, remove defective items, and keep workers clear of pinch, strike, and release zones`,
      libraryControls.engAdminPpe,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} access and work area interface`,
      profile.accessHazard,
      "Workers, subcontractors, visitors, adjacent work crews",
      "Falls, struck-by injury, collision, fractures, lost time injury",
      "Access route identified; housekeeping maintained; work area communicated to affected trades",
      3,
      4,
      `${profile.specificControls}; segregate pedestrians and plant, maintain safe access, install barriers or signs, and coordinate simultaneous work`,
      libraryControls.engAdmin,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} exposure and environmental conditions`,
      profile.exposureHazard,
      profile.people,
      "Respiratory irritation, burns, fatigue, environmental harm, reduced visibility",
      "Workers briefed on exposure hazards; basic PPE and welfare arrangements available",
      3,
      4,
      `${profile.specificControls}; monitor exposure conditions, improve ventilation or suppression, provide suitable PPE, and pause work if conditions become unsafe`,
      libraryControls.substitutionEngAdminPpe,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} inspection, emergency, and handover controls`,
      profile.emergencyHazard,
      "Workers, supervisors, emergency responders, client personnel",
      "Delayed rescue, uncontrolled hazard, serious injury, fatality",
      "Emergency contacts known; supervisors monitor work progress; basic first aid arrangements available",
      2,
      5,
      `${profile.specificControls}; verify emergency arrangements, inspect completed work, record restrictions, and communicate residual hazards before handover`,
      libraryControls.adminPpe,
      1,
      4,
    ),
  ]);

const compactAdditionalConstructionActivityProfiles: Record<
  string,
  CompactConstructionActivityProfile
> = {
  "MEWP operation": {
    title: "Construction - MEWP Operation Risk Assessment",
    people: "MEWP operators, occupants, ground workers, pedestrians",
    planningHazard:
      "MEWP overturn, entrapment, or unsafe positioning caused by poor ground conditions, overhead obstructions, or inadequate task planning",
    equipmentHazard:
      "Mechanical failure, damaged guardrails, emergency lowering failure, or incorrect use of controls",
    accessHazard:
      "People or plant entering the MEWP operating radius, creating collision, crushing, or falling-object exposure",
    exposureHazard:
      "Wind, rain, poor visibility, or uneven surfaces affecting platform stability and operator control",
    emergencyHazard:
      "Delayed rescue after entrapment, breakdown, fall restraint activation, or platform malfunction",
    specificControls:
      "use trained operators, pre-use inspection, ground assessment, harness or restraint where required, and rescue plan",
    consequence: "Fall from height, crushing injury, overturn, serious injury, fatality",
  },
  "Edge protection installation": {
    title: "Construction - Edge Protection Installation Risk Assessment",
    people: "Installers, workers at height, workers below, supervisors",
    planningHazard:
      "Workers exposed to open edges while installing guardrails, barriers, or covers before collective protection is complete",
    equipmentHazard:
      "Dropped guardrail components, posts, fixings, or tools during installation and adjustment",
    accessHazard:
      "Incomplete edge protection allowing unauthorized access to exposed slab edges, roofs, or openings",
    exposureHazard:
      "Wind, poor lighting, slippery surfaces, or awkward fixing positions affecting safe installation",
    emergencyHazard:
      "Delayed response if a worker falls, drops materials, or discovers unsecured edge protection",
    specificControls:
      "install from a protected position where possible, use temporary fall protection, set exclusion zones below, and inspect before handover",
    consequence: "Fall from height, struck-by injury, fractures, fatality",
  },
  "Fall arrest system use": {
    title: "Construction - Fall Arrest System Use Risk Assessment",
    people: "Workers using harnesses, supervisors, rescue personnel",
    planningHazard:
      "Incorrect fall arrest selection, anchor point, lanyard length, or clearance creating ineffective protection",
    equipmentHazard:
      "Damaged harnesses, lanyards, connectors, inertia reels, or anchor devices used without proper inspection",
    accessHazard:
      "Workers relying on fall arrest while moving across unprotected edges, roofs, or incomplete structures",
    exposureHazard:
      "Weather, sharp edges, pendulum fall risk, or poor visibility reducing fall arrest effectiveness",
    emergencyHazard:
      "Suspension trauma or delayed rescue after fall arrest activation",
    specificControls:
      "verify anchor capacity, inspect equipment, control fall clearance and pendulum risk, train users, and prepare rescue equipment",
    consequence: "Fall from height, suspension trauma, serious injury, fatality",
  },
  "Facade work": {
    title: "Construction - Facade Work Risk Assessment",
    people: "Facade installers, scaffold or MEWP users, workers below, public",
    planningHazard:
      "Falls, dropped facade panels, or unstable work fronts caused by poor sequencing and incomplete access controls",
    equipmentHazard:
      "Panel lifting devices, suction lifters, fixings, or hand tools failing during facade installation",
    accessHazard:
      "Workers exposed to open edges, scaffold gaps, MEWP movements, or public interfaces during facade work",
    exposureHazard:
      "Wind loading on panels, rain, glare, or dust affecting handling and installation quality",
    emergencyHazard:
      "Delayed rescue or uncontrolled panel release during facade installation at height",
    specificControls:
      "use engineered lifting methods, weather limits, exclusion zones below, approved access platforms, and inspected fixings",
    consequence: "Fall from height, struck-by injury, panel collapse, fatality",
  },
  "Window installation": {
    title: "Construction - Window Installation Risk Assessment",
    people: "Installers, glaziers, workers below, visitors",
    planningHazard:
      "Window units or glass panels dropped or released during lifting, positioning, and fixing",
    equipmentHazard:
      "Suction lifters, glazing tools, fixings, or sealant equipment failing or being used incorrectly",
    accessHazard:
      "Installers working near openings, facade edges, or incomplete platforms while handling fragile panels",
    exposureHazard:
      "Glass breakage, sharp edges, wind gusts, or manual handling strain during installation",
    emergencyHazard:
      "Delayed response to glass breakage, dropped panel, fall risk, or severe cut injury",
    specificControls:
      "use glass handling aids, cut-resistant PPE, edge protection, exclusion zones, and controlled lifting or passing methods",
    consequence: "Cuts, fall from height, struck-by injury, serious injury",
  },
  "Painting at height": {
    title: "Construction - Painting at Height Risk Assessment",
    people: "Painters, scaffold users, MEWP operators, workers below",
    planningHazard:
      "Falls while painting from ladders, scaffolds, MEWPs, roofs, or exposed edges",
    equipmentHazard:
      "Paint containers, rollers, spray equipment, or tools dropped from height or used from unstable positions",
    accessHazard:
      "Workers overreaching, moving between platforms, or working above active areas without segregation",
    exposureHazard:
      "Solvent vapors, overspray, skin contact, poor ventilation, or weather affecting safe painting",
    emergencyHazard:
      "Delayed response to fall, chemical exposure, overspray incident, or fire involving flammable paints",
    specificControls:
      "use suitable access equipment, secure tools and materials, ventilate work areas, control ignition sources, and maintain exclusion zones below",
    consequence: "Fall from height, chemical exposure, fire, serious injury",
  },
  "Cladding installation": {
    title: "Construction - Cladding Installation Risk Assessment",
    people: "Cladding installers, riggers, workers below, public",
    planningHazard:
      "Large cladding sheets or panels becoming unstable during lifting, alignment, and fixing",
    equipmentHazard:
      "Fixing tools, lifting accessories, suction devices, or fasteners failing during installation",
    accessHazard:
      "Installers working near edges, facade openings, scaffolds, or MEWPs with incomplete protection",
    exposureHazard:
      "Wind catching cladding panels, sharp sheet edges, noise, dust, or weather affecting control",
    emergencyHazard:
      "Delayed rescue or uncontrolled panel release during high-level cladding work",
    specificControls:
      "set wind limits, use engineered lifting aids, wear cut-resistant PPE, maintain exclusion zones, and inspect fixings progressively",
    consequence: "Fall from height, cuts, struck-by injury, panel collapse, fatality",
  },
  "Mobile crane setup": {
    title: "Construction - Mobile Crane Setup Risk Assessment",
    people: "Crane operators, riggers, lift supervisors, ground workers",
    planningHazard:
      "Crane setup on unsuitable ground, near excavations, or without correct lift planning",
    equipmentHazard:
      "Outrigger, mat, hook block, safety device, or crane component failure during setup",
    accessHazard:
      "Workers entering crane setup area or being struck during outrigger deployment and counterweight installation",
    exposureHazard:
      "Wind, poor visibility, soft ground, or nearby overhead services affecting crane setup safety",
    emergencyHazard:
      "Delayed response to crane instability, power line contact, dropped counterweight, or mechanical failure",
    specificControls:
      "verify ground bearing, use outrigger mats, check crane certificates, control setup exclusion zones, and appoint lift supervisor",
    consequence: "Crane overturn, crushing injury, electric shock, fatality",
  },
  "Tower crane operation": {
    title: "Construction - Tower Crane Operation Risk Assessment",
    people: "Tower crane operators, riggers, signalers, workers below, public",
    planningHazard:
      "Uncontrolled lifting, load collision, or overloading due to poor planning and communication",
    equipmentHazard:
      "Hoist, trolley, limit switch, hook, radio, or lifting accessory failure during tower crane operation",
    accessHazard:
      "Loads passing over people, public areas, incomplete structures, or congested work zones",
    exposureHazard:
      "Wind, lightning, poor visibility, or radio interference affecting load control",
    emergencyHazard:
      "Delayed response to dropped load, power failure, rescue from crane cab, or communication loss",
    specificControls:
      "use lift plans, anti-collision controls, competent signalers, weather limits, exclusion zones, and clear radio protocol",
    consequence: "Dropped load, collision, structural damage, fatality",
  },
  "Rigging and slinging": {
    title: "Construction - Rigging and Slinging Risk Assessment",
    people: "Riggers, slingers, crane operators, workers nearby",
    planningHazard:
      "Load instability or dropped load caused by incorrect sling selection, angles, attachment points, or center of gravity",
    equipmentHazard:
      "Damaged slings, shackles, hooks, lifting beams, or edge protection used during lifting",
    accessHazard:
      "Riggers working close to suspended loads, pinch points, and active crane or plant movements",
    exposureHazard:
      "Sharp edges, wind, poor visibility, awkward load shape, or contaminated lifting gear affecting rigging safety",
    emergencyHazard:
      "Delayed response to dropped load, trapped worker, failed lifting accessory, or uncontrolled swing",
    specificControls:
      "use competent riggers, inspect lifting gear, confirm load weight and center of gravity, test lift, and keep people out from under suspended loads",
    consequence: "Crushing injury, struck-by injury, dropped load, fatality",
  },
  "Telehandler operation": {
    title: "Construction - Telehandler Operation Risk Assessment",
    people: "Telehandler operators, pedestrians, banksmen, delivery drivers",
    planningHazard:
      "Telehandler overturn, collision, or load instability caused by poor route planning and unsuitable ground",
    equipmentHazard:
      "Forks, attachments, load charts, brakes, steering, or visibility aids damaged or used incorrectly",
    accessHazard:
      "Pedestrians entering telehandler operating areas or blind spots during lifting and travel",
    exposureHazard:
      "Uneven ground, slopes, mud, poor visibility, and weather affecting stability and braking",
    emergencyHazard:
      "Delayed response to overturn, collision, dropped load, or mechanical failure",
    specificControls:
      "use trained operators, pre-use checks, correct attachments, seatbelts, load charts, traffic routes, and banksmen where visibility is restricted",
    consequence: "Overturn, struck-by injury, crushing injury, fatality",
  },
  "Excavator operation": {
    title: "Construction - Excavator Operation Risk Assessment",
    people: "Excavator operators, ground workers, banksmen, nearby trades",
    planningHazard:
      "Excavator striking workers, structures, services, or excavation edges due to poor work planning",
    equipmentHazard:
      "Bucket, quick hitch, hydraulic system, or swing radius hazards causing dropped attachments or impact",
    accessHazard:
      "Ground workers entering swing radius or working too close to excavation plant",
    exposureHazard:
      "Soft ground, slopes, dust, noise, vibration, or poor visibility affecting safe operation",
    emergencyHazard:
      "Delayed response to service strike, overturn, dropped bucket, or worker struck by excavator",
    specificControls:
      "inspect quick hitch and attachments, maintain exclusion zones, use banksmen, verify services, and operate within ground and slope limits",
    consequence: "Crushing injury, service strike, overturn, fatality",
  },
  "Loader operation": {
    title: "Construction - Loader Operation Risk Assessment",
    people: "Loader operators, pedestrians, ground workers, drivers",
    planningHazard:
      "Loader collision, rollover, or struck-by event during material loading and stockpile operations",
    equipmentHazard:
      "Bucket, brakes, steering, reversing alarm, or visibility aids failing during operation",
    accessHazard:
      "Pedestrians or vehicles entering loader routes, loading zones, or blind spots",
    exposureHazard:
      "Dust, uneven ground, stockpile instability, noise, and restricted visibility affecting loader control",
    emergencyHazard:
      "Delayed response to collision, rollover, material collapse, or mechanical failure",
    specificControls:
      "use traffic segregation, seatbelts, pre-use checks, stockpile controls, speed limits, and reversing aids",
    consequence: "Collision, rollover, crushing injury, fatality",
  },
  "Dumper operation": {
    title: "Construction - Dumper Operation Risk Assessment",
    people: "Dumper operators, ground workers, banksmen, pedestrians",
    planningHazard:
      "Dumper overturn, collision, or unsafe tipping caused by poor route selection and unstable ground",
    equipmentHazard:
      "Brakes, steering, skip, seatbelt, or visibility aids damaged or not used correctly",
    accessHazard:
      "Workers or pedestrians entering dumper routes, tipping zones, or reversing areas",
    exposureHazard:
      "Mud, gradients, uneven ground, dust, weather, and poor visibility affecting dumper stability",
    emergencyHazard:
      "Delayed response to overturn, collision, trapped operator, or unsafe tipping incident",
    specificControls:
      "use trained operators, seatbelts, designated routes, tipping exclusion zones, ground inspections, and banksmen where required",
    consequence: "Overturn, crushing injury, collision, fatality",
  },
  "Plant refueling": {
    title: "Construction - Plant Refueling Risk Assessment",
    people: "Plant operators, fuel handlers, maintenance workers, nearby trades",
    planningHazard:
      "Fire, spill, or unauthorized refueling caused by poor refueling area controls",
    equipmentHazard:
      "Damaged fuel hoses, nozzles, tanks, pumps, or containers causing leaks or ignition",
    accessHazard:
      "Vehicles, pedestrians, and ignition sources entering refueling area during fuel transfer",
    exposureHazard:
      "Fuel vapor, skin contact, contaminated ground, poor ventilation, or adverse weather affecting refueling safety",
    emergencyHazard:
      "Delayed response to fuel spill, fire, overfill, or environmental release",
    specificControls:
      "use designated refueling areas, spill kits, no-smoking controls, bonding where needed, fire extinguishers, and trained fuel handlers",
    consequence: "Fire, burns, explosion, environmental contamination",
  },
  "Plant maintenance on site": {
    title: "Construction - Plant Maintenance On Site Risk Assessment",
    people: "Mechanics, plant operators, maintenance workers, nearby trades",
    planningHazard:
      "Unexpected movement, stored energy, or uncontrolled maintenance on plant in active site areas",
    equipmentHazard:
      "Hydraulic pressure, hot parts, rotating components, raised attachments, or defective tools causing injury",
    accessHazard:
      "Maintenance workers exposed to traffic, plant movement, or poor access around parked equipment",
    exposureHazard:
      "Oil, grease, fumes, noise, manual handling, and weather affecting maintenance safety",
    emergencyHazard:
      "Delayed response to crush injury, hydraulic injection, fire, or spill during maintenance",
    specificControls:
      "isolate and lock out plant, lower attachments, chock wheels, use stands, control traffic, and provide spill/fire response equipment",
    consequence: "Crushing injury, burns, injection injury, fire, serious injury",
  },
  "Temporary electrical testing": {
    title: "Construction - Temporary Electrical Testing Risk Assessment",
    people: "Electricians, commissioning workers, supervisors, nearby trades",
    planningHazard:
      "Exposure to live temporary circuits during testing without adequate isolation, barriers, or authorization",
    equipmentHazard:
      "Faulty meters, damaged probes, incorrect test equipment, or overloaded temporary circuits",
    accessHazard:
      "Unauthorized workers entering test area or interacting with energized temporary electrical equipment",
    exposureHazard:
      "Wet conditions, poor lighting, cramped panels, or damaged insulation increasing electric shock risk",
    emergencyHazard:
      "Delayed response to electric shock, arc flash, fire, or failed test condition",
    specificControls:
      "use competent electricians, test-before-touch, calibrated meters, insulated probes, barriers, permits, and lockout/tagout",
    consequence: "Electric shock, arc flash burns, fire, fatality",
  },
  "Cable pulling": {
    title: "Construction - Cable Pulling Risk Assessment",
    people: "Electricians, cable pullers, helpers, nearby workers",
    planningHazard:
      "Cable pulling strain, snapback, or uncontrolled movement due to poor route planning and communication",
    equipmentHazard:
      "Winches, rollers, ropes, pulling socks, or cable drums failing or being used incorrectly",
    accessHazard:
      "Workers pulling cables through congested routes, risers, trenches, ceilings, or public access zones",
    exposureHazard:
      "Manual handling, awkward posture, sharp trays, dust, and poor ventilation during cable installation",
    emergencyHazard:
      "Delayed response to trapped hands, cable snapback, fall, or electrical interface incident",
    specificControls:
      "plan pull route, use cable rollers, control tension, communicate commands, secure drums, and rotate manual tasks",
    consequence: "Strains, crush injury, falls, lacerations, serious injury",
  },
  "HVAC installation": {
    title: "Construction - HVAC Installation Risk Assessment",
    people: "HVAC installers, duct workers, electricians, workers below",
    planningHazard:
      "Uncontrolled lifting, positioning, or installation of HVAC units, ducts, and supports",
    equipmentHazard:
      "Sharp duct edges, lifting accessories, drills, grinders, or suspended equipment causing injury",
    accessHazard:
      "Work above ceiling voids, ladders, MEWPs, or congested plant rooms creating fall and interface hazards",
    exposureHazard:
      "Dust, insulation fibers, noise, awkward posture, and poor ventilation during HVAC installation",
    emergencyHazard:
      "Delayed response to dropped duct, fall, electrical interface, or trapped worker in ceiling void",
    specificControls:
      "use mechanical lifting aids, edge protection on sharp ducts, approved access platforms, exclusion zones below, and coordinated MEP sequencing",
    consequence: "Falls, cuts, dropped materials, strains, serious injury",
  },
  "Plumbing installation": {
    title: "Construction - Plumbing Installation Risk Assessment",
    people: "Plumbers, helpers, other trades, building users",
    planningHazard:
      "Leaks, pressure release, or service clashes caused by poor isolation and installation planning",
    equipmentHazard:
      "Pipe cutters, threading tools, soldering equipment, pressure testing tools, or heavy pipe sections causing injury",
    accessHazard:
      "Work in risers, ceiling voids, trenches, or plant rooms with poor access and multiple trades",
    exposureHazard:
      "Hot work fumes, flux, contaminated water, sharp pipe edges, and manual handling exposure",
    emergencyHazard:
      "Delayed response to leak, pressure failure, burn, or flooding during plumbing installation",
    specificControls:
      "isolate services, pressure test safely, use pipe supports, ventilate hot work, control access, and provide spill response",
    consequence: "Burns, flooding, cuts, slips, serious injury",
  },
  "Oxy-fuel cutting": {
    title: "Construction - Oxy-Fuel Cutting Risk Assessment",
    people: "Cutters, welders, fire watch, workers nearby",
    planningHazard:
      "Fire, explosion, or burns caused by hot work near combustibles or poorly controlled cutting areas",
    equipmentHazard:
      "Gas cylinders, regulators, hoses, torches, or flashback arrestors damaged or used incorrectly",
    accessHazard:
      "Workers or public entering cutting zone and being exposed to sparks, hot metal, or cylinders",
    exposureHazard:
      "Fumes, heat, glare, oxygen enrichment, or poor ventilation during oxy-fuel cutting",
    emergencyHazard:
      "Delayed response to flashback, cylinder fire, burn injury, or combustible ignition",
    specificControls:
      "use hot work permits, fire watch, flashback arrestors, cylinder restraints, gas leak checks, ventilation, and fire extinguishers",
    consequence: "Burns, fire, explosion, eye injury, fatality",
  },
  "Grinding and cutting": {
    title: "Construction - Grinding and Cutting Risk Assessment",
    people: "Workers using grinders or saws, nearby workers, visitors",
    planningHazard:
      "Uncontrolled sparks, flying fragments, or cutting into unknown materials due to poor task planning",
    equipmentHazard:
      "Disc burst, missing guard, incorrect blade, kickback, or damaged power tool during grinding and cutting",
    accessHazard:
      "Bystanders entering spark or fragment zone, or workers cutting in cramped and unstable positions",
    exposureHazard:
      "Noise, dust, vibration, sparks, fumes, and hot surfaces from grinding and cutting",
    emergencyHazard:
      "Delayed response to eye injury, severe cut, fire, or tool failure",
    specificControls:
      "inspect guards and discs, use correct wheel, secure workpiece, wear face and hearing protection, control sparks, and use dust suppression",
    consequence: "Eye injury, lacerations, burns, hearing damage, serious injury",
  },
  "Hot work in occupied areas": {
    title: "Construction - Hot Work In Occupied Areas Risk Assessment",
    people: "Hot work crew, occupants, facility staff, visitors, fire watch",
    planningHazard:
      "Fire, smoke, fumes, or occupant exposure caused by hot work near occupied or operational areas",
    equipmentHazard:
      "Welding, cutting, grinding, gas equipment, or temporary screens failing to contain sparks and heat",
    accessHazard:
      "Occupants, visitors, or unauthorized workers entering hot work area during the task",
    exposureHazard:
      "Smoke, fumes, odors, heat, and fire alarm activation affecting occupied spaces",
    emergencyHazard:
      "Delayed evacuation, fire response, or communication with occupants after hot work incident",
    specificControls:
      "use hot work permits, fire watch, occupant communication, isolation of detectors where approved, ventilation, fire stopping checks, and post-work monitoring",
    consequence: "Fire, smoke inhalation, burns, disruption, fatality",
  },
  "Commissioning and testing": {
    title: "Construction - Commissioning and Testing Risk Assessment",
    people: "Commissioning engineers, electricians, operators, nearby workers",
    planningHazard:
      "Unexpected energization, movement, pressure release, or system startup during commissioning",
    equipmentHazard:
      "Test equipment, temporary bypasses, valves, panels, motors, or interlocks failing or being used incorrectly",
    accessHazard:
      "Unauthorized workers entering commissioning areas or interacting with equipment under test",
    exposureHazard:
      "Noise, heat, pressure, electrical energy, chemicals, or moving parts during live testing",
    emergencyHazard:
      "Delayed response to failed test, alarm, leak, electric shock, or mechanical movement",
    specificControls:
      "use commissioning permits, lockout/tagout, barriers, test scripts, competent supervision, emergency stop verification, and clear handover records",
    consequence: "Electric shock, pressure injury, mechanical injury, fire, fatality",
  },
  "Work near live traffic": {
    title: "Construction - Work Near Live Traffic Risk Assessment",
    people: "Road workers, traffic marshals, drivers, pedestrians, public",
    planningHazard:
      "Workers struck by live traffic due to inadequate traffic management, poor visibility, or unsafe work zone layout",
    equipmentHazard:
      "Traffic barriers, cones, signs, attenuators, or temporary signals damaged or incorrectly installed",
    accessHazard:
      "Workers crossing traffic routes or vehicles entering work zones without control",
    exposureHazard:
      "Night glare, weather, noise, exhaust fumes, and high-speed traffic affecting worker safety",
    emergencyHazard:
      "Delayed response to road traffic collision, vehicle incursion, or injured worker in live carriageway",
    specificControls:
      "use approved traffic management plans, physical barriers, lane closures, high-visibility PPE, spotters, and emergency escape routes",
    consequence: "Vehicle strike, crushing injury, multiple serious injuries, fatality",
  },
  "Work near overhead power lines": {
    title: "Construction - Work Near Overhead Power Lines Risk Assessment",
    people: "Plant operators, riggers, scaffolders, roof workers, ground workers",
    planningHazard:
      "Contact or arcing from overhead power lines during plant, lifting, scaffold, or access work",
    equipmentHazard:
      "Crane booms, MEWPs, scaffold tubes, ladders, or long materials entering electrical exclusion zones",
    accessHazard:
      "Workers or plant routes positioned too close to live overhead electrical services",
    exposureHazard:
      "Poor visibility, wind, long loads, or changing site levels reducing safe clearance",
    emergencyHazard:
      "Delayed response to electric shock, arc flash, fire, or energized plant after contact",
    specificControls:
      "isolate or divert power where possible, establish no-go zones, use goalposts and spotters, brief operators, and maintain utility owner clearance requirements",
    consequence: "Electric shock, arc flash burns, fire, fatality",
  },
  "Work over water": {
    title: "Construction - Work Over Water Risk Assessment",
    people: "Workers over water, rescue team, plant operators, inspectors",
    planningHazard:
      "Fall into water from platforms, edges, pontoons, bridges, or temporary works",
    equipmentHazard:
      "Life jackets, rescue equipment, access platforms, or edge protection missing, damaged, or unsuitable",
    accessHazard:
      "Workers moving across wet, unstable, or narrow access routes above water",
    exposureHazard:
      "Cold water, currents, poor weather, low visibility, contamination, or slippery surfaces",
    emergencyHazard:
      "Delayed water rescue, hypothermia response, or recovery of worker after fall into water",
    specificControls:
      "install edge protection, wear suitable life jackets, provide rescue boat or rescue kit, brief rescue plan, and monitor weather and water conditions",
    consequence: "Drowning, hypothermia, fall injury, fatality",
  },
  "Asbestos disturbance": {
    title: "Construction - Asbestos Disturbance Risk Assessment",
    people: "Workers, demolition crew, occupants, cleaners, public",
    planningHazard:
      "Unplanned disturbance of asbestos-containing materials during drilling, cutting, demolition, or refurbishment",
    equipmentHazard:
      "Inadequate enclosures, extraction, tools, waste bags, or decontamination equipment for asbestos controls",
    accessHazard:
      "Unauthorized workers entering asbestos-controlled areas or spreading contamination outside the work zone",
    exposureHazard:
      "Airborne asbestos fibers contaminating workers, clothing, tools, adjacent areas, and waste streams",
    emergencyHazard:
      "Delayed response to accidental asbestos disturbance, contamination spread, or failed air control",
    specificControls:
      "complete asbestos survey, stop work if suspect material is found, use licensed removal where required, isolate area, and follow decontamination and waste rules",
    consequence: "Serious occupational illness, contamination, regulatory breach",
  },
  "Silica dust generating work": {
    title: "Construction - Silica Dust Generating Work Risk Assessment",
    people: "Cutters, breakers, drillers, nearby workers, cleaners",
    planningHazard:
      "Respirable crystalline silica exposure from cutting, grinding, drilling, breaking, or sweeping concrete and masonry",
    equipmentHazard:
      "Dry cutting tools, ineffective extraction, missing water suppression, or poor respirator selection",
    accessHazard:
      "Other workers entering dusty exclusion zones or contaminated areas without controls",
    exposureHazard:
      "Airborne silica dust, poor ventilation, settled dust, and dry sweeping increasing inhalation risk",
    emergencyHazard:
      "Delayed response to uncontrolled dust release, failed extraction, or worker respiratory symptoms",
    specificControls:
      "use wet methods or on-tool extraction, restrict dusty zones, wear fit-tested RPE, clean with vacuum or wet methods, and monitor dust controls",
    consequence: "Respiratory disease, silicosis risk, eye irritation, chronic health effects",
  },
  "Night work": {
    title: "Construction - Night Work Risk Assessment",
    people: "Night shift workers, supervisors, security, drivers, nearby public",
    planningHazard:
      "Reduced visibility, fatigue, and reduced supervision increasing error, collision, and injury risk",
    equipmentHazard:
      "Temporary lighting, plant lights, alarms, radios, or backup systems inadequate or failing during night work",
    accessHazard:
      "Workers moving through poorly lit routes, changed traffic layouts, or isolated work areas",
    exposureHazard:
      "Fatigue, cold, glare, noise restrictions, reduced visibility, and lone working during night operations",
    emergencyHazard:
      "Delayed emergency response, poor communication, or difficulty locating injured workers at night",
    specificControls:
      "provide lighting plans, fatigue management, supervisor coverage, communication checks, emergency access, reflective PPE, and noise controls",
    consequence: "Collision, falls, fatigue-related error, serious injury, fatality",
  },
  "Emergency response drill": {
    title: "Construction - Emergency Response Drill Risk Assessment",
    people: "Workers, emergency wardens, visitors, supervisors, responders",
    planningHazard:
      "Drill creating confusion, panic, or exposure to active construction hazards during simulated emergency movement",
    equipmentHazard:
      "Alarms, radios, muster systems, emergency lighting, or rescue equipment failing during drill",
    accessHazard:
      "Participants moving through temporary routes, stairs, gates, traffic routes, or congested muster areas",
    exposureHazard:
      "Weather, noise, poor visibility, fatigue, or site congestion affecting drill participation and communication",
    emergencyHazard:
      "Real emergency or injury occurring during drill without clear escalation and cancellation process",
    specificControls:
      "brief wardens, control traffic, keep evacuation routes clear, test communications, account for personnel, and debrief lessons learned",
    consequence: "Trips, crowding, delayed evacuation, confusion, injury",
  },
};

const additionalConstructionRiskAssessmentLibrary = Object.fromEntries(
  Object.entries(additionalConstructionActivityHazardSets).map(
    ([activity, assessment]) => [
      activity,
      {
        title: assessment.title,
        createHazards: () => createLibraryHazards(assessment.hazards),
      },
    ],
  ),
) as Record<string, { title: string; createHazards: () => HazardRow[] }>;

const compactAdditionalConstructionRiskAssessmentLibrary = Object.fromEntries(
  Object.entries(compactAdditionalConstructionActivityProfiles).map(
    ([activity, profile]) => [
      activity,
      {
        title: profile.title,
        createHazards: () => createCompactConstructionHazards(activity, profile),
      },
    ],
  ),
) as Record<string, { title: string; createHazards: () => HazardRow[] }>;

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
  ...additionalConstructionRiskAssessmentLibrary,
  ...compactAdditionalConstructionRiskAssessmentLibrary,
};

type WarehouseActivityProfile = {
  title: string;
  people: string;
  planningHazard: string;
  equipmentHazard: string;
  trafficHazard: string;
  exposureHazard: string;
  emergencyHazard: string;
  specificControls: string;
  consequence: string;
};

const createWarehouseHazards = (
  activity: string,
  profile: WarehouseActivityProfile,
): HazardRow[] =>
  createLibraryHazards([
    libraryHazardTemplate(
      `${activity} planning and work area controls`,
      profile.planningHazard,
      profile.people,
      profile.consequence,
      "Task area identified; supervisors brief workers; basic warehouse rules, PPE, and housekeeping controls are in place",
      3,
      5,
      `${profile.specificControls}; confirm safe system of work, communicate restricted areas, and stop the activity if controls are not effective`,
      libraryControls.engAdminPpe,
      1,
      4,
    ),
    libraryHazardTemplate(
      `${activity} equipment, load, and material handling`,
      profile.equipmentHazard,
      profile.people,
      "Crush injury, cuts, dropped goods, equipment damage, serious injury",
      "Equipment is visually checked; loads are assessed before movement; damaged items are reported to supervision",
      3,
      4,
      `${profile.specificControls}; inspect equipment, secure unstable loads, keep hands clear of pinch points, and remove damaged pallets or tools from use`,
      libraryControls.substitutionEngAdminPpe,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} pedestrian, vehicle, and route interface`,
      profile.trafficHazard,
      "Warehouse workers, forklift operators, delivery drivers, contractors, visitors",
      "Struck-by injury, collision, falls, fractures, fatality",
      "Pedestrian routes and vehicle routes are marked; speed limits and site traffic rules are communicated",
      3,
      5,
      `${profile.specificControls}; segregate pedestrians and mobile equipment, use banksmen where needed, maintain visibility, and control access to active work areas`,
      libraryControls.engAdminPpe,
      1,
      4,
    ),
    libraryHazardTemplate(
      `${activity} exposure, ergonomics, and environment`,
      profile.exposureHazard,
      profile.people,
      "Musculoskeletal injury, slips, chemical exposure, fatigue, reduced visibility, health effects",
      "Manual handling guidance, spill kits, lighting, ventilation, and welfare arrangements are available",
      3,
      4,
      `${profile.specificControls}; reduce manual handling, improve ventilation or lighting, rotate tasks, clean spills promptly, and provide task-specific PPE`,
      libraryControls.engAdminPpe,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} emergency response, inspection, and handover`,
      profile.emergencyHazard,
      "Workers, supervisors, first aiders, emergency wardens, emergency responders",
      "Delayed rescue, uncontrolled escalation, serious injury, fire, environmental impact",
      "Emergency contacts are known; first aid and spill response equipment are accessible; supervisors monitor work progress",
      2,
      5,
      `${profile.specificControls}; verify emergency routes, report defects, document outstanding actions, and brief the next shift before handover`,
      libraryControls.adminPpe,
      1,
      4,
    ),
  ]);

const warehouseActivityProfiles: Record<string, WarehouseActivityProfile> = {
  "Goods receiving": {
    title: "Warehouse & Logistics - Goods Receiving Risk Assessment",
    people: "Receiving operatives, forklift operators, delivery drivers, supervisors",
    planningHazard:
      "Congested receiving bays, unplanned deliveries, mixed pedestrian and vehicle movement, or unclear unloading sequence",
    equipmentHazard:
      "Damaged pallets, unstable inbound goods, defective dock equipment, or incorrect handling aids used during receiving",
    trafficHazard:
      "Delivery vehicles, forklifts, pallet trucks, and pedestrians interacting in the receiving area",
    exposureHazard:
      "Manual handling strain, damaged packaging, leaking products, poor lighting, or slippery receiving floors",
    emergencyHazard:
      "Delayed isolation of damaged goods, spills, vehicle incident, or blocked receiving exit routes",
    specificControls:
      "schedule deliveries, inspect inbound loads, use designated receiving lanes, quarantine damaged goods, and keep docks clear",
    consequence: "Crush injury, struck-by injury, slips, sprains, serious injury",
  },
  "Loading and unloading": {
    title: "Warehouse & Logistics - Loading and Unloading Risk Assessment",
    people: "Warehouse operatives, forklift operators, delivery drivers, pedestrians",
    planningHazard:
      "Trailer movement, uncontrolled loading sequence, dock edge exposure, or poor coordination between driver and warehouse team",
    equipmentHazard:
      "Dock plates, dock levelers, lifting equipment, restraints, or pallets failing during loading and unloading",
    trafficHazard:
      "Forklifts, trailers, reversing vehicles, and pedestrians sharing dock approaches or loading bays",
    exposureHazard:
      "Manual handling, unstable loads, weather at dock doors, slippery floors, and poor visibility inside trailers",
    emergencyHazard:
      "Load collapse, fall from dock, vehicle pull-away, spill, or blocked emergency access at the bay",
    specificControls:
      "use vehicle restraints or chocks, confirm driver handover, control dock edges, inspect loads, and enforce exclusion zones",
    consequence: "Crushing, falls from dock, struck-by injury, fractures, fatality",
  },
  "Pallet handling": {
    title: "Warehouse & Logistics - Pallet Handling Risk Assessment",
    people: "Warehouse operatives, forklift operators, order pickers, supervisors",
    planningHazard:
      "Incorrect pallet selection, overloaded pallets, unstable stacking, or poor segregation of damaged pallets",
    equipmentHazard:
      "Broken boards, protruding nails, pallet truck failure, damaged wrap, or shifting goods during pallet movement",
    trafficHazard:
      "Pedestrians exposed to pallet trucks, forklifts, dropped pallets, or blocked aisles",
    exposureHazard:
      "Manual lifting, splinters, sharp edges, repetitive handling, and trip hazards from loose pallets",
    emergencyHazard:
      "Pallet collapse, product spill, blocked fire routes, or delayed removal of damaged pallets",
    specificControls:
      "inspect pallets before use, remove damaged pallets, keep stacks stable, limit stack heights, and store pallets in marked areas",
    consequence: "Foot injury, cuts, crush injury, sprains, lost time injury",
  },
  "Order picking": {
    title: "Warehouse & Logistics - Order Picking Risk Assessment",
    people: "Order pickers, reach truck operators, warehouse workers, supervisors",
    planningHazard:
      "Picking from unsuitable locations, congested aisles, poor pick sequence, or pressure to rush orders",
    equipmentHazard:
      "Picking trolleys, scanners, ladders, pallet trucks, or stock containers damaged or incorrectly used",
    trafficHazard:
      "Pickers working close to forklifts, reach trucks, pallet trucks, and other aisle traffic",
    exposureHazard:
      "Repetitive movement, awkward reaching, heavy items, slips, trips, and poor lighting at pick faces",
    emergencyHazard:
      "Delayed response to injury in aisles, blocked evacuation routes, damaged stock, or missing stock controls",
    specificControls:
      "plan pick routes, keep aisles clear, use suitable picking equipment, separate MHE zones, and rotate repetitive tasks",
    consequence: "Musculoskeletal injury, collision, falls, cuts, serious injury",
  },
  "Packing operations": {
    title: "Warehouse & Logistics - Packing Operations Risk Assessment",
    people: "Packing operatives, quality inspectors, supervisors, maintenance workers",
    planningHazard:
      "Congested packing benches, poor workflow, packaging waste accumulation, or rushed packing targets",
    equipmentHazard:
      "Cutters, strapping tools, heat sealers, conveyors, scales, or packing machinery causing cuts, burns, or pinch injuries",
    trafficHazard:
      "Pallet trucks, trolleys, and finished goods moving through packing areas with limited separation",
    exposureHazard:
      "Repetitive packing, awkward postures, noise, adhesive exposure, dust, and slips from packaging waste",
    emergencyHazard:
      "Fire from packaging materials, blocked exits, machinery incident, or delayed first aid response",
    specificControls:
      "keep packing stations organized, guard equipment, control blades, manage waste, and apply ergonomic workstation setup",
    consequence: "Cuts, burns, strain injuries, slips, fire, lost time injury",
  },
  "Dispatch operations": {
    title: "Warehouse & Logistics - Dispatch Operations Risk Assessment",
    people: "Dispatch operatives, forklift operators, drivers, supervisors",
    planningHazard:
      "Incorrect staging, rushed dispatch deadlines, poor load sequencing, or mixed pedestrian and vehicle routes",
    equipmentHazard:
      "Pallet wrap, straps, dock equipment, scanners, or load restraints missing, damaged, or incorrectly applied",
    trafficHazard:
      "Forklifts, delivery vehicles, pallet trucks, and pedestrians interacting around dispatch lanes",
    exposureHazard:
      "Manual handling, fatigue, weather exposure at dock doors, unstable outbound loads, and poor housekeeping",
    emergencyHazard:
      "Vehicle movement during loading, load collapse in dispatch lane, blocked exits, or documentation errors delaying response",
    specificControls:
      "use dispatch staging lanes, verify load stability, secure outbound loads, control driver access, and maintain clear dock communication",
    consequence: "Crush injury, struck-by injury, sprains, falls, serious injury",
  },
  "Container unloading": {
    title: "Warehouse & Logistics - Container Unloading Risk Assessment",
    people: "Warehouse operatives, forklift operators, drivers, supervisors",
    planningHazard:
      "Unplanned container contents, shifted cargo, poor unloading sequence, or unsafe container door opening",
    equipmentHazard:
      "Damaged pallets, container doors, forklifts, dock plates, or handling aids failing during unloading",
    trafficHazard:
      "Forklifts, pallet trucks, pedestrians, and vehicle movements around container unloading zones",
    exposureHazard:
      "Heat stress, poor ventilation, fumigation residues, dust, manual handling, and slippery container floors",
    emergencyHazard:
      "Cargo collapse, suspected fumigant exposure, worker injury inside container, or blocked exit from container",
    specificControls:
      "inspect container before entry, open doors from a safe position, ventilate container, test where required, and unload in controlled sequence",
    consequence: "Crushing, toxic exposure, heat stress, slips, serious injury",
  },
  "Returns handling": {
    title: "Warehouse & Logistics - Returns Handling Risk Assessment",
    people: "Returns operatives, quality inspectors, warehouse workers, supervisors",
    planningHazard:
      "Unknown condition of returned goods, poor quarantine controls, or mixing damaged items with normal stock",
    equipmentHazard:
      "Damaged packaging, leaking containers, sharp edges, broken products, or unsuitable handling tools",
    trafficHazard:
      "Pallet trucks, trolleys, and pedestrians moving around sorting and quarantine areas",
    exposureHazard:
      "Chemical residue, biological contamination, sharps, manual handling, and slips from damaged products",
    emergencyHazard:
      "Uncontrolled spill, contaminated goods, blocked quarantine area, or unclear escalation to supervisors",
    specificControls:
      "segregate returns, inspect packaging before handling, quarantine suspect goods, use spill kits, and document rejection decisions",
    consequence: "Cuts, contamination, chemical exposure, sprains, environmental harm",
  },
  "Forklift operation": {
    title: "Warehouse & Logistics - Forklift Operation Risk Assessment",
    people: "Forklift operators, pedestrians, delivery drivers, supervisors",
    planningHazard:
      "Forklift movements planned through congested aisles, poor traffic segregation, blind corners, or unsuitable travel routes",
    equipmentHazard:
      "Forks, brakes, steering, mast, tyres, seatbelt, warning devices, or load backrest damaged or not inspected",
    trafficHazard:
      "Forklift collision with pedestrians, other forklifts, racking, dock edges, or delivery vehicles",
    exposureHazard:
      "Poor visibility, reversing hazards, uneven floors, battery or fuel exposure, vibration, and operator fatigue",
    emergencyHazard:
      "Overturn, falling load, collision, blocked aisle, or delayed rescue after operator injury",
    specificControls:
      "use trained operators, daily pre-use checks, seatbelts, speed limits, pedestrian segregation, and controlled reversing",
    consequence: "Pedestrian collision, crushing, overturn, falling load, fatality",
  },
  "Reach truck operation": {
    title: "Warehouse & Logistics - Reach Truck Operation Risk Assessment",
    people: "Reach truck operators, warehouse workers, order pickers, supervisors",
    planningHazard:
      "High-level pallet handling in narrow aisles without adequate exclusion, visibility, or load planning",
    equipmentHazard:
      "Mast, forks, reach mechanism, cameras, warning devices, or load indicators failing during high-level storage work",
    trafficHazard:
      "Reach trucks operating in narrow aisles with pedestrians, pickers, or other mobile equipment nearby",
    exposureHazard:
      "Neck strain, poor aisle lighting, falling stock, damaged racking, and fatigue during repetitive high-level work",
    emergencyHazard:
      "Pallet fall, truck collision, rack strike, trapped operator, or blocked aisle emergency access",
    specificControls:
      "restrict pedestrian access to aisles, inspect trucks and racking, keep loads stable, use spotters where needed, and enforce speed limits",
    consequence: "Falling goods, collision, crush injury, racking damage, serious injury",
  },
  "Pallet truck operation": {
    title: "Warehouse & Logistics - Pallet Truck Operation Risk Assessment",
    people: "Warehouse operatives, order pickers, dispatch workers, pedestrians",
    planningHazard:
      "Manual or powered pallet trucks used on unsuitable routes, slopes, congested aisles, or with excessive loads",
    equipmentHazard:
      "Wheels, handles, brakes, forks, batteries, or lifting mechanisms damaged or poorly maintained",
    trafficHazard:
      "Pallet trucks colliding with pedestrians, forklifts, racking, doors, or dock edges",
    exposureHazard:
      "Manual pushing and pulling strain, foot crush injuries, slips, uneven floors, and awkward maneuvering",
    emergencyHazard:
      "Runaway pallet truck, load collapse, injury in aisle, or blocked evacuation route",
    specificControls:
      "check pallet truck condition, set weight limits, avoid slopes where possible, keep routes clear, and use safety footwear",
    consequence: "Foot injuries, strains, collisions, dropped loads, lost time injury",
  },
  "Battery charging": {
    title: "Warehouse & Logistics - Battery Charging Risk Assessment",
    people: "Forklift operators, maintenance workers, warehouse workers, supervisors",
    planningHazard:
      "Battery charging performed in unsuitable areas without ventilation, segregation, or emergency controls",
    equipmentHazard:
      "Chargers, cables, connectors, batteries, eye wash units, or lifting aids damaged or used incorrectly",
    trafficHazard:
      "Mobile equipment or pedestrians entering charging areas and striking chargers, cables, or parked forklifts",
    exposureHazard:
      "Hydrogen gas, acid exposure, electrical shock, fire, poor ventilation, and manual handling of batteries",
    emergencyHazard:
      "Battery fire, acid spill, electric shock, gas accumulation, or delayed access to eyewash and spill equipment",
    specificControls:
      "ventilate charging areas, prohibit ignition sources, inspect chargers, provide eyewash and spill kits, and train authorized users",
    consequence: "Chemical burns, electric shock, fire, explosion, serious injury",
  },
  "Refueling operations": {
    title: "Warehouse & Logistics - Refueling Operations Risk Assessment",
    people: "Forklift operators, plant operators, maintenance workers, supervisors",
    planningHazard:
      "Refueling conducted without exclusion, ignition control, spill prevention, or clear responsibility",
    equipmentHazard:
      "Fuel hoses, LPG cylinders, valves, pumps, spill trays, or bonding arrangements damaged or incorrectly used",
    trafficHazard:
      "Vehicles, forklifts, and pedestrians moving through the refueling area during fuel transfer",
    exposureHazard:
      "Fuel vapors, skin contact, fire, environmental contamination, poor ventilation, and manual handling of cylinders",
    emergencyHazard:
      "Fuel spill, fire, LPG leak, vehicle impact, or delayed emergency isolation",
    specificControls:
      "use authorized refueling zones, remove ignition sources, inspect hoses and cylinders, keep spill kits ready, and train operators",
    consequence: "Fire, burns, explosion, environmental harm, serious injury",
  },
  "Racking inspection": {
    title: "Warehouse & Logistics - Racking Inspection Risk Assessment",
    people: "Racking inspectors, warehouse workers, forklift operators, supervisors",
    planningHazard:
      "Inspections missed or incomplete, allowing damaged racking, overloading, or poor load placement to remain in service",
    equipmentHazard:
      "Damaged beams, uprights, protectors, floor fixings, pallets, or load notices affecting rack integrity",
    trafficHazard:
      "Inspectors exposed to forklifts, reach trucks, falling stock, or active picking in racking aisles",
    exposureHazard:
      "High-level visual checks, poor lighting, awkward access, dust, and falling-object exposure",
    emergencyHazard:
      "Delayed isolation of unsafe racking, rack collapse, falling stock, or unclear defect escalation",
    specificControls:
      "use competent inspections, tag damaged racking, quarantine unsafe bays, verify load limits, and repair defects before reuse",
    consequence: "Falling stock, racking collapse, crush injury, fatality",
  },
  "High-level storage": {
    title: "Warehouse & Logistics - High-Level Storage Risk Assessment",
    people: "Reach truck operators, forklift operators, warehouse workers, order pickers",
    planningHazard:
      "Poorly planned high-level storage causing overloaded racks, unstable pallets, or unsuitable goods stored at height",
    equipmentHazard:
      "Damaged pallets, racking, reach trucks, wrapping, or lifting accessories used for high-level storage",
    trafficHazard:
      "Mobile equipment and pedestrians operating near high-level storage zones and narrow aisles",
    exposureHazard:
      "Falling objects, poor visibility, awkward checking, damaged packaging, and high-level retrieval pressure",
    emergencyHazard:
      "Load fall, rack strike, aisle blockage, or delayed isolation of unsafe high-level stock",
    specificControls:
      "verify rack capacity, store heavy goods low, wrap pallets correctly, inspect loads before lifting, and restrict aisle access",
    consequence: "Falling stock, crush injury, racking damage, serious injury, fatality",
  },
  "Manual stacking": {
    title: "Warehouse & Logistics - Manual Stacking Risk Assessment",
    people: "Warehouse operatives, order pickers, supervisors, nearby workers",
    planningHazard:
      "Manual stacks built too high, on uneven surfaces, or with incompatible goods creating collapse risk",
    equipmentHazard:
      "Damaged pallets, boxes, straps, wrap, step aids, or handling tools used during stacking",
    trafficHazard:
      "Workers stacking in aisles or near mobile equipment, doors, and pedestrian routes",
    exposureHazard:
      "Heavy lifting, awkward postures, repetitive handling, hand injuries, and trips around stacked goods",
    emergencyHazard:
      "Stack collapse, blocked fire routes, trapped worker, or delayed removal of unstable goods",
    specificControls:
      "set stack height limits, keep heavy items low, use mechanical aids, inspect packaging, and maintain aisle clearance",
    consequence: "Back injury, crush injury, falling goods, sprains, lost time injury",
  },
  "Storage of hazardous materials": {
    title: "Warehouse & Logistics - Storage of Hazardous Materials Risk Assessment",
    people: "Warehouse workers, forklift operators, maintenance workers, emergency responders",
    planningHazard:
      "Incompatible hazardous materials stored together, poor labeling, inadequate segregation, or missing safety data",
    equipmentHazard:
      "Damaged containers, leaking drums, unsuitable pallets, spill pallets, ventilation, or fire protection systems",
    trafficHazard:
      "Forklifts or pallet trucks striking hazardous material storage areas or spill containment equipment",
    exposureHazard:
      "Chemical inhalation, skin contact, fire, reactive substances, poor ventilation, and environmental release",
    emergencyHazard:
      "Chemical spill, fire, exposure incident, missing SDS, or delayed emergency response",
    specificControls:
      "segregate incompatible materials, label containers, use bunding, maintain SDS access, inspect storage, and train spill responders",
    consequence: "Chemical burns, inhalation injury, fire, environmental harm, serious injury",
  },
  "Cold storage operations": {
    title: "Warehouse & Logistics - Cold Storage Operations Risk Assessment",
    people: "Cold store workers, forklift operators, order pickers, maintenance workers",
    planningHazard:
      "Work in cold rooms planned without exposure limits, suitable clothing, visibility controls, or worker check-ins",
    equipmentHazard:
      "Cold room doors, alarms, lighting, forklifts, racking, or insulated PPE failing during cold storage work",
    trafficHazard:
      "Forklifts and pedestrians moving on icy floors, tight aisles, and low-visibility cold store routes",
    exposureHazard:
      "Cold stress, slippery ice, condensation, reduced dexterity, poor visibility, and isolation inside cold rooms",
    emergencyHazard:
      "Worker trapped in cold room, delayed assistance for cold stress, door failure, or blocked escape route",
    specificControls:
      "use cold-rated PPE, anti-slip controls, door release checks, worker check-in systems, floor inspections, and exposure rotation",
    consequence: "Cold stress, slips, falls, collision, serious injury",
  },
  "Cleaning operations": {
    title: "Warehouse & Logistics - Cleaning Operations Risk Assessment",
    people: "Cleaners, warehouse workers, forklift operators, contractors",
    planningHazard:
      "Cleaning conducted during active operations without segregation, signage, or coordination with warehouse traffic",
    equipmentHazard:
      "Cleaning machines, chemicals, hoses, buckets, scrubbers, or ladders damaged or incorrectly used",
    trafficHazard:
      "Cleaners exposed to forklifts, pallet trucks, pedestrians, or vehicles while working in operational areas",
    exposureHazard:
      "Wet floors, chemical contact, fumes, manual handling, sharps in waste, and poor ventilation",
    emergencyHazard:
      "Chemical splash, slip incident, equipment entanglement, blocked exit, or uncontrolled spill",
    specificControls:
      "schedule cleaning safely, use wet floor controls, dilute chemicals correctly, segregate cleaning zones, and store chemicals securely",
    consequence: "Slips, chemical burns, respiratory irritation, strains, lost time injury",
  },
  "Waste handling": {
    title: "Warehouse & Logistics - Waste Handling Risk Assessment",
    people: "Warehouse workers, cleaners, waste contractors, supervisors",
    planningHazard:
      "Waste streams mixed, poorly segregated, overflowing, or handled without clear disposal routes",
    equipmentHazard:
      "Bins, compactors, balers, sharps containers, pallets, or waste cages damaged or overloaded",
    trafficHazard:
      "Waste movement crossing forklift routes, dock areas, pedestrian walkways, or contractor collection zones",
    exposureHazard:
      "Sharps, contamination, manual handling, dust, odors, fire loading, and slips from spilled waste",
    emergencyHazard:
      "Waste fire, compactor incident, blocked exits, spill, or delayed contractor collection",
    specificControls:
      "segregate waste, control bin weights, inspect compactors, remove combustible waste promptly, and train workers in waste hazards",
    consequence: "Cuts, contamination, fire, strains, environmental harm",
  },
  "Conveyor maintenance": {
    title: "Warehouse & Logistics - Conveyor Maintenance Risk Assessment",
    people: "Maintenance workers, operators, contractors, supervisors",
    planningHazard:
      "Maintenance started without isolation, permit controls, communication, or understanding of stored energy",
    equipmentHazard:
      "Belts, rollers, motors, guards, sensors, and pinch points creating entanglement or crush hazards",
    trafficHazard:
      "Maintenance workers exposed to warehouse traffic, adjacent conveyors, or nearby loading operations",
    exposureHazard:
      "Noise, dust, awkward access, sharp edges, manual handling of parts, and electrical exposure",
    emergencyHazard:
      "Unexpected startup, trapped worker, electrical incident, or delayed rescue from conveyor line",
    specificControls:
      "apply lockout/tagout, test for zero energy, keep guards in place, use permits, and communicate maintenance status",
    consequence: "Entanglement, crushing, amputation, electric shock, fatality",
  },
  "Electrical maintenance": {
    title: "Warehouse & Logistics - Electrical Maintenance Risk Assessment",
    people: "Electricians, maintenance workers, warehouse workers, contractors",
    planningHazard:
      "Electrical maintenance performed without correct isolation, access control, permits, or verification of competence",
    equipmentHazard:
      "Panels, cables, chargers, lighting circuits, tools, test equipment, or temporary supplies damaged or incorrectly used",
    trafficHazard:
      "Workers maintaining equipment near active aisles, dock areas, forklifts, or temporary barriers",
    exposureHazard:
      "Electric shock, arc flash, burns, poor lighting, working at height, and contact with live parts",
    emergencyHazard:
      "Arc flash, electric shock, fire, failed isolation, or delayed emergency shutoff",
    specificControls:
      "use authorized electricians, lockout/tagout, prove dead, use insulated tools, control live testing, and maintain arc flash boundaries",
    consequence: "Electric shock, burns, fire, arc flash, fatality",
  },
  "Dock leveler operation": {
    title: "Warehouse & Logistics - Dock Leveler Operation Risk Assessment",
    people: "Dock operators, forklift operators, delivery drivers, maintenance workers",
    planningHazard:
      "Dock leveler used without vehicle restraint, inspection, edge control, or clear communication with the driver",
    equipmentHazard:
      "Leveler platform, lip, controls, hydraulics, guards, dock bumpers, or restraints failing during use",
    trafficHazard:
      "Forklifts, pedestrians, and vehicles moving across dock leveler areas and dock edges",
    exposureHazard:
      "Pinch points, crush zones, slips at dock edge, weather exposure, and poor visibility inside trailers",
    emergencyHazard:
      "Leveler collapse, vehicle pull-away, trapped worker, fall from dock, or delayed isolation for maintenance",
    specificControls:
      "inspect dock levelers, restrain vehicles, keep pedestrians clear, train operators, and isolate levelers before maintenance",
    consequence: "Crush injury, falls from dock, struck-by injury, serious injury",
  },
  "Work at height in warehouse": {
    title: "Warehouse & Logistics - Work at Height Risk Assessment",
    people: "Maintenance workers, order pickers, contractors, supervisors, workers below",
    planningHazard:
      "Work at height in aisles, racks, docks, or mezzanines planned without suitable access equipment or exclusion zones",
    equipmentHazard:
      "Ladders, MEWPs, fall protection, guardrails, tools, or platforms damaged or incorrectly used",
    trafficHazard:
      "People or mobile equipment entering the area below work at height or striking access equipment",
    exposureHazard:
      "Falling objects, overreaching, poor lighting, slippery platforms, and fatigue during elevated work",
    emergencyHazard:
      "Fall, dropped object, MEWP breakdown, suspension trauma, or delayed rescue from elevated position",
    specificControls:
      "select suitable access equipment, inspect fall protection, set exclusion zones below, secure tools, and prepare rescue arrangements",
    consequence: "Fall from height, falling objects, fractures, serious injury, fatality",
  },
  "Confined space entry": {
    title: "Warehouse & Logistics - Confined Space Entry Risk Assessment",
    people: "Authorized entrants, attendants, maintenance workers, emergency responders",
    planningHazard:
      "Entry to tanks, pits, compactors, containers, or restricted spaces without permit, testing, or rescue planning",
    equipmentHazard:
      "Gas monitors, ventilation, lighting, retrieval equipment, or communication devices missing, damaged, or uncalibrated",
    trafficHazard:
      "Forklifts, pedestrians, or warehouse operations affecting the entry point, access route, or rescue area",
    exposureHazard:
      "Oxygen deficiency, toxic or flammable atmosphere, heat stress, poor visibility, and restricted movement",
    emergencyHazard:
      "Entrant collapse, failed communication, delayed rescue, unauthorized entry, or reliance on emergency services alone",
    specificControls:
      "use permit-to-work, atmospheric testing, forced ventilation, trained attendants, rescue equipment, and controlled access",
    consequence: "Asphyxiation, poisoning, fire, entrapment, fatality",
  },
  "Fire emergency response": {
    title: "Warehouse & Logistics - Fire Emergency Response Risk Assessment",
    people: "Warehouse workers, visitors, fire wardens, contractors, emergency responders",
    planningHazard:
      "Fire response plans not understood, blocked evacuation routes, high fire loading, or unclear assembly process",
    equipmentHazard:
      "Fire alarms, extinguishers, sprinklers, emergency lighting, doors, or radios missing, blocked, or not maintained",
    trafficHazard:
      "Evacuating workers exposed to vehicles, forklifts, dock traffic, or congested muster areas",
    exposureHazard:
      "Smoke inhalation, heat, panic, poor visibility, and fatigue during evacuation or first response",
    emergencyHazard:
      "Delayed alarm activation, blocked exits, failed headcount, emergency equipment failure, or uncontrolled fire spread",
    specificControls:
      "keep exits clear, inspect fire equipment, train wardens, run evacuation drills, control combustible storage, and verify headcounts",
    consequence: "Smoke exposure, burns, panic injuries, property loss, fatality",
  },
  "Spill response": {
    title: "Warehouse & Logistics - Spill Response Risk Assessment",
    people: "Warehouse workers, spill responders, cleaners, supervisors, contractors",
    planningHazard:
      "Spill response started without identifying substance, isolating area, or selecting compatible cleanup materials",
    equipmentHazard:
      "Spill kits, absorbents, drains covers, PPE, waste containers, or SDS information unavailable or unsuitable",
    trafficHazard:
      "Forklifts, pallet trucks, pedestrians, and vehicles entering contaminated or slippery spill areas",
    exposureHazard:
      "Chemical contact, inhalation, slips, incompatible absorbents, environmental release, and contaminated waste handling",
    emergencyHazard:
      "Uncontrolled spill migration, exposure symptoms, fire risk, drain contamination, or delayed escalation",
    specificControls:
      "identify product, isolate spill area, use SDS, protect drains, select correct PPE and absorbents, and dispose of waste correctly",
    consequence: "Chemical injury, slips, fire, environmental harm, serious injury",
  },
  "Lone working": {
    title: "Warehouse & Logistics - Lone Working Risk Assessment",
    people: "Lone workers, supervisors, security personnel, emergency responders",
    planningHazard:
      "Workers assigned to isolated warehouse areas, yards, cold rooms, or maintenance tasks without check-in controls",
    equipmentHazard:
      "Radios, phones, panic alarms, access systems, lighting, or monitoring equipment unavailable or unreliable",
    trafficHazard:
      "Lone workers moving through yards, aisles, docks, or parking areas without immediate assistance nearby",
    exposureHazard:
      "Fatigue, manual handling, slips, cold exposure, security threats, and delayed medical assistance",
    emergencyHazard:
      "Injury or illness not discovered quickly, failed communication, security incident, or delayed first aid",
    specificControls:
      "use lone worker check-ins, communication devices, task limits, supervisor escalation, and prohibit high-risk work alone",
    consequence: "Delayed rescue, serious injury, medical deterioration, security incident",
  },
  "Night shift warehouse operations": {
    title: "Warehouse & Logistics - Night Shift Warehouse Operations Risk Assessment",
    people: "Night shift workers, forklift operators, supervisors, security staff",
    planningHazard:
      "Night operations planned with reduced supervision, fewer support staff, changed traffic patterns, or fatigue risk",
    equipmentHazard:
      "Lighting, alarms, radios, forklifts, dock systems, and emergency equipment not checked for night shift use",
    trafficHazard:
      "Reduced visibility between pedestrians, forklifts, yard vehicles, and delivery drivers during night operations",
    exposureHazard:
      "Fatigue, poor lighting, cold conditions, lone working, security concerns, and reduced alertness",
    emergencyHazard:
      "Delayed emergency response, reduced first aid cover, communication failure, or difficulty accounting for workers",
    specificControls:
      "manage fatigue, maintain lighting, verify communication and emergency cover, increase supervision, and secure access points",
    consequence: "Collision, fatigue-related error, slips, delayed response, serious injury",
  },
};

const warehouseRiskAssessmentLibrary = Object.fromEntries(
  Object.entries(warehouseActivityProfiles).map(([activity, profile]) => [
    activity,
    {
      title: profile.title,
      createHazards: () => createWarehouseHazards(activity, profile),
    },
  ]),
) as Record<string, { title: string; createHazards: () => HazardRow[] }>;

type SmartSectorCategoryProfile = {
  people: string;
  planningHazard: string;
  equipmentHazard: string;
  interfaceHazard: string;
  exposureHazard: string;
  emergencyHazard: string;
  existingMeasures: string;
  specificControls: string;
  consequence: string;
};

const createSmartSectorHazards = (
  sector: string,
  category: string,
  activity: string,
  profile: SmartSectorCategoryProfile,
): HazardRow[] =>
  createLibraryHazards([
    libraryHazardTemplate(
      `${activity} planning and supervision`,
      `${activity} in ${sector} ${profile.planningHazard}`,
      profile.people,
      profile.consequence,
      profile.existingMeasures,
      3,
      5,
      `${profile.specificControls}; confirm responsibilities, supervision, safe sequencing, and stop-work criteria before the task starts`,
      libraryControls.engAdminPpe,
      1,
      4,
    ),
    libraryHazardTemplate(
      `${activity} equipment, tools, and materials`,
      `${activity} may involve ${profile.equipmentHazard}`,
      profile.people,
      "Cuts, crush injury, burns, equipment damage, ill health, lost time injury",
      "Equipment, tools, materials, and work areas are visually checked before use; defects are reported to supervision",
      3,
      4,
      `${profile.specificControls}; remove defective equipment, use suitable tools, keep guards or barriers in place, and verify task-specific PPE`,
      libraryControls.substitutionEngAdminPpe,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} people, workflow, and interface controls`,
      `${activity} can expose people to ${profile.interfaceHazard}`,
      profile.people,
      "Struck-by injury, collision, contact injury, stress, delayed care, serious injury",
      "Work areas, access routes, and communication arrangements are defined before work begins",
      3,
      5,
      `${profile.specificControls}; separate affected people from the hazard, brief all involved workers, control access, and coordinate with nearby teams`,
      libraryControls.engAdminPpe,
      1,
      4,
    ),
    libraryHazardTemplate(
      `${activity} exposure, ergonomics, and environment`,
      `${activity} may create ${profile.exposureHazard}`,
      profile.people,
      "Musculoskeletal injury, exposure-related illness, fatigue, slips, trips, reduced performance",
      "Basic housekeeping, welfare, ventilation, lighting, and PPE arrangements are available where required",
      3,
      4,
      `${profile.specificControls}; reduce exposure at source, rotate tasks, improve the work environment, and escalate symptoms or unsafe conditions early`,
      libraryControls.eliminationEngAdminPpe,
      1,
      3,
    ),
    libraryHazardTemplate(
      `${activity} emergency response and handover`,
      `${activity} may be affected by ${profile.emergencyHazard}`,
      "Workers, supervisors, first aiders, emergency responders, affected occupants",
      "Delayed response, uncontrolled escalation, serious injury, business interruption, fatality",
      "Emergency contacts, first aid arrangements, reporting routes, and escalation procedures are communicated",
      2,
      5,
      `${profile.specificControls}; verify emergency access, report incidents and defects, document open actions, and communicate residual risks during handover`,
      libraryControls.adminPpe,
      1,
      4,
    ),
  ]);

const manufacturingCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Production Operations": {
    people:
      "Production operators, line supervisors, quality inspectors, maintenance workers, nearby workers",
    planningHazard:
      "can create exposure to moving production processes, task pressure, unclear line responsibilities, unsafe sequencing, and changing production conditions",
    equipmentHazard:
      "unguarded moving parts, pinch points, sharp edges, hot surfaces, powered tools, conveyor movement, and unstable materials",
    interfaceHazard:
      "interaction between operators, maintenance personnel, forklifts, material movements, and adjacent production lines",
    exposureHazard:
      "noise, vibration, repetitive work, manual handling, dust, poor ventilation, heat, and slips from process residues",
    emergencyHazard:
      "machine stoppages, jams, product spills, fire risk, emergency stop failure, or delayed response to line incidents",
    existingMeasures:
      "Standard operating procedures, supervisor oversight, machine guards, emergency stops, PPE, and line briefings are in place",
    specificControls:
      "verify guarding and emergency stops, keep hands clear of moving parts, manage production pace, maintain housekeeping, and report abnormal machine behavior",
    consequence:
      "Entanglement, crushing, cuts, burns, musculoskeletal injury, serious injury",
  },
  "Machinery & Equipment": {
    people:
      "Machine operators, technicians, maintenance workers, supervisors, nearby production workers",
    planningHazard:
      "can expose workers to hazardous energy, poor guarding, rotating equipment, stored energy, and unsafe access to operating machinery",
    equipmentHazard:
      "rotating shafts, presses, CNC equipment, conveyors, sharp tooling, hydraulic or pneumatic movement, and defective guards",
    interfaceHazard:
      "workers troubleshooting, cleaning, adjusting, or inspecting equipment while others continue production nearby",
    exposureHazard:
      "noise, vibration, metalworking fluids, sharp swarf, heat, dust, and awkward postures around equipment",
    emergencyHazard:
      "unexpected startup, emergency stop failure, jam clearing incident, entrapment, or delayed isolation of defective machinery",
    existingMeasures:
      "Machine guarding, lockout/tagout procedures, emergency stops, operator training, and planned inspection routines are available",
    specificControls:
      "apply lockout/tagout where required, inspect guards, test emergency stops, use competent operators, and prohibit bypassing safety devices",
    consequence:
      "Entanglement, amputation, crushing, electric shock, serious injury, fatality",
  },
  "Maintenance & Engineering": {
    people:
      "Maintenance technicians, engineers, contractors, production workers, supervisors",
    planningHazard:
      "can involve unplanned intervention, live services, stored energy, work at height, confined areas, hot work, and contractor interface risks",
    equipmentHazard:
      "electrical panels, hydraulic systems, pneumatic systems, tools, lifting aids, access equipment, and removed machine guards",
    interfaceHazard:
      "maintenance teams working beside live production areas, contractors, operators, mobile equipment, and restricted access zones",
    exposureHazard:
      "electrical exposure, burns, oil mist, sharp parts, manual handling, noise, poor access, heat, and fatigue",
    emergencyHazard:
      "unexpected energization, fire during hot work, rescue from height or confined space, release of stored pressure, or delayed contractor emergency response",
    existingMeasures:
      "Permit-to-work, maintenance planning, lockout/tagout, contractor induction, PPE, and supervisor coordination are used",
    specificControls:
      "isolate all energy sources, verify zero energy, use permits for high-risk tasks, control contractors, and reinstate guards before handover",
    consequence:
      "Electric shock, burns, crush injury, fall injury, fire, fatality",
  },
  "Materials & Chemical Handling": {
    people:
      "Production workers, chemical handlers, maintenance workers, cleaners, emergency responders",
    planningHazard:
      "can expose workers to incompatible substances, unclear labeling, poor storage, uncontrolled transfer, and insufficient chemical information",
    equipmentHazard:
      "containers, transfer pumps, compressed gas cylinders, mixing tools, spray equipment, spill pallets, and ventilation systems",
    interfaceHazard:
      "chemical handling near production workers, forklift routes, ignition sources, drains, and waste collection areas",
    exposureHazard:
      "skin contact, inhalation, dust exposure, solvent vapor, flammable atmospheres, chemical burns, and environmental release",
    emergencyHazard:
      "chemical spill, gas release, fire, exposure symptoms, blocked eyewash, or delayed access to safety data sheets",
    existingMeasures:
      "Safety data sheets, labeling, PPE, spill kits, ventilation, segregation, and chemical storage rules are available",
    specificControls:
      "segregate incompatible materials, minimize quantities, ventilate work areas, control ignition sources, and train workers in spill response",
    consequence:
      "Chemical burns, respiratory illness, fire, explosion, environmental harm, serious injury",
  },
  "Workplace Environment": {
    people:
      "Production workers, pedestrians, forklift operators, cleaners, visitors, emergency wardens",
    planningHazard:
      "can create exposure to poor housekeeping, moving vehicles, environmental stressors, blocked routes, and unclear emergency arrangements",
    equipmentHazard:
      "forklifts, cleaning equipment, ventilation systems, fire protection equipment, emergency doors, and housekeeping tools",
    interfaceHazard:
      "pedestrians moving through production areas, forklift interaction, emergency movements, and cleaning in active work zones",
    exposureHazard:
      "noise, heat stress, poor ventilation, slips, trips, manual handling, dust, and fatigue",
    emergencyHazard:
      "blocked evacuation routes, fire spread, poor alarm response, delayed first aid, or failure to control environmental hazards",
    existingMeasures:
      "Walkways, housekeeping rules, fire procedures, PPE, emergency drills, and workplace inspections are in place",
    specificControls:
      "keep routes clear, segregate vehicles and pedestrians, monitor exposure conditions, inspect fire controls, and close housekeeping actions promptly",
    consequence:
      "Slips, collisions, heat illness, hearing damage, fire, serious injury",
  },
};

const officeCategoryProfiles: Record<string, SmartSectorCategoryProfile> = {
  "Office Workstations": {
    people:
      "Office employees, remote workers, managers, temporary workers, workstation users",
    planningHazard:
      "can lead to poorly arranged workstations, unsuitable screen setup, prolonged static posture, and insufficient ergonomic adjustment",
    equipmentHazard:
      "display screens, keyboards, mice, chairs, desks, docking stations, document holders, and shared workstation equipment",
    interfaceHazard:
      "shared desks, hybrid work arrangements, poor reporting of discomfort, and workers adapting unsuitable workspaces",
    exposureHazard:
      "eye strain, neck and shoulder discomfort, repetitive strain, prolonged sitting, fatigue, and poor lighting",
    emergencyHazard:
      "delayed reporting of discomfort, workstation defects, remote worker isolation, or unresolved ergonomic issues becoming chronic",
    existingMeasures:
      "Basic workstation equipment, DSE guidance, manager support, and issue reporting routes are available",
    specificControls:
      "complete DSE assessments, adjust seating and screens, provide suitable accessories, encourage breaks, and review remote work setups",
    consequence:
      "Musculoskeletal disorder, eye strain, fatigue, discomfort, reduced wellbeing",
  },
  "Office Movement & Housekeeping": {
    people:
      "Office employees, visitors, cleaners, facilities staff, contractors",
    planningHazard:
      "can expose people to poor housekeeping, congested walkways, unmanaged storage, trailing cables, and unsuitable manual handling",
    equipmentHazard:
      "cables, storage cabinets, trolleys, archive boxes, cleaning tools, stairs, doors, and office furniture",
    interfaceHazard:
      "people moving through corridors, stairs, cleaning areas, storage rooms, and shared office spaces",
    exposureHazard:
      "slips, trips, falls, manual handling strain, falling stored items, and poor visibility",
    emergencyHazard:
      "blocked escape routes, delayed response to falls, cleaning-related slip incidents, or unreported building defects",
    existingMeasures:
      "Housekeeping standards, marked routes, cleaning coordination, storage rules, and defect reporting are in place",
    specificControls:
      "keep walkways clear, secure cables, manage storage heights, use safe carrying methods, and coordinate cleaning with occupancy",
    consequence:
      "Slips, trips, falls, strains, cuts, lost time injury",
  },
  "Facilities & Building Safety": {
    people:
      "Office employees, visitors, first aiders, fire wardens, facilities staff",
    planningHazard:
      "can involve unclear emergency roles, building system defects, insufficient visitor control, or unsafe use of shared facilities",
    equipmentHazard:
      "electrical appliances, printers, copiers, kitchen equipment, meeting room systems, first aid kits, alarms, and extinguishers",
    interfaceHazard:
      "employees, visitors, contractors, fire wardens, and first aiders sharing office facilities during routine and emergency situations",
    exposureHazard:
      "electric shock, burns, slips, indoor comfort issues, crowding, and poor emergency route awareness",
    emergencyHazard:
      "fire evacuation failure, blocked exits, first aid delay, emergency drill confusion, or visitor accountability gaps",
    existingMeasures:
      "Fire procedures, first aid arrangements, equipment checks, visitor sign-in, and facilities reporting processes are available",
    specificControls:
      "inspect emergency routes, test alarms, maintain appliances, brief visitors, keep kitchens tidy, and verify first aid supplies",
    consequence:
      "Burns, electric shock, slips, delayed evacuation, serious injury",
  },
  "Psychosocial & Organizational": {
    people:
      "Office employees, managers, supervisors, remote workers, client-facing staff",
    planningHazard:
      "can create unmanaged workload, poor role clarity, difficult communications, lone working, and insufficient support for new or fatigued workers",
    equipmentHazard:
      "communication systems, workload management tools, remote work equipment, and support channels that may be inadequate or unavailable",
    interfaceHazard:
      "workers interacting with managers, clients, colleagues, and remote teams under time pressure or conflict conditions",
    exposureHazard:
      "stress, fatigue, long screen time, poor recovery, isolation, and reduced concentration",
    emergencyHazard:
      "delayed escalation of stress concerns, lone worker incident, conflict escalation, or fatigue-related errors",
    existingMeasures:
      "Management support, reporting routes, onboarding processes, HR guidance, and communication channels are in place",
    specificControls:
      "monitor workload, encourage breaks, clarify expectations, support difficult interactions, check lone workers, and escalate wellbeing concerns early",
    consequence:
      "Stress-related illness, fatigue, reduced wellbeing, errors, absence",
  },
  "Office Maintenance & Support": {
    people:
      "Facilities staff, office employees, contractors, cleaners, visitors",
    planningHazard:
      "can expose occupants to maintenance work, contractor activity, furniture moves, waste handling, and building comfort concerns",
    equipmentHazard:
      "hand tools, ladders, lighting fittings, HVAC equipment, shredders, waste containers, and moved furniture",
    interfaceHazard:
      "contractors and support workers operating in occupied office areas near employees and visitors",
    exposureHazard:
      "manual handling, dust, noise, poor air quality, poor lighting, slips, and contact with moving furniture or equipment",
    emergencyHazard:
      "contractor incident, blocked routes, failed lighting or HVAC, waste fire risk, or delayed reporting of facility defects",
    existingMeasures:
      "Contractor controls, facilities tickets, waste processes, basic PPE, and office communication arrangements are used",
    specificControls:
      "segregate maintenance areas, schedule disruptive work, inspect ladders and tools, manage manual handling, and communicate temporary restrictions",
    consequence:
      "Strains, slips, cuts, poor indoor comfort, contractor injury, lost time injury",
  },
};

const healthcareCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Patient Care": {
    people:
      "Patients, nurses, healthcare assistants, clinicians, carers, visitors",
    planningHazard:
      "can expose staff and patients to unsafe patient movement, changing clinical conditions, aggression, infection status, and insufficient staffing or equipment",
    equipmentHazard:
      "beds, hoists, slings, wheelchairs, mobility aids, patient monitors, and patient care equipment",
    interfaceHazard:
      "staff, patients, visitors, and support teams interacting during care delivery, transfer, isolation, or emergency response",
    exposureHazard:
      "manual patient handling, blood or body fluids, slips, fatigue, emotional stress, and respiratory infection exposure",
    emergencyHazard:
      "patient deterioration, aggression, delayed clinical response, failed transfer equipment, or isolation breach",
    existingMeasures:
      "Care plans, patient handling guidance, PPE, clinical supervision, infection control procedures, and escalation routes are available",
    specificControls:
      "assess patient mobility and behavior, use suitable handling aids, maintain infection precautions, request assistance, and keep escalation routes clear",
    consequence:
      "Patient fall, staff injury, infection exposure, violence-related injury, serious harm",
  },
  "Clinical Procedures": {
    people:
      "Clinicians, nurses, patients, laboratory staff, cleaners, waste handlers",
    planningHazard:
      "can involve sharps, bloodborne pathogens, medication errors, contaminated equipment, and unclear clinical preparation",
    equipmentHazard:
      "needles, cannulas, sharps containers, medical devices, specimen containers, medication preparation tools, and clinical waste bins",
    interfaceHazard:
      "clinicians, patients, assistants, and waste handlers working around procedure areas and contaminated items",
    exposureHazard:
      "needlestick injury, blood or body fluid exposure, infection, chemical disinfectants, awkward posture, and patient movement",
    emergencyHazard:
      "sharps injury, medication incident, specimen spill, device malfunction, or delayed post-exposure response",
    existingMeasures:
      "Clinical procedures, sharps safety rules, PPE, hand hygiene, medication checks, and clinical waste segregation are in place",
    specificControls:
      "use aseptic technique, activate sharps safety devices, dispose of sharps immediately, label specimens, and follow post-exposure protocols",
    consequence:
      "Sharps injury, infection, medication error, patient harm, serious illness",
  },
  "Infection Prevention": {
    people:
      "Healthcare workers, patients, cleaners, laundry staff, visitors, waste handlers",
    planningHazard:
      "can expose people to infectious materials, contaminated surfaces, incorrect PPE use, and incomplete isolation or disinfection controls",
    equipmentHazard:
      "PPE, disinfectants, cleaning tools, laundry bags, clinical waste containers, spill kits, and isolation room equipment",
    interfaceHazard:
      "staff, patients, visitors, cleaners, and waste handlers moving between contaminated and clean areas",
    exposureHazard:
      "bloodborne pathogens, respiratory infection, contaminated laundry, chemical disinfectants, splash exposure, and poor hand hygiene",
    emergencyHazard:
      "infection control breach, body fluid spill, PPE failure, isolation waste incident, or delayed exposure reporting",
    existingMeasures:
      "Hand hygiene, PPE procedures, cleaning schedules, isolation protocols, waste segregation, and exposure reporting routes are established",
    specificControls:
      "follow transmission-based precautions, train PPE donning and doffing, use approved disinfectants, segregate waste, and report exposures immediately",
    consequence:
      "Infection transmission, occupational illness, chemical irritation, outbreak risk, patient harm",
  },
  "Laboratory & Diagnostic Work": {
    people:
      "Laboratory staff, clinicians, sample couriers, maintenance workers, cleaners",
    planningHazard:
      "can involve biological samples, chemical reagents, diagnostic equipment, time-sensitive testing, and sample identification controls",
    equipmentHazard:
      "centrifuges, microscopes, autoclaves, analyzers, freezers, calibration tools, sample racks, and laboratory waste containers",
    interfaceHazard:
      "sample handover between clinical areas, couriers, laboratory benches, diagnostic equipment, and waste collection points",
    exposureHazard:
      "biological exposure, chemical reagent contact, aerosols, repetitive microscope work, cold burns, and sharps or glass breakage",
    emergencyHazard:
      "sample spill, centrifuge failure, freezer alarm, autoclave burn, equipment calibration failure, or delayed exposure response",
    existingMeasures:
      "Laboratory procedures, PPE, biosafety controls, reagent labeling, equipment maintenance, and waste segregation are in place",
    specificControls:
      "verify sample labeling, use biosafety controls, balance centrifuges, inspect equipment, handle reagents under controls, and document calibration",
    consequence:
      "Biological exposure, chemical burns, infection, equipment failure, diagnostic delay",
  },
  "Facility & Support Services": {
    people:
      "Support staff, cleaners, porters, maintenance workers, security staff, patients, visitors",
    planningHazard:
      "can expose support teams to clinical area hazards, medical gases, waste movement, fire response, security incidents, and night shift pressures",
    equipmentHazard:
      "medical gas cylinders, cleaning machines, laundry equipment, food service equipment, waste carts, fire systems, and security devices",
    interfaceHazard:
      "support teams moving through patient areas, public areas, clinical zones, emergency routes, and back-of-house service areas",
    exposureHazard:
      "biological contamination, manual handling, slips, chemical disinfectants, fatigue, aggression, and poor lighting",
    emergencyHazard:
      "medical gas leak, fire, security incident, emergency evacuation difficulty, clinical waste spill, or delayed night shift response",
    existingMeasures:
      "Service procedures, PPE, manual handling guidance, emergency plans, waste segregation, security escalation, and supervision are available",
    specificControls:
      "secure cylinders, segregate waste, coordinate with clinical teams, maintain emergency routes, manage fatigue, and escalate security concerns promptly",
    consequence:
      "Infection exposure, cylinder impact, slips, manual handling injury, fire, serious injury",
  },
};

const oilGasCategoryProfiles: Record<string, SmartSectorCategoryProfile> = {
  "Drilling & Well Operations": {
    people:
      "Drilling crew, well services personnel, supervisors, contractors, emergency responders",
    planningHazard:
      "can involve high-pressure well control hazards, heavy tubular handling, dropped objects, rotating equipment, and changing well conditions",
    equipmentHazard:
      "top drives, drawworks, mud systems, casing tools, pressure test equipment, BOP components, wireline units, and cementing equipment",
    interfaceHazard:
      "rig floor crews, service contractors, crane operators, mud engineers, and supervisors working in tight high-energy zones",
    exposureHazard:
      "drilling mud exposure, hydrocarbons, H2S, noise, vibration, heat stress, manual handling, and fatigue from extended shifts",
    emergencyHazard:
      "well kick, blowout, pressure release, dropped object, fire, gas release, or delayed muster and emergency response",
    existingMeasures:
      "Permit-to-work, well control procedures, exclusion zones, gas monitoring, PPE, toolbox talks, and emergency response plans are in place",
    specificControls:
      "verify well control barriers, inspect lifting and pressure equipment, maintain dropped-object controls, monitor gas levels, and stop work during abnormal well conditions",
    consequence:
      "Explosion, fire, pressure release injury, toxic exposure, dropped object injury, fatality",
  },
  "Process & Production Operations": {
    people:
      "Process operators, production technicians, control room staff, maintenance workers, contractors",
    planningHazard:
      "can expose workers to process upset, hydrocarbon release, pressure systems, ignition sources, and unclear operating limits",
    equipmentHazard:
      "separators, pumps, compressors, valves, pipelines, tanks, gas detectors, flare systems, and utility equipment",
    interfaceHazard:
      "operators, maintenance workers, contractors, control room teams, and logistics personnel working around live process equipment",
    exposureHazard:
      "hydrocarbon vapor, H2S, noise, hot surfaces, pressure release, chemical additives, poor ventilation, and fatigue",
    emergencyHazard:
      "process alarm, gas detection, flare event, compressor trip, tank overfill, line rupture, or emergency shutdown failure",
    existingMeasures:
      "Operating procedures, alarms, gas detection, process isolation, inspection routines, PPE, and emergency shutdown systems are available",
    specificControls:
      "monitor process parameters, verify isolation and depressurization, control ignition sources, respond to gas alarms, and maintain clear communication with control room",
    consequence:
      "Hydrocarbon release, fire, explosion, toxic exposure, burns, serious injury",
  },
  "Maintenance & Shutdown": {
    people:
      "Maintenance technicians, shutdown crews, electricians, scaffolders, contractors, supervisors",
    planningHazard:
      "can involve simultaneous operations, incomplete isolation, confined spaces, hot work, work at height, and urgent repair pressure",
    equipmentHazard:
      "electrical systems, rotating equipment, instruments, scaffolds, pressure equipment, welding tools, and temporary access equipment",
    interfaceHazard:
      "maintenance teams, contractors, operations staff, permit issuers, and emergency repair crews working in shared shutdown areas",
    exposureHazard:
      "residual hydrocarbons, H2S, welding fumes, electrical energy, heat, noise, manual handling, and poor access",
    emergencyHazard:
      "isolation failure, fire during hot work, confined space rescue, dropped object, scaffold incident, or emergency repair escalation",
    existingMeasures:
      "Permit-to-work, isolation certificates, gas testing, toolbox talks, contractor controls, rescue planning, and PPE requirements are used",
    specificControls:
      "verify zero energy, test for gas, control simultaneous operations, supervise hot work, inspect access equipment, and keep rescue arrangements ready",
    consequence:
      "Fire, explosion, electric shock, confined space injury, fall injury, fatality",
  },
  "Chemical & Hazardous Materials": {
    people:
      "Chemical handlers, operators, maintenance workers, waste handlers, emergency responders",
    planningHazard:
      "can involve hazardous substances, H2S exposure, hydrocarbon sampling, incompatible chemicals, poor storage, and transfer failures",
    equipmentHazard:
      "chemical injection skids, fuel hoses, sample points, gas cylinders, tanks, spill kits, waste containers, and containment systems",
    interfaceHazard:
      "workers handling hazardous substances near live process areas, drains, ignition sources, transport routes, and storage areas",
    exposureHazard:
      "toxic gas, corrosive chemicals, hydrocarbon vapor, flammable liquids, skin contact, inhalation, and environmental contamination",
    emergencyHazard:
      "H2S alarm, fuel spill, chemical splash, gas cylinder leak, hydrocarbon release, fire, or delayed decontamination",
    existingMeasures:
      "Safety data sheets, gas detection, chemical labeling, bunding, PPE, spill response equipment, and hazardous waste procedures are in place",
    specificControls:
      "segregate incompatible materials, use closed transfer where possible, control ignition sources, wear substance-specific PPE, and escalate gas or spill events immediately",
    consequence:
      "Toxic exposure, chemical burns, fire, explosion, environmental harm, fatality",
  },
  "Marine & Logistics": {
    people:
      "Deck crew, crane operators, riggers, forklift operators, pilots, vessel crew, offshore personnel",
    planningHazard:
      "can involve offshore transfer, lifting over water, marine movements, aircraft interface, night work, and emergency evacuation complexity",
    equipmentHazard:
      "cranes, lifting accessories, forklifts, helideck equipment, vessels, gangways, lifeboats, lifejackets, and radios",
    interfaceHazard:
      "personnel transferring between vessels, helidecks, decks, laydown areas, material routes, and emergency stations",
    exposureHazard:
      "dropped objects, sea state, weather, poor visibility, fatigue, slips on wet decks, noise, and manual handling",
    emergencyHazard:
      "man overboard, helicopter incident, vessel collision, failed evacuation drill, lifeboat fault, or delayed offshore rescue",
    existingMeasures:
      "Lift plans, helideck procedures, vessel transfer rules, emergency drills, PPE, radios, and permit controls are used",
    specificControls:
      "confirm weather limits, inspect lifting gear, control deck exclusion zones, brief transfer routes, verify lifesaving equipment, and maintain radio communication",
    consequence:
      "Dropped object injury, drowning, collision, fall overboard, serious injury, fatality",
  },
};

const miningCategoryProfiles: Record<string, SmartSectorCategoryProfile> = {
  "Surface Mining Operations": {
    people:
      "Equipment operators, drill crews, shotfirers, supervisors, surveyors, maintenance workers",
    planningHazard:
      "can expose workers to unstable ground, blasting areas, heavy mobile equipment, slope hazards, and changing ground conditions",
    equipmentHazard:
      "excavators, haul trucks, loaders, bulldozers, drills, breakers, stockpile equipment, and dumping area controls",
    interfaceHazard:
      "heavy vehicles, light vehicles, pedestrians, blast crews, spotters, and maintenance teams sharing mine traffic areas",
    exposureHazard:
      "silica dust, noise, vibration, heat, poor visibility, fatigue, and manual handling around ground operations",
    emergencyHazard:
      "vehicle collision, rockfall, slope failure, misfire, stockpile collapse, or delayed rescue in remote pit areas",
    existingMeasures:
      "Traffic management plans, blast permits, exclusion zones, operator training, PPE, and supervisor inspections are in place",
    specificControls:
      "maintain exclusion zones, inspect ground conditions, use positive communication, control vehicle speeds, monitor dust, and stop work near unstable faces",
    consequence:
      "Rockfall injury, vehicle collision, crushing, silica exposure, serious injury, fatality",
  },
  "Underground Mining": {
    people:
      "Underground miners, drillers, maintenance workers, ventilation technicians, supervisors, emergency responders",
    planningHazard:
      "can involve confined underground atmospheres, ground instability, restricted access, poor visibility, and limited emergency escape options",
    equipmentHazard:
      "drilling rigs, support systems, underground vehicles, ventilation fans, pumps, refuge equipment, and explosive handling equipment",
    interfaceHazard:
      "miners, vehicles, maintenance crews, ventilation teams, explosive handlers, and emergency responders operating in restricted tunnels",
    exposureHazard:
      "oxygen deficiency, diesel emissions, silica dust, heat, noise, vibration, water ingress, and fatigue",
    emergencyHazard:
      "ground fall, ventilation failure, fire, flooding, explosive incident, refuge activation, or delayed underground rescue",
    existingMeasures:
      "Ground control plans, ventilation monitoring, refuge chambers, communication systems, permits, PPE, and emergency plans are available",
    specificControls:
      "verify ground support, monitor ventilation, control vehicle movements, maintain communications, inspect escape routes, and follow explosive handling procedures",
    consequence:
      "Entrapment, asphyxiation, rockfall injury, fire, flooding, fatality",
  },
  "Processing Plant Operations": {
    people:
      "Plant operators, maintenance workers, sampling technicians, supervisors, contractors",
    planningHazard:
      "can expose workers to moving conveyors, crushers, screens, mills, chemical processes, dust, and tailings systems",
    equipmentHazard:
      "crushers, screens, conveyors, transfer points, mills, pumps, flotation cells, samplers, and dust suppression systems",
    interfaceHazard:
      "operators, maintenance teams, samplers, contractors, and mobile equipment working around processing lines and transfer points",
    exposureHazard:
      "silica dust, noise, vibration, chemical reagents, slurry, wet floors, manual handling, and poor visibility",
    emergencyHazard:
      "conveyor entanglement, crusher blockage, chemical spill, tailings release, dust suppression failure, or isolation failure",
    existingMeasures:
      "Machine guards, lockout/tagout, dust suppression, chemical controls, operating procedures, and PPE are in place",
    specificControls:
      "keep guards fitted, isolate before clearing blockages, monitor dust controls, segregate sampling areas, and inspect tailings controls",
    consequence:
      "Entanglement, crushing, respiratory illness, chemical exposure, serious injury",
  },
  "Maintenance & Engineering": {
    people:
      "Maintenance technicians, electricians, welders, tire fitters, riggers, contractors, supervisors",
    planningHazard:
      "can involve heavy equipment energy, shutdown pressure, lifting hazards, hot work, electrical systems, and isolation failure",
    equipmentHazard:
      "haul trucks, conveyors, electrical panels, hydraulic systems, tires, lifting gear, welding tools, and access equipment",
    interfaceHazard:
      "maintenance teams, production operators, contractors, riggers, and mobile plant interacting during repairs and shutdowns",
    exposureHazard:
      "stored energy, hydraulic pressure, hot surfaces, welding fumes, noise, manual handling, working at height, and fatigue",
    emergencyHazard:
      "unexpected startup, tire explosion, hydraulic injection injury, dropped load, fire, fall, or delayed remote-area rescue",
    existingMeasures:
      "Maintenance procedures, lockout/tagout, lift plans, hot work permits, PPE, and competent supervision are used",
    specificControls:
      "verify isolation, release stored energy, inspect lifting gear, control hot work, deflate and restrain tires safely, and maintain exclusion zones",
    consequence:
      "Crush injury, electric shock, burns, hydraulic injection, fall injury, fatality",
  },
  "Health, Safety & Environment": {
    people:
      "Mine workers, HSE personnel, emergency responders, contractors, environmental technicians",
    planningHazard:
      "can involve high exposure environments, explosive storage, slope monitoring, remote work, emergency drills, and environmental response",
    equipmentHazard:
      "monitoring instruments, emergency equipment, spill kits, fuel systems, explosive magazines, radios, and environmental controls",
    interfaceHazard:
      "workers, supervisors, emergency teams, fuel handlers, environmental staff, and lone workers operating across remote mine areas",
    exposureHazard:
      "silica dust, noise, heat stress, fuel vapors, hazardous chemicals, fatigue, isolation, and poor weather",
    emergencyHazard:
      "slope failure, explosive incident, fuel spill, heat illness, remote worker emergency, or delayed emergency response",
    existingMeasures:
      "Monitoring programs, emergency plans, exposure controls, PPE, radio communication, and environmental response procedures are in place",
    specificControls:
      "monitor exposure limits, inspect explosive and chemical storage, verify communications, manage fatigue, and keep emergency equipment accessible",
    consequence:
      "Occupational illness, explosion, environmental harm, heat illness, serious injury, fatality",
  },
};

const foodProductionCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Food Processing Operations": {
    people:
      "Food production workers, line operators, quality inspectors, supervisors, cleaners",
    planningHazard:
      "can expose workers to fast-moving production lines, sharp tools, hot processes, ingredient handling, contamination controls, and repetitive work",
    equipmentHazard:
      "mixers, slicers, ovens, packaging machines, bottling lines, labeling equipment, utensils, and inspection equipment",
    interfaceHazard:
      "operators, cleaners, quality staff, maintenance teams, and material handlers working around active food lines",
    exposureHazard:
      "cuts, burns, steam, wet floors, repetitive movement, manual handling, allergens, biological contamination, and cold or hot environments",
    emergencyHazard:
      "machine jam, burn incident, contamination event, allergen mix-up, product spill, or delayed line stop response",
    existingMeasures:
      "Food safety procedures, machine guards, hygiene rules, PPE, line supervision, and quality checks are in place",
    specificControls:
      "keep guards fitted, use cut-resistant PPE where needed, control allergens, maintain hygiene zoning, and stop lines for unsafe conditions",
    consequence:
      "Cuts, burns, entanglement, slips, food contamination, serious injury",
  },
  "Machinery & Equipment": {
    people:
      "Machine operators, maintenance workers, sanitation workers, engineers, supervisors",
    planningHazard:
      "can involve machinery entanglement, lockout/tagout failure, steam or refrigeration systems, pressure systems, and sanitation access needs",
    equipmentHazard:
      "conveyors, mixers, filling machines, refrigeration systems, boilers, steam lines, guards, controls, and isolation points",
    interfaceHazard:
      "operators, cleaners, maintenance teams, and quality staff working near equipment during production, cleaning, and maintenance",
    exposureHazard:
      "moving parts, pinch points, hot surfaces, cold burns, steam, noise, wet floors, and chemical residues",
    emergencyHazard:
      "unexpected startup, ammonia or refrigerant leak, steam release, boiler fault, machine entrapment, or emergency stop failure",
    existingMeasures:
      "Machine guarding, lockout/tagout, preventive maintenance, operating procedures, emergency stops, and PPE requirements are used",
    specificControls:
      "verify isolation before cleaning or maintenance, inspect guards, test emergency stops, control steam and refrigeration hazards, and train authorized workers",
    consequence:
      "Entanglement, crushing, burns, refrigerant exposure, pressure release injury, fatality",
  },
  "Hygiene & Sanitation": {
    people:
      "Sanitation workers, production workers, cleaners, pest control contractors, quality staff",
    planningHazard:
      "can expose workers to sanitation chemicals, high-pressure cleaning, wet floors, contamination control failures, and contractor interface risks",
    equipmentHazard:
      "disinfectants, pressure washers, cleaning tools, drains, waste bins, pest control materials, laundry bags, and spill kits",
    interfaceHazard:
      "cleaners, production workers, quality teams, contractors, and waste handlers moving between hygiene zones",
    exposureHazard:
      "chemical splash, inhalation, biological residues, slips, ergonomic strain, high-pressure injection injury, and allergen cross-contact",
    emergencyHazard:
      "chemical spill, splash injury, contamination incident, pest control exposure, blocked drains, or delayed sanitation verification",
    existingMeasures:
      "Cleaning schedules, chemical instructions, PPE, food safety controls, waste segregation, and hygiene procedures are in place",
    specificControls:
      "dilute chemicals correctly, segregate wet areas, protect drains, verify sanitation release, coordinate pest control, and prevent cross-contamination",
    consequence:
      "Chemical burns, slips, biological exposure, food contamination, serious injury",
  },
  "Storage & Logistics": {
    people:
      "Warehouse workers, forklift operators, delivery drivers, cold store workers, dispatch staff",
    planningHazard:
      "can involve cold storage, vehicle movements, unstable pallets, allergen segregation, delivery pressure, and temperature-controlled goods",
    equipmentHazard:
      "forklifts, pallet trucks, cold rooms, chargers, loading docks, containers, racking, and delivery vehicles",
    interfaceHazard:
      "forklifts, pedestrians, delivery drivers, warehouse teams, quality inspectors, and dispatch workers sharing storage and dock areas",
    exposureHazard:
      "cold stress, slips on wet or icy floors, manual handling, falling goods, battery charging hazards, and poor visibility",
    emergencyHazard:
      "cold room entrapment, load collapse, dock incident, battery fire, temperature excursion, or delayed product quarantine",
    existingMeasures:
      "Traffic routes, cold store procedures, racking controls, temperature checks, PPE, and loading bay rules are in place",
    specificControls:
      "segregate pedestrians and forklifts, control dock movements, inspect pallets, maintain cold room escape systems, and protect temperature-critical stock",
    consequence:
      "Collision, crush injury, cold stress, slips, product loss, serious injury",
  },
  "Quality & Laboratory": {
    people:
      "Quality technicians, laboratory staff, production workers, maintenance workers, supervisors",
    planningHazard:
      "can involve sampling, allergen controls, laboratory reagents, glass or brittle plastic inspection, calibration, and traceability requirements",
    equipmentHazard:
      "laboratory instruments, reagents, sampling tools, thermometers, metal detectors, calibration weights, and documentation systems",
    interfaceHazard:
      "quality staff collecting samples from live production areas and coordinating with operators, laboratory teams, and supervisors",
    exposureHazard:
      "chemical reagent contact, allergen exposure, biological samples, repetitive bench work, cuts from glass, and slips near production lines",
    emergencyHazard:
      "allergen cross-contact, foreign body incident, failed metal detector challenge, reagent spill, temperature deviation, or traceability failure",
    existingMeasures:
      "Quality procedures, sampling plans, allergen controls, calibration schedules, PPE, and documentation systems are available",
    specificControls:
      "label samples clearly, segregate allergens, control glass and brittle plastic, verify detector checks, calibrate equipment, and escalate nonconforming product",
    consequence:
      "Allergic reaction, food safety incident, chemical exposure, cuts, product recall risk",
  },
};

const hospitalityCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Kitchen & Food Preparation": {
    people:
      "Chefs, kitchen assistants, dishwashers, cleaners, supervisors, delivery staff",
    planningHazard:
      "can expose workers to hot equipment, sharp tools, fast-paced food preparation, wet floors, and food hygiene pressures",
    equipmentHazard:
      "knives, slicers, fryers, ovens, grills, dishwashers, cold rooms, waste bins, and cleaning tools",
    interfaceHazard:
      "kitchen staff, cleaners, delivery workers, and supervisors moving through confined hot kitchen areas",
    exposureHazard:
      "burns, hot oil splash, cuts, steam, slips, repetitive tasks, manual handling, cold exposure, and biological contamination",
    emergencyHazard:
      "fryer fire, serious cut, burn incident, cold room entrapment, food contamination event, or delayed first aid",
    existingMeasures:
      "Kitchen procedures, food hygiene rules, PPE, machine guards, cleaning schedules, and supervisor oversight are in place",
    specificControls:
      "use cut-resistant controls where needed, keep wet floors controlled, manage hot oil safely, inspect cold room access, and separate clean and dirty workflows",
    consequence:
      "Cuts, burns, slips, food contamination, manual handling injury, serious injury",
  },
  "Restaurant & Service Operations": {
    people:
      "Servers, bartenders, hosts, cashiers, catering staff, customers, supervisors",
    planningHazard:
      "can involve high customer traffic, hot food and drink service, manual carrying, glass handling, cash handling, and event pressure",
    equipmentHazard:
      "trays, glassware, coffee machines, beverage equipment, buffet tables, cash registers, bar tools, and temporary catering equipment",
    interfaceHazard:
      "staff, customers, visitors, event teams, and contractors interacting in dining, bar, buffet, and service areas",
    exposureHazard:
      "slips from spills, burns from hot drinks, cuts from glass, repetitive carrying, fatigue, and customer aggression",
    emergencyHazard:
      "customer incident, glass breakage, allergic reaction, spill-related fall, cash security incident, or delayed emergency response during events",
    existingMeasures:
      "Service procedures, spill response, hygiene rules, supervision, cash handling controls, and customer service escalation routes are available",
    specificControls:
      "clean spills promptly, control glass breakage, manage customer conflict, limit tray loads, brief event staff, and keep service routes clear",
    consequence:
      "Slips, burns, cuts, strains, stress, customer-related injury",
  },
  "Housekeeping & Cleaning": {
    people:
      "Housekeepers, cleaners, laundry workers, guests, supervisors, maintenance staff",
    planningHazard:
      "can expose workers to room hazards, cleaning chemicals, repetitive bed making, laundry loads, sharps, waste, and biological contamination",
    equipmentHazard:
      "cleaning carts, chemicals, vacuum cleaners, laundry machines, linen bags, waste containers, and disinfection supplies",
    interfaceHazard:
      "housekeeping teams, guests, maintenance workers, and supervisors moving through rooms, corridors, laundry areas, and service lifts",
    exposureHazard:
      "chemical splash, biological exposure, sharps injury, ergonomic strain, slips, trips, dust, and repetitive movement",
    emergencyHazard:
      "chemical exposure, sharps injury, aggressive guest encounter, blocked corridor, or delayed reporting of room hazards",
    existingMeasures:
      "Cleaning procedures, chemical labels, PPE, linen handling rules, waste controls, and incident reporting routes are in place",
    specificControls:
      "segregate chemicals, inspect rooms before cleaning, use safe sharps procedures, rotate repetitive tasks, and keep carts clear of escape routes",
    consequence:
      "Chemical irritation, sharps injury, strains, slips, infection exposure, lost time injury",
  },
  "Maintenance & Facility Operations": {
    people:
      "Maintenance staff, contractors, cleaners, guests, pool attendants, supervisors",
    planningHazard:
      "can involve occupied guest areas, electrical systems, HVAC, pool chemicals, work at height, contractors, and emergency equipment checks",
    equipmentHazard:
      "hand tools, ladders, electrical equipment, HVAC systems, pool dosing equipment, fire systems, pest control materials, and lifting aids",
    interfaceHazard:
      "maintenance staff and contractors working near guests, public routes, housekeeping teams, and occupied hotel facilities",
    exposureHazard:
      "electric shock, chemical exposure, falls from height, manual handling, noise, dust, slips, and heat",
    emergencyHazard:
      "fire system defect, pool chemical incident, electrical fault, fall from height, contractor incident, or evacuation drill failure",
    existingMeasures:
      "Maintenance procedures, contractor controls, fire inspection routines, PPE, permits, and guest area communication are used",
    specificControls:
      "segregate work areas, isolate electrical equipment, control pool chemicals, inspect access equipment, brief contractors, and communicate guest restrictions",
    consequence:
      "Electric shock, chemical burns, fall injury, fire, guest injury, serious injury",
  },
  "Hotel & Guest Safety": {
    people:
      "Reception staff, security staff, night workers, guests, visitors, delivery drivers, cleaners",
    planningHazard:
      "can involve public access, lone working, aggressive guests, slippery floors, deliveries, parking areas, and emergency evacuation complexity",
    equipmentHazard:
      "reception systems, security devices, elevators, parking equipment, cleaning tools, delivery trolleys, and fire alarm systems",
    interfaceHazard:
      "guests, staff, delivery drivers, security teams, contractors, and visitors interacting in public areas and entrances",
    exposureHazard:
      "stress, fatigue, customer aggression, slips, manual handling, vehicle movement, poor lighting, and lone working risk",
    emergencyHazard:
      "fire emergency, security incident, guest medical event, elevator fault, parking incident, or delayed night shift response",
    existingMeasures:
      "Guest safety procedures, security escalation, emergency plans, reception controls, cleaning response, and incident reporting are available",
    specificControls:
      "maintain public area inspections, support lone workers, manage aggressive behavior, control deliveries, keep exits clear, and verify emergency communication",
    consequence:
      "Slips, violence-related injury, stress, fire exposure, vehicle incident, serious injury",
  },
};

const retailCategoryProfiles: Record<string, SmartSectorCategoryProfile> = {
  "Store Operations": {
    people:
      "Retail workers, cashiers, supervisors, customers, merchandisers, visitors",
    planningHazard:
      "can expose workers and customers to crowded aisles, manual handling, repetitive tasks, customer interaction, and display setup pressures",
    equipmentHazard:
      "shelving, display stands, price guns, tills, shopping carts, promotional fixtures, and stock handling tools",
    interfaceHazard:
      "staff, customers, merchandisers, cleaners, and supervisors moving through sales floors, queues, and promotional areas",
    exposureHazard:
      "slips, trips, strains, repetitive movement, cuts from packaging, fatigue, and customer aggression",
    emergencyHazard:
      "customer incident, falling stock, blocked exit, queue crowding, cash security issue, or delayed first aid",
    existingMeasures:
      "Store procedures, manual handling guidance, housekeeping routines, supervision, customer service escalation, and first aid arrangements are in place",
    specificControls:
      "keep aisles clear, limit manual loads, secure displays, manage queues, report damaged fixtures, and escalate aggressive behavior early",
    consequence:
      "Slips, strains, cuts, falling stock injury, stress, lost time injury",
  },
  "Storage & Backroom": {
    people:
      "Stockroom staff, delivery drivers, forklift operators, supervisors, contractors",
    planningHazard:
      "can involve congested stockrooms, unstable pallets, ladder access, delivery pressure, compactors, and battery charging hazards",
    equipmentHazard:
      "pallets, ladders, forklifts, pallet trucks, compactors, chargers, racking, delivery cages, and waste handling equipment",
    interfaceHazard:
      "stock handlers, delivery drivers, forklift operators, waste contractors, and sales staff sharing backroom and dock areas",
    exposureHazard:
      "manual handling, falling goods, ladder falls, crush points, electrical charging hazards, slips, and poor housekeeping",
    emergencyHazard:
      "load collapse, compactor incident, battery fire, delivery vehicle incident, blocked stockroom route, or delayed emergency access",
    existingMeasures:
      "Backroom rules, delivery procedures, racking controls, manual handling guidance, PPE, and housekeeping inspections are used",
    specificControls:
      "segregate pedestrians and equipment, inspect ladders and pallets, control compactor use, keep charging areas ventilated, and maintain clear exits",
    consequence:
      "Crush injury, fall injury, strains, fire, electric shock, serious injury",
  },
  "Cleaning & Maintenance": {
    people:
      "Cleaners, facilities staff, retail workers, contractors, customers, visitors",
    planningHazard:
      "can expose public areas to wet floors, cleaning chemicals, maintenance tools, contractor work, and building service defects",
    equipmentHazard:
      "cleaning machines, chemicals, ladders, lighting equipment, HVAC systems, tools, restroom supplies, and waste containers",
    interfaceHazard:
      "cleaners, customers, contractors, staff, and facilities teams working in occupied retail areas",
    exposureHazard:
      "slips on wet floors, chemical contact, dust, electrical exposure, manual handling, poor lighting, and public interaction",
    emergencyHazard:
      "chemical spill, fall in public area, lighting failure, contractor incident, escalator cleaning interface, or blocked emergency route",
    existingMeasures:
      "Cleaning schedules, wet floor controls, contractor sign-in, maintenance reporting, PPE, and public area inspections are in place",
    specificControls:
      "segregate cleaning zones, use correct chemical dilution, schedule maintenance safely, supervise contractors, and close defects promptly",
    consequence:
      "Slips, chemical irritation, electric shock, cuts, customer injury, lost time injury",
  },
  "Security & Emergency": {
    people:
      "Retail workers, security officers, customers, visitors, first aiders, emergency responders",
    planningHazard:
      "can involve theft prevention, aggressive customers, lone working, crowd movement, emergency evacuation, and incident response pressure",
    equipmentHazard:
      "radios, CCTV systems, alarms, barriers, first aid kits, fire equipment, security doors, and parking controls",
    interfaceHazard:
      "security staff, customers, store teams, emergency responders, and public crowds interacting during incidents",
    exposureHazard:
      "violence, stress, fatigue, slips during evacuation, crowd pressure, poor visibility, and vehicle movement in parking areas",
    emergencyHazard:
      "fire alarm, violence incident, medical event, crowd surge, parking lot incident, or delayed emergency communication",
    existingMeasures:
      "Emergency plans, security procedures, first aid cover, fire drills, incident reporting, and communication systems are available",
    specificControls:
      "avoid unsafe confrontation, call support early, keep exits clear, brief staff on evacuation roles, manage crowds, and document incidents",
    consequence:
      "Violence-related injury, stress, crowd injury, fire exposure, serious injury",
  },
  "Commercial Facility Operations": {
    people:
      "Facilities staff, tenants, cleaners, contractors, customers, delivery drivers, event teams",
    planningHazard:
      "can involve multi-tenant public areas, delivery docks, escalators, events, temporary barricades, signage work, and night cleaning",
    equipmentHazard:
      "elevators, escalators, barriers, signs, cleaning machines, dock equipment, event fixtures, tools, and access equipment",
    interfaceHazard:
      "public users, tenants, contractors, delivery drivers, cleaners, and event teams sharing commercial facility spaces",
    exposureHazard:
      "slips, trips, falls, manual handling, electrical hazards, cleaning chemical exposure, crowding, and vehicle interface",
    emergencyHazard:
      "escalator incident, public area fire, dock collision, event crowd issue, contractor incident, or night cleaning emergency",
    existingMeasures:
      "Facility procedures, contractor controls, public area inspections, emergency plans, signage, and tenant communication are in place",
    specificControls:
      "coordinate tenant and contractor work, inspect public routes, control event setups, segregate docks, maintain barricades, and verify night worker communication",
    consequence:
      "Public injury, slips, collision, fire, contractor injury, serious injury",
  },
};

const educationCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Classroom & Teaching Activities": {
    people:
      "Teachers, students, teaching assistants, trainers, visitors, support staff",
    planningHazard:
      "can involve student supervision, classroom setup, equipment use, practical demonstrations, screen-based teaching, and changing classroom conditions",
    equipmentHazard:
      "computers, audio-visual equipment, classroom furniture, art tools, PE equipment, practical teaching aids, and electrical leads",
    interfaceHazard:
      "students, teachers, assistants, visitors, and support staff interacting in classrooms, labs, workshops, and online teaching environments",
    exposureHazard:
      "slips, trips, ergonomic strain, eye strain, student behavior risks, minor cuts, noise, and stress",
    emergencyHazard:
      "student injury, equipment fault, behavior escalation, fire alarm disruption, or delayed emergency communication",
    existingMeasures:
      "Classroom rules, supervision procedures, equipment checks, safeguarding arrangements, first aid routes, and teaching plans are in place",
    specificControls:
      "brief students, keep routes clear, inspect teaching equipment, supervise practical work closely, manage behavior early, and report defects",
    consequence:
      "Slips, minor injury, stress, ergonomic discomfort, student injury, lost time injury",
  },
  "Student & Public Areas": {
    people:
      "Students, teachers, visitors, cleaners, cafeteria staff, transport coordinators",
    planningHazard:
      "can expose people to crowded movement, stair use, playground activities, transport interface, events, visitors, and emergency drill conditions",
    equipmentHazard:
      "stairs, playground equipment, cafeteria equipment, transport barriers, event fixtures, cleaning tools, and visitor management systems",
    interfaceHazard:
      "students, staff, visitors, transport providers, cleaners, and event teams sharing public and circulation areas",
    exposureHazard:
      "slips, trips, falls, crowding, student behavior, food service burns, vehicle movement, and poor weather",
    emergencyHazard:
      "evacuation delay, playground injury, transport incident, crowd surge, visitor security issue, or delayed first aid",
    existingMeasures:
      "Supervision plans, visitor controls, transport procedures, cleaning coordination, emergency drills, and first aid arrangements are used",
    specificControls:
      "position supervisors visibly, keep corridors clear, control stairs and crossings, inspect playgrounds, brief visitors, and maintain evacuation routes",
    consequence:
      "Falls, crowd injury, vehicle incident, burns, student injury, serious injury",
  },
  "Laboratories & Workshops": {
    people:
      "Students, teachers, laboratory technicians, workshop instructors, maintenance staff",
    planningHazard:
      "can involve chemicals, biological materials, workshop machinery, welding, electrical training, gas cylinders, tools, and PPE compliance",
    equipmentHazard:
      "laboratory glassware, chemicals, biological samples, workshop machines, welding sets, electrical training boards, tools, and gas cylinders",
    interfaceHazard:
      "students, teachers, technicians, and support staff working closely during practical experiments and workshop demonstrations",
    exposureHazard:
      "chemical contact, biological exposure, cuts, burns, electric shock, fumes, noise, dust, and eye injury",
    emergencyHazard:
      "chemical spill, fire, gas leak, tool injury, electrical incident, PPE failure, or delayed first aid during practical sessions",
    existingMeasures:
      "Risk assessments, supervision ratios, PPE rules, safety data sheets, machine guards, and emergency equipment are available",
    specificControls:
      "pre-brief practical tasks, control hazardous substances, inspect tools and guards, supervise high-risk activities, and segregate waste correctly",
    consequence:
      "Chemical burns, cuts, electric shock, fire, biological exposure, serious injury",
  },
  "Maintenance & Facility Management": {
    people:
      "Facilities staff, cleaners, contractors, teachers, students, visitors",
    planningHazard:
      "can involve occupied buildings, electrical work, HVAC, cleaning, groundskeeping, contractor activity, work at height, and manual handling",
    equipmentHazard:
      "tools, ladders, electrical panels, HVAC units, cleaning machines, groundskeeping equipment, waste containers, and fire systems",
    interfaceHazard:
      "facilities staff and contractors working near students, teachers, visitors, public routes, and active learning areas",
    exposureHazard:
      "electric shock, slips, dust, noise, manual handling, work at height, cleaning chemicals, and vehicle or groundskeeping equipment interaction",
    emergencyHazard:
      "contractor incident, blocked exit, fire system defect, fall from height, equipment failure, or delayed defect reporting",
    existingMeasures:
      "Facilities procedures, contractor supervision, permits where required, PPE, fire inspections, and maintenance reporting systems are used",
    specificControls:
      "segregate work areas from students, schedule disruptive work safely, inspect access equipment, supervise contractors, and keep emergency routes available",
    consequence:
      "Falls, electric shock, strains, contractor injury, fire risk, serious injury",
  },
  "Administrative & Support Operations": {
    people:
      "Administrative staff, reception staff, teachers, support workers, visitors, first aiders",
    planningHazard:
      "can involve office ergonomics, reception interactions, lone working, security monitoring, workload pressure, first aid response, and document handling",
    equipmentHazard:
      "display screens, printers, copiers, filing cabinets, reception systems, security monitors, first aid kits, and office furniture",
    interfaceHazard:
      "staff, students, parents, visitors, security personnel, and first aiders interacting through reception and support areas",
    exposureHazard:
      "ergonomic strain, eye strain, stress, manual handling, paper cuts, toner exposure, lone working, and difficult public interactions",
    emergencyHazard:
      "visitor security concern, first aid incident, workload stress escalation, lone worker emergency, or documentation failure during an incident",
    existingMeasures:
      "Office procedures, DSE guidance, visitor management, first aid arrangements, security protocols, and workload reporting routes are available",
    specificControls:
      "complete workstation checks, manage visitor access, support lone workers, escalate stress concerns, store documents safely, and verify first aid readiness",
    consequence:
      "Musculoskeletal discomfort, stress, security incident, manual handling injury, delayed first aid",
  },
};

const energyUtilitiesCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Electrical Power Operations": {
    people:
      "Electrical technicians, utility engineers, switching operators, contractors, emergency repair crews",
    planningHazard:
      "can expose workers to live electrical systems, stored energy, switching errors, inadequate isolation, and emergency restoration pressure",
    equipmentHazard:
      "substations, transformers, switchgear, cables, overhead lines, test instruments, grounding equipment, and lockout devices",
    interfaceHazard:
      "utility crews, contractors, control room staff, public users, and emergency responders working around energized infrastructure",
    exposureHazard:
      "electric shock, arc flash, burns, electromagnetic exposure concerns, weather, work at height, and fatigue",
    emergencyHazard:
      "arc flash event, electric shock, equipment fire, emergency restoration fault, public exposure, or delayed isolation",
    existingMeasures:
      "Electrical safety rules, switching procedures, permits, lockout/tagout, PPE, test equipment, and competent supervision are in place",
    specificControls:
      "verify isolation and earthing, apply arc flash boundaries, use rated PPE and tools, control switching authorization, and stop work during unsafe conditions",
    consequence:
      "Electric shock, arc flash burns, fire, fall injury, serious injury, fatality",
  },
  "Water & Wastewater Utilities": {
    people:
      "Water treatment operators, wastewater workers, samplers, maintenance crews, contractors",
    planningHazard:
      "can involve confined spaces, biological contamination, chemical dosing, chlorine systems, pump stations, and wet utility chambers",
    equipmentHazard:
      "pumps, valves, treatment tanks, dosing systems, chlorine equipment, manholes, sampling tools, and ventilation equipment",
    interfaceHazard:
      "operators, contractors, samplers, maintenance workers, and public users around chambers, treatment areas, and access roads",
    exposureHazard:
      "chlorine exposure, sewage pathogens, H2S, low oxygen, slips, manual handling, wet surfaces, and chemical contact",
    emergencyHazard:
      "chlorine release, confined space rescue, pump failure, sewage overflow, manhole incident, or delayed emergency communication",
    existingMeasures:
      "Confined space procedures, gas testing, PPE, hygiene rules, chemical controls, and emergency response procedures are available",
    specificControls:
      "test atmospheres, ventilate chambers, use rescue plans, control chlorine handling, maintain hygiene, and segregate public access",
    consequence:
      "Toxic exposure, infection, asphyxiation, slips, chemical burns, fatality",
  },
  "Gas & District Energy": {
    people:
      "Gas technicians, district heating workers, boiler operators, maintenance crews, contractors, public users",
    planningHazard:
      "can involve gas release, pressure systems, hot tapping, steam lines, boiler rooms, emergency shutdowns, and ignition sources",
    equipmentHazard:
      "pipelines, regulators, meters, boilers, steam lines, pressure test equipment, valves, and gas detection instruments",
    interfaceHazard:
      "field crews, plant operators, contractors, control room teams, customers, and public users near live energy infrastructure",
    exposureHazard:
      "flammable gas, steam burns, pressure release, hot surfaces, confined plant rooms, noise, and poor ventilation",
    emergencyHazard:
      "gas leak, fire, explosion, steam release, pressure regulator failure, boiler fault, or emergency shutdown failure",
    existingMeasures:
      "Gas safety procedures, pressure controls, gas detection, isolation plans, permits, PPE, and emergency response plans are in place",
    specificControls:
      "monitor gas levels, verify pressure isolation, control ignition sources, use pressure-rated equipment, ventilate work areas, and communicate emergency shutdown steps",
    consequence:
      "Fire, explosion, burns, pressure injury, toxic exposure, fatality",
  },
  "Field Maintenance & Infrastructure": {
    people:
      "Field technicians, mobile plant operators, traffic marshals, contractors, supervisors, public users",
    planningHazard:
      "can expose workers to buried services, live traffic, remote work, emergency repair fatigue, work at height, and mobile plant movements",
    equipmentHazard:
      "excavators, utility locating tools, poles, towers, vehicles, generators, traffic controls, and temporary repair equipment",
    interfaceHazard:
      "field crews, contractors, road users, pedestrians, plant operators, and emergency services sharing temporary work areas",
    exposureHazard:
      "vehicle strike, falls from height, electric or service strike, noise, weather, manual handling, and lone working",
    emergencyHazard:
      "service strike, traffic incident, fall from pole or tower, generator fault, night repair incident, or delayed remote rescue",
    existingMeasures:
      "Permit systems, utility plans, traffic management, vehicle checks, PPE, communication devices, and contractor supervision are used",
    specificControls:
      "locate services before digging, segregate traffic, inspect access equipment, manage fatigue, confirm communications, and supervise contractors closely",
    consequence:
      "Service strike, collision, fall injury, crush injury, serious injury, fatality",
  },
  "Emergency & Environmental Response": {
    people:
      "Emergency repair crews, environmental responders, supervisors, public users, contractors, incident investigators",
    planningHazard:
      "can involve storm damage, floods, spills, fire, public interface, critical infrastructure failure, and rapidly changing incident conditions",
    equipmentHazard:
      "spill kits, pumps, generators, temporary barriers, traffic controls, communication equipment, fire response tools, and inspection instruments",
    interfaceHazard:
      "responders, contractors, public users, emergency services, media, and utility control teams interacting during incident response",
    exposureHazard:
      "floodwater, fuel or chemical contact, fire smoke, unstable structures, live services, fatigue, and poor visibility",
    emergencyHazard:
      "incident escalation, public exposure, communication failure, environmental release, responder injury, or incomplete incident investigation",
    existingMeasures:
      "Emergency plans, incident command, spill response equipment, traffic controls, PPE, and communication protocols are available",
    specificControls:
      "establish incident command, isolate hazards, protect the public, use environmental controls, rotate responders, and document lessons learned",
    consequence:
      "Responder injury, environmental harm, fire exposure, public injury, serious injury",
  },
};

const agricultureCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Crop Production": {
    people:
      "Farm workers, seasonal workers, equipment operators, supervisors, contractors",
    planningHazard:
      "can expose workers to field machinery, pesticide or fertilizer use, irrigation systems, manual crop handling, and seasonal time pressure",
    equipmentHazard:
      "planting equipment, sprayers, harvesters, irrigation pumps, crop bins, grain handling equipment, and greenhouse systems",
    interfaceHazard:
      "farm workers, machinery operators, contractors, delivery drivers, and seasonal teams working across changing field areas",
    exposureHazard:
      "pesticides, fertilizers, grain dust, heat, cold, repetitive picking, manual handling, uneven ground, and noise",
    emergencyHazard:
      "chemical exposure, machinery incident, heat illness, irrigation water incident, grain handling emergency, or delayed field rescue",
    existingMeasures:
      "Farm procedures, chemical labels, PPE, equipment checks, worker briefings, and supervisor oversight are in place",
    specificControls:
      "follow product labels, manage re-entry intervals, rotate manual tasks, provide shade and water, inspect equipment, and brief seasonal workers",
    consequence:
      "Chemical exposure, heat illness, strains, machinery injury, respiratory irritation",
  },
  "Machinery & Vehicle Operations": {
    people:
      "Tractor operators, harvester operators, maintenance workers, farm workers, supervisors",
    planningHazard:
      "can involve tractor overturn, PTO entanglement, moving machinery, farm road traffic, coupling tasks, and fueling hazards",
    equipmentHazard:
      "tractors, harvesters, loaders, trailers, PTO shafts, guards, fuel systems, cleaning tools, and maintenance equipment",
    interfaceHazard:
      "operators, ground workers, pedestrians, delivery vehicles, and other farm traffic sharing yards, roads, and fields",
    exposureHazard:
      "noise, vibration, dust, diesel fumes, crush zones, sharp parts, hot surfaces, and fatigue",
    emergencyHazard:
      "tractor rollover, PTO entanglement, vehicle collision, fuel fire, equipment runaway, or delayed rescue on remote farm roads",
    existingMeasures:
      "Operator training, machine guards, maintenance schedules, speed controls, PPE, and farm traffic rules are used",
    specificControls:
      "keep PTO guards fitted, use seatbelts and rollover protection, isolate machinery before maintenance, control farm traffic, and refuel away from ignition sources",
    consequence:
      "Entanglement, crushing, rollover, burns, serious injury, fatality",
  },
  "Livestock Operations": {
    people:
      "Farm workers, animal handlers, veterinarians, transport drivers, supervisors",
    planningHazard:
      "can expose workers to unpredictable animal behavior, zoonotic disease, biosecurity controls, manure, and livestock transport pressure",
    equipmentHazard:
      "gates, crushes, milking systems, feeding equipment, trailers, cleaning tools, PPE, and veterinary equipment",
    interfaceHazard:
      "handlers, animals, veterinarians, transport drivers, and visitors interacting in yards, housing, milking areas, and loading zones",
    exposureHazard:
      "animal kicks or bites, zoonotic pathogens, manure gases, slips, manual handling, noise, and biological contamination",
    emergencyHazard:
      "aggressive animal incident, zoonotic exposure, transport injury, worker trapped in pen, or delayed veterinary and first aid response",
    existingMeasures:
      "Animal handling procedures, biosecurity rules, PPE, vaccination and hygiene controls, and supervision are in place",
    specificControls:
      "use suitable handling facilities, avoid working alone with aggressive animals, follow biosecurity steps, maintain escape routes, and clean contaminated areas safely",
    consequence:
      "Kicks, bites, crush injury, infection, slips, serious injury",
  },
  "Storage & Facilities": {
    people:
      "Farm workers, maintenance workers, contractors, delivery drivers, supervisors",
    planningHazard:
      "can involve silos, grain storage, bale stacking, chemical and fertilizer storage, farm workshops, and work at height on farm buildings",
    equipmentHazard:
      "silos, grain augers, bale handlers, cold rooms, workshop tools, chemical stores, ladders, and fire protection equipment",
    interfaceHazard:
      "workers, contractors, delivery vehicles, and machinery moving around barns, silos, workshops, and storage yards",
    exposureHazard:
      "grain dust, engulfment, confined space atmosphere, falling bales, chemical exposure, fire load, and falls from height",
    emergencyHazard:
      "silo engulfment, barn fire, chemical spill, bale collapse, workshop injury, or delayed rescue from height",
    existingMeasures:
      "Storage rules, chemical segregation, fire prevention checks, equipment guards, PPE, and maintenance controls are available",
    specificControls:
      "control silo entry, keep grain handling guarded, stack bales safely, segregate chemicals and fertilizers, inspect ladders, and reduce ignition sources",
    consequence:
      "Engulfment, respiratory illness, fire, falls, chemical burns, fatality",
  },
  "Outdoor & Environmental Conditions": {
    people:
      "Farm workers, seasonal workers, supervisors, contractors, emergency responders",
    planningHazard:
      "can expose workers to extreme weather, water hazards, uneven ground, lone work, dust, noise, and new seasonal worker unfamiliarity",
    equipmentHazard:
      "vehicles, hand tools, radios, irrigation channels, PPE, noise-generating equipment, and emergency response equipment",
    interfaceHazard:
      "workers spread across fields, remote areas, irrigation channels, farm roads, and temporary seasonal teams",
    exposureHazard:
      "heat stress, cold stress, slips on uneven ground, drowning risk, dust inhalation, noise, manual handling, and fatigue",
    emergencyHazard:
      "remote worker injury, heat illness, water rescue, severe weather, communication failure, or delayed first aid",
    existingMeasures:
      "Worker briefings, welfare arrangements, communication checks, PPE, emergency contacts, and supervisor monitoring are in place",
    specificControls:
      "monitor weather, schedule rest breaks, maintain communication, control water-edge work, onboard seasonal workers, and plan remote emergency response",
    consequence:
      "Heat illness, cold stress, slips, drowning, delayed rescue, serious injury",
  },
};

const portsMarineCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Cargo Handling": {
    people:
      "Stevedores, crane operators, riggers, terminal workers, drivers, supervisors",
    planningHazard:
      "can expose workers to suspended loads, cargo collapse, ship-shore interface, dropped objects, and changing cargo conditions",
    equipmentHazard:
      "containers, lifting gear, cranes, lashings, spreaders, forklifts, pallets, heavy lift equipment, and cargo securing tools",
    interfaceHazard:
      "cargo teams, vessel crew, crane operators, drivers, inspectors, and supervisors working across ship and terminal zones",
    exposureHazard:
      "crush zones, falling cargo, noise, vibration, manual handling, weather, slippery decks, and fatigue",
    emergencyHazard:
      "dropped load, cargo shift, lashing failure, crane incident, vessel movement, or delayed emergency access",
    existingMeasures:
      "Lift plans, cargo handling procedures, exclusion zones, PPE, communication protocols, and supervision are in place",
    specificControls:
      "inspect lifting gear, keep clear of suspended loads, verify cargo stability, coordinate ship-shore communication, and stop work in unsafe weather",
    consequence:
      "Crushing, dropped object injury, cargo collapse, fall injury, fatality",
  },
  "Vessel & Dock Operations": {
    people:
      "Mooring crews, vessel crew, pilots, dock workers, contractors, supervisors",
    planningHazard:
      "can involve mooring snap-back, quay edge exposure, vessel access, working over water, bunkering support, and crew transfer",
    equipmentHazard:
      "mooring lines, bollards, gangways, hatch covers, vessel access systems, lifejackets, radios, and transfer equipment",
    interfaceHazard:
      "vessel crew, port workers, pilots, contractors, and dock teams coordinating across quay edges and vessel access points",
    exposureHazard:
      "falling into water, slippery surfaces, weather, line tension, noise, poor lighting, and manual handling",
    emergencyHazard:
      "man overboard, mooring line failure, gangway collapse, bunkering spill, vessel movement, or failed rescue response",
    existingMeasures:
      "Mooring procedures, life-saving equipment, gangway inspections, PPE, radios, and vessel coordination procedures are used",
    specificControls:
      "stay clear of snap-back zones, inspect gangways, wear flotation PPE near water, control quay edge access, and maintain vessel communication",
    consequence:
      "Drowning, crush injury, fall injury, line strike, serious injury, fatality",
  },
  "Mobile Equipment & Traffic": {
    people:
      "Equipment operators, drivers, pedestrians, traffic marshals, maintenance workers, supervisors",
    planningHazard:
      "can expose workers to heavy terminal vehicles, reversing equipment, crane movements, pedestrian interface, and fueling operations",
    equipmentHazard:
      "reach stackers, terminal tractors, forklifts, cranes, straddle carriers, trailers, fuel systems, and traffic controls",
    interfaceHazard:
      "operators, drivers, pedestrians, crane teams, yard controllers, and maintenance crews working in active terminal routes",
    exposureHazard:
      "vehicle collision, blind spots, noise, vibration, diesel exhaust, poor visibility, and fatigue",
    emergencyHazard:
      "vehicle strike, equipment overturn, fuel spill, crane collision, blocked emergency route, or communication failure",
    existingMeasures:
      "Traffic management plans, operator training, speed limits, radio communication, PPE, and equipment inspections are in place",
    specificControls:
      "segregate pedestrians, use banksmen where needed, enforce speed limits, inspect equipment, manage reversing, and control refueling areas",
    consequence:
      "Collision, crushing, overturn, fire, serious injury, fatality",
  },
  "Warehousing & Yard Operations": {
    people:
      "Yard workers, warehouse staff, reefer technicians, dangerous goods handlers, drivers, supervisors",
    planningHazard:
      "can involve container stacking, reefer connections, dangerous goods storage, yard housekeeping, night shifts, and extreme weather",
    equipmentHazard:
      "containers, reefer cables, racking, forklifts, yard lighting, spill kits, waste equipment, and dangerous goods storage systems",
    interfaceHazard:
      "warehouse teams, drivers, reefer technicians, yard planners, dangerous goods handlers, and contractors sharing yard areas",
    exposureHazard:
      "falling containers, electric shock from reefers, chemical exposure, slips, manual handling, weather, and fatigue",
    emergencyHazard:
      "container stack collapse, dangerous goods incident, reefer electrical fault, spill, extreme weather disruption, or night shift emergency",
    existingMeasures:
      "Yard plans, dangerous goods controls, reefer procedures, housekeeping inspections, PPE, and emergency response equipment are available",
    specificControls:
      "verify stack limits, inspect reefer cables, segregate dangerous goods, maintain yard lighting, secure loose materials, and pause work in severe weather",
    consequence:
      "Crush injury, electric shock, chemical exposure, slips, environmental harm",
  },
  "Emergency & Marine Safety": {
    people:
      "Emergency responders, port workers, vessel crew, security staff, contractors, supervisors",
    planningHazard:
      "can involve marine rescue, dangerous goods incidents, vessel confined spaces, hot work, oil spills, security threats, and emergency communication",
    equipmentHazard:
      "rescue equipment, fire systems, spill response kits, gas monitors, hot work equipment, radios, and security systems",
    interfaceHazard:
      "port emergency teams, vessel crew, security, contractors, terminal operators, and external emergency services coordinating during incidents",
    exposureHazard:
      "smoke, fire, oil contamination, toxic vapors, confined space atmospheres, water exposure, stress, and fatigue",
    emergencyHazard:
      "man overboard, fire, oil spill, dangerous goods release, confined space rescue, hot work fire, or security escalation",
    existingMeasures:
      "Emergency plans, drills, rescue equipment, spill response procedures, permits, PPE, and communication protocols are established",
    specificControls:
      "inspect rescue equipment, test communications, control hot work, use gas testing for confined spaces, coordinate external responders, and debrief incidents",
    consequence:
      "Drowning, fire injury, toxic exposure, environmental harm, serious injury, fatality",
  },
};

const chemicalIndustryCategoryProfiles: Record<
  string,
  SmartSectorCategoryProfile
> = {
  "Process Operations": {
    people:
      "Process operators, control room staff, maintenance workers, supervisors, contractors",
    planningHazard:
      "can expose workers to process upset, reactive chemicals, pressure systems, emergency shutdown demands, and batch charging errors",
    equipmentHazard:
      "reactors, mixers, distillation columns, filters, pumps, valves, sampling points, and process control systems",
    interfaceHazard:
      "operators, laboratory staff, maintenance workers, control room teams, and contractors working around live process equipment",
    exposureHazard:
      "toxic vapors, corrosive chemicals, heat, pressure release, flammable atmospheres, noise, and poor ventilation",
    emergencyHazard:
      "runaway reaction, chemical release, fire, explosion, emergency shutdown failure, or delayed process alarm response",
    existingMeasures:
      "Operating procedures, process monitoring, alarms, PPE, permits, emergency shutdown systems, and supervisor controls are in place",
    specificControls:
      "verify operating limits, control charging sequence, monitor alarms, manage ignition sources, use closed sampling where possible, and escalate process deviations",
    consequence:
      "Toxic exposure, chemical burns, pressure injury, fire, explosion, fatality",
  },
  "Chemical Handling & Storage": {
    people:
      "Chemical handlers, warehouse workers, forklift operators, laboratory staff, emergency responders",
    planningHazard:
      "can involve incompatible chemicals, flammable liquids, corrosives, toxic substances, poor labeling, and container transfer hazards",
    equipmentHazard:
      "drums, IBCs, transfer hoses, pumps, gas cylinders, storage racks, bunds, labels, and spill response equipment",
    interfaceHazard:
      "chemical handlers, transport drivers, forklift operators, supervisors, and emergency responders sharing storage and transfer areas",
    exposureHazard:
      "skin contact, inhalation, chemical splash, fire, vapor release, cylinder impact, and environmental contamination",
    emergencyHazard:
      "chemical spill, incompatible reaction, gas leak, flammable liquid fire, labeling error, or delayed decontamination",
    existingMeasures:
      "Safety data sheets, chemical labels, segregation rules, bunding, PPE, ventilation, and spill kits are available",
    specificControls:
      "segregate incompatible chemicals, inspect containers, use closed transfer, control ignition sources, label substances clearly, and train spill responders",
    consequence:
      "Chemical burns, toxic exposure, fire, explosion, environmental release, serious injury",
  },
  "Maintenance & Engineering": {
    people:
      "Maintenance technicians, electricians, instrument technicians, contractors, process operators",
    planningHazard:
      "can involve line breaking, isolation failure, confined spaces, hot work, residual chemicals, contractor work, and hazardous energy",
    equipmentHazard:
      "pumps, pipework, valves, instruments, electrical panels, isolation points, hot work equipment, and confined space equipment",
    interfaceHazard:
      "maintenance teams, contractors, permit issuers, process operators, and emergency responders coordinating around chemical plant equipment",
    exposureHazard:
      "residual chemical contact, toxic vapors, pressure release, electric shock, hot work fumes, confined space atmospheres, and manual handling",
    emergencyHazard:
      "line breaking release, fire during hot work, confined space rescue, lockout failure, contractor injury, or delayed decontamination",
    existingMeasures:
      "Permit-to-work, isolation/LOTO, gas testing, line breaking procedures, PPE, contractor induction, and emergency plans are used",
    specificControls:
      "verify isolation and drain-down, test atmospheres, use line break PPE, control hot work ignition sources, supervise contractors, and keep rescue equipment ready",
    consequence:
      "Toxic exposure, chemical burns, fire, electric shock, confined space injury, fatality",
  },
  "Laboratory & Quality Control": {
    people:
      "Laboratory analysts, quality technicians, sample couriers, supervisors, cleaners",
    planningHazard:
      "can involve chemical reagents, fume hood use, glassware, sample disposal, equipment maintenance, PPE selection, and emergency shower readiness",
    equipmentHazard:
      "fume hoods, glassware, reagents, sample containers, analytical instruments, eyewash stations, emergency showers, and waste containers",
    interfaceHazard:
      "laboratory staff, production samplers, cleaners, maintenance workers, and supervisors working in controlled laboratory areas",
    exposureHazard:
      "chemical inhalation, corrosive splash, glass cuts, repetitive bench work, incompatible waste, and poor ventilation",
    emergencyHazard:
      "lab spill, fume hood failure, eyewash or shower defect, chemical exposure, glass breakage, or delayed emergency response",
    existingMeasures:
      "Laboratory procedures, SDS access, fume hoods, PPE, waste segregation, eyewash and shower checks, and supervision are in place",
    specificControls:
      "use fume hoods correctly, inspect glassware, segregate lab waste, verify emergency shower and eyewash access, and label samples clearly",
    consequence:
      "Chemical burns, inhalation injury, cuts, exposure-related illness, serious injury",
  },
  "Emergency, Waste & Environment": {
    people:
      "Emergency responders, operators, waste handlers, environmental staff, supervisors, contractors",
    planningHazard:
      "can involve chemical spills, fires, gas leaks, hazardous waste, wastewater treatment, emissions control, decontamination, and incident investigation",
    equipmentHazard:
      "spill kits, fire systems, gas detectors, hazardous waste containers, wastewater systems, scrubbers, decontamination equipment, and monitoring instruments",
    interfaceHazard:
      "emergency teams, operators, waste contractors, environmental staff, regulators, and supervisors coordinating during abnormal events",
    exposureHazard:
      "toxic gas, corrosive liquid, smoke, contaminated wastewater, hazardous waste contact, environmental release, and stress",
    emergencyHazard:
      "major spill, gas leak, fire, emission control failure, decontamination failure, hazardous waste reaction, or incomplete incident learning",
    existingMeasures:
      "Emergency plans, spill response procedures, fire systems, gas detection, waste controls, PPE, and environmental monitoring are available",
    specificControls:
      "isolate releases, protect drains, use decontamination procedures, segregate hazardous waste, monitor emissions, and document incident causes and actions",
    consequence:
      "Toxic exposure, fire injury, environmental harm, chemical burns, serious injury, fatality",
  },
};

const createSmartSectorRiskAssessmentLibrary = (
  sector: string,
  groups: ActivityGroup[],
  profiles: Record<string, SmartSectorCategoryProfile>,
) =>
  Object.fromEntries(
    groups.flatMap((group) => {
      const profile = profiles[group.label];

      if (!profile) {
        throw new Error(`Missing risk profile for ${sector}: ${group.label}`);
      }

      return group.activities.map((activity) => [
        activity,
        {
          title: `${sector} - ${activity} Risk Assessment`,
          createHazards: () =>
            createSmartSectorHazards(sector, group.label, activity, profile),
        },
      ]);
    }),
  ) as Record<string, { title: string; createHazards: () => HazardRow[] }>;

const manufacturingRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Manufacturing",
    manufacturingActivityGroups,
    manufacturingCategoryProfiles,
  );

const officeRiskAssessmentLibrary = createSmartSectorRiskAssessmentLibrary(
  "Office & Administrative",
  officeActivityGroups,
  officeCategoryProfiles,
);

const healthcareRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Healthcare & Medical Facilities",
    healthcareActivityGroups,
    healthcareCategoryProfiles,
  );

const oilGasRiskAssessmentLibrary = createSmartSectorRiskAssessmentLibrary(
  "Oil & Gas",
  oilGasActivityGroups,
  oilGasCategoryProfiles,
);

const miningRiskAssessmentLibrary = createSmartSectorRiskAssessmentLibrary(
  "Mining & Quarrying",
  miningActivityGroups,
  miningCategoryProfiles,
);

const foodProductionRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Food Production & Processing",
    foodProductionActivityGroups,
    foodProductionCategoryProfiles,
  );

const hospitalityRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Hospitality & HORECA",
    hospitalityActivityGroups,
    hospitalityCategoryProfiles,
  );

const retailRiskAssessmentLibrary = createSmartSectorRiskAssessmentLibrary(
  "Retail & Commercial Facilities",
  retailActivityGroups,
  retailCategoryProfiles,
);

const educationRiskAssessmentLibrary = createSmartSectorRiskAssessmentLibrary(
  "Education & Training Facilities",
  educationActivityGroups,
  educationCategoryProfiles,
);

const energyUtilitiesRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Energy & Utilities",
    energyUtilitiesActivityGroups,
    energyUtilitiesCategoryProfiles,
  );

const agricultureRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Agriculture & Farming",
    agricultureActivityGroups,
    agricultureCategoryProfiles,
  );

const portsMarineRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Ports & Marine Operations",
    portsMarineActivityGroups,
    portsMarineCategoryProfiles,
  );

const chemicalIndustryRiskAssessmentLibrary =
  createSmartSectorRiskAssessmentLibrary(
    "Chemical Industry",
    chemicalIndustryActivityGroups,
    chemicalIndustryCategoryProfiles,
  );

const riskAssessmentLibraryBySector: Record<
  string,
  Record<string, { title: string; createHazards: () => HazardRow[] }>
> = {
  Construction: constructionRiskAssessmentLibrary,
  "Warehouse & Logistics": warehouseRiskAssessmentLibrary,
  Manufacturing: manufacturingRiskAssessmentLibrary,
  "Office & Administrative": officeRiskAssessmentLibrary,
  "Healthcare & Medical Facilities": healthcareRiskAssessmentLibrary,
  "Oil & Gas": oilGasRiskAssessmentLibrary,
  "Mining & Quarrying": miningRiskAssessmentLibrary,
  "Food Production & Processing": foodProductionRiskAssessmentLibrary,
  "Hospitality & HORECA": hospitalityRiskAssessmentLibrary,
  "Retail & Commercial Facilities": retailRiskAssessmentLibrary,
  "Education & Training Facilities": educationRiskAssessmentLibrary,
  "Energy & Utilities": energyUtilitiesRiskAssessmentLibrary,
  "Agriculture & Farming": agricultureRiskAssessmentLibrary,
  "Ports & Marine Operations": portsMarineRiskAssessmentLibrary,
  "Chemical Industry": chemicalIndustryRiskAssessmentLibrary,
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

const riskTone = (level: RiskLevel, darkMode = true) => {
  if (level === "High") {
    return {
      badge: darkMode
        ? "border-rose-400/40 bg-rose-500/12 text-rose-200 ring-1 ring-rose-400/20"
        : "border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100",
      cell: darkMode
        ? "bg-rose-500/16 text-rose-100 border-rose-400/25"
        : "bg-rose-50 text-rose-700 border-rose-200",
      exportBg: "#FEE2E2",
      exportText: "#991B1B",
    };
  }

  if (level === "Medium") {
    return {
      badge: darkMode
        ? "border-amber-400/35 bg-amber-400/12 text-amber-100 ring-1 ring-amber-400/20"
        : "border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-amber-100",
      cell: darkMode
        ? "bg-amber-400/15 text-amber-100 border-amber-300/25"
        : "bg-amber-50 text-amber-800 border-amber-200",
      exportBg: "#FEF3C7",
      exportText: "#92400E",
    };
  }

  return {
    badge: darkMode
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-400/20"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    cell: darkMode
      ? "bg-emerald-400/12 text-emerald-100 border-emerald-300/20"
      : "bg-emerald-50 text-emerald-700 border-emerald-200",
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

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const getRiskAssessmentTheme = (darkMode: boolean) => ({
  pageText: darkMode ? "text-[#F5F7FA]" : "text-slate-900",
  shell: darkMode
    ? "border-white/10 bg-[#071225]/82 shadow-[0_30px_100px_rgba(0,0,0,0.34)]"
    : "border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]",
  shellHeader: darkMode
    ? "border-white/10 bg-white/[0.035]"
    : "border-slate-200 bg-slate-50/80",
  section: darkMode
    ? "border-white/10 bg-[#071225]/72 shadow-[0_20px_70px_rgba(0,0,0,0.22)]"
    : "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
  statCard: darkMode
    ? "border-white/10 bg-white/[0.045]"
    : "border-slate-200 bg-white shadow-sm",
  muted: darkMode ? "text-slate-400" : "text-slate-600",
  soft: darkMode ? "text-slate-300" : "text-slate-700",
  heading: darkMode ? "text-white" : "text-slate-950",
  label: darkMode ? "text-slate-400" : "text-slate-600",
  field: darkMode
    ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/45 focus:bg-white/[0.075]"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#1E90FF] focus:bg-white focus:ring-4 focus:ring-[#1E90FF]/10",
  select: darkMode
    ? "border-white/10 bg-[#071225] text-white focus:border-[#4DEBFF]/45"
    : "border-slate-300 bg-white text-slate-900 focus:border-[#1E90FF] focus:ring-4 focus:ring-[#1E90FF]/10",
  ghostButton: darkMode
    ? "border-white/10 bg-white/[0.055] text-slate-100 hover:bg-white/[0.09]"
    : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950",
  themeToggleButton: darkMode
    ? "border-slate-500/30 bg-slate-800 text-white shadow-md hover:bg-slate-700"
    : "border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-100",
  exportButton: darkMode
    ? "border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#DDFBFF] hover:bg-[#4DEBFF]/15"
    : "border-[#1E90FF]/25 bg-[#1E90FF]/10 text-[#0759A8] hover:bg-[#1E90FF]/15",
  notice: darkMode
    ? "border-[#4DEBFF]/20 bg-[#4DEBFF]/10 text-[#DDFBFF]"
    : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
  libraryCard: darkMode
    ? "border-[#4DEBFF]/25 bg-[#4DEBFF]/10"
    : "border-[#1E90FF]/20 bg-[#1E90FF]/8",
  libraryTitle: darkMode ? "text-[#DDFBFF]" : "text-[#0759A8]",
  emptyState: darkMode
    ? "border-white/15 bg-white/[0.03] text-slate-400"
    : "border-slate-300 bg-slate-50 text-slate-500",
  hazardCard: darkMode
    ? "border-white/10 bg-white/[0.04]"
    : "border-slate-200 bg-slate-50/80 shadow-sm",
  divider: darkMode ? "border-white/10" : "border-slate-200",
  riskPanel: darkMode
    ? "border-white/10 bg-[#071225]/60"
    : "border-slate-200 bg-white",
  miniCard: darkMode
    ? "border-white/10 bg-white/[0.04]"
    : "border-slate-200 bg-slate-50",
  scoreText: darkMode ? "text-white" : "text-slate-950",
  matrixCard: darkMode
    ? "border-white/10 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
    : "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
  matrixHeaderCell: darkMode
    ? "border-white/10 bg-white/[0.03] text-slate-300"
    : "border-slate-200 bg-slate-50 text-slate-600",
  matrixCornerCell: darkMode
    ? "border-white/10 bg-white/[0.03] text-slate-400"
    : "border-slate-200 bg-slate-100 text-slate-600",
  checkboxSelected: darkMode
    ? "border-[#4DEBFF]/40 bg-[#4DEBFF]/10 text-[#DDFBFF]"
    : "border-[#1E90FF]/35 bg-[#1E90FF]/10 text-[#0759A8]",
  checkboxIdle: darkMode
    ? "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  deleteButton: darkMode
    ? "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  savedCard: (active: boolean) =>
    active
      ? darkMode
        ? "border-[#4DEBFF]/35 bg-[#4DEBFF]/10"
        : "border-[#1E90FF]/30 bg-[#1E90FF]/8 shadow-sm"
      : darkMode
        ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
        : "border-slate-200 bg-white hover:bg-slate-50 shadow-sm",
});

type RiskAssessmentTheme = ReturnType<typeof getRiskAssessmentTheme>;

const Field = ({
  label,
  value,
  onChange,
  theme,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: RiskAssessmentTheme;
  type?: string;
  placeholder?: string;
}) => (
  <label className="block">
    <span
      className={joinClasses(
        "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
        theme.label,
      )}
    >
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={joinClasses(
        "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
        theme.field,
      )}
    />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  theme,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: RiskAssessmentTheme;
  placeholder?: string;
  rows?: number;
}) => (
  <label className="block">
    <span
      className={joinClasses(
        "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
        theme.label,
      )}
    >
      {label}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={joinClasses(
        "w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none transition",
        theme.field,
      )}
    />
  </label>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
  optionGroups = [],
  theme,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  optionGroups?: SelectOptionGroup[];
  theme: RiskAssessmentTheme;
  placeholder: string;
  disabled?: boolean;
}) => (
  <label className="block">
    <span
      className={joinClasses(
        "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
        theme.label,
      )}
    >
      {label}
    </span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={joinClasses(
        "w-full rounded-xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-50",
        theme.select,
      )}
    >
      <option value="">{placeholder}</option>
      {optionGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const RiskBadge = ({
  score,
  darkMode,
}: {
  score: number;
  darkMode: boolean;
}) => {
  const level = riskLevel(score);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${riskTone(level, darkMode).badge}`}
    >
      {score} - {level}
    </span>
  );
};

const RiskMatrixGuide = ({
  darkMode,
  theme,
}: {
  darkMode: boolean;
  theme: RiskAssessmentTheme;
}) => (
  <div
    className={joinClasses(
      "rounded-3xl border p-5",
      theme.matrixCard,
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className={joinClasses("text-sm font-semibold", theme.heading)}>
          5x5 Risk Matrix
        </h3>
        <p className={joinClasses("mt-1 text-xs", theme.muted)}>
          Risk Score = Probability x Severity
        </p>
      </div>
      <div className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4DEBFF]">
        Manual scoring
      </div>
    </div>

    <div className="mt-4 grid grid-cols-6 gap-1 text-center text-[11px] font-bold">
      <div className={joinClasses("rounded-lg border p-2", theme.matrixCornerCell)}>
        S / P
      </div>
      {riskValues.map((probability) => (
        <div
          key={`probability-${probability}`}
          className={joinClasses("rounded-lg border p-2", theme.matrixHeaderCell)}
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
              className={joinClasses("rounded-lg border p-2", theme.matrixHeaderCell)}
            >
              S{severity}
            </div>
            {riskValues.map((probability) => {
              const score = riskScore(probability, severity);
              const level = riskLevel(score);

              return (
                <div
                  key={`${probability}-${severity}`}
                  className={`rounded-lg border p-2 ${riskTone(level, darkMode).cell}`}
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
  darkMode,
  onToggleTheme,
  createdBy,
  navigationIntent,
  onNavigationIntentHandled,
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
  const [createdActionLinks, setCreatedActionLinks] = useState<string[]>([]);
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [workspaceSettings, setWorkspaceSettings] =
    useState<WorkspaceSettings>(defaultWorkspaceSettings);

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
    const loadWorkspaceSettings = () => {
      setWorkspaceSettings(readWorkspaceSettings(userId));
    };

    loadWorkspaceSettings();

    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<WorkspaceSettings>;

      if (customEvent.detail) {
        setWorkspaceSettings(customEvent.detail);
        return;
      }

      loadWorkspaceSettings();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("workspace_settings")) {
        loadWorkspaceSettings();
      }
    };

    window.addEventListener(
      workspaceSettingsUpdatedEvent,
      handleSettingsUpdate,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        workspaceSettingsUpdatedEvent,
        handleSettingsUpdate,
      );
      window.removeEventListener("storage", handleStorage);
    };
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
  const activeActivityGroups = customSectorMode
    ? []
    : (activityGroupsBySector[header.sector] ?? []);
  const activitySelectGroups =
    activeActivityGroups.map((group) => ({
      label: group.label,
      options: group.activities.map((activity) => ({
        value: activity,
        label: activity,
      })),
    }));
  const activitySelectOptions = [
    ...(activitySelectGroups.length > 0
      ? []
      : activityOptions.map((activity) => ({
          value: activity,
          label: activity,
        }))),
    { value: customLibraryOption, label: "Other / Manual" },
  ];
  const selectedLibraryAssessment =
    !customSectorMode && !customActivityMode
      ? riskAssessmentLibraryBySector[header.sector]?.[header.activity]
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

  const getRiskAssessmentActionLinkId = (hazard: HazardRow) =>
    `risk-assessment:${hazard.id}`;

  const getRiskAssessmentActionPriority = (
    initialLevel: RiskLevel,
    residualLevel: RiskLevel,
  ): ActionPriority => {
    if (residualLevel === "High") {
      return "Critical";
    }

    if (initialLevel === "High") {
      return "High";
    }

    if (residualLevel === "Medium") {
      return "Medium";
    }

    return "Low";
  };

  const createActionFromHazard = (hazard: HazardRow) => {
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
    const linkedRiskAssessmentId = getRiskAssessmentActionLinkId(hazard);
    const existingAction = findActionByLinkedSource({
      userId,
      linkedRiskAssessmentId,
    });

    if (existingAction) {
      const shouldCreateAnother = window.confirm(
        "An action may already exist for this item. Create another?",
      );

      if (!shouldCreateAnother) {
        return;
      }
    }

    const action = createActionFromInput({
      title:
        hazard.additionalMeasures.trim().length > 0
          ? hazard.additionalMeasures.trim()
          : `Control action for: ${hazard.hazardDescription || "hazard"}`,
      description: [
        `Activity / Process: ${hazard.workplaceActivity || "Not provided"}`,
        `Hazard description: ${hazard.hazardDescription || "Not provided"}`,
        `Possible consequence: ${hazard.possibleConsequence || "Not provided"}`,
        `Existing preventive measures: ${
          hazard.existingMeasures || "Not provided"
        }`,
        `Additional preventive measures: ${
          hazard.additionalMeasures || "Not provided"
        }`,
        `Initial risk score/level: ${initialScore} - ${initialLevel}`,
        `Residual risk score/level: ${residualScore} - ${residualLevel}`,
        `Control hierarchy used: ${
          hazard.controlHierarchy.length > 0
            ? hazard.controlHierarchy.join(", ")
            : "Not provided"
        }`,
      ].join("\n"),
      sourceModule: "Risk Assessment",
      priority: getRiskAssessmentActionPriority(initialLevel, residualLevel),
      responsiblePerson: hazard.responsiblePerson,
      department: header.department,
      siteLocation: header.site,
      dueDate: hazard.completionDeadline || getDateInputDaysFromNow(7),
      createdBy,
      linkedRiskAssessmentId,
    });

    appendActionTrackerAction(userId, action);
    setCreatedActionLinks((current) =>
      current.includes(linkedRiskAssessmentId)
        ? current
        : [...current, linkedRiskAssessmentId],
    );
    setNotice("Action created from risk assessment.");
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
      sector: header.sector,
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

  const importAiRiskAssessment = (
    generatedAssessment: OrbitAiStructuredRiskAssessment,
  ) => {
    if (hazards.length > 0 && hasEnteredHazardData) {
      const shouldReplace = window.confirm(
        "This will replace current hazard rows with the AI-generated risk assessment. Continue?",
      );

      if (!shouldReplace) {
        return false;
      }
    }

    try {
      const companyProfile = workspaceSettings.companyProfile;
      const generatedHeader: RiskAssessmentHeader = {
        company:
          generatedAssessment.header.company ||
          header.company ||
          companyProfile.companyName,
        site:
          generatedAssessment.header.site ||
          header.site ||
          companyProfile.mainSiteLocation,
        department:
          generatedAssessment.header.department || header.department,
        title: generatedAssessment.header.title,
        assessor:
          generatedAssessment.header.assessor || header.assessor || createdBy,
        assessmentDate:
          generatedAssessment.header.assessmentDate || header.assessmentDate || today(),
        sector:
          generatedAssessment.header.sector ||
          header.sector ||
          companyProfile.industrySector,
        activity: generatedAssessment.header.activity || header.activity,
      };
      const generatedHazards = generatedAssessment.hazards.map((hazard) =>
        createLibraryHazard({
          workplaceActivity: hazard.workplaceActivity,
          hazardDescription: hazard.hazardDescription,
          whoMayBeHarmed: hazard.whoMayBeHarmed,
          possibleConsequence: hazard.possibleConsequence,
          existingMeasures: hazard.existingMeasures,
          initialProbability: hazard.initialProbability as RiskValue,
          initialSeverity: hazard.initialSeverity as RiskValue,
          additionalMeasures: hazard.additionalMeasures,
          controlHierarchy: hazard.controlHierarchy as ControlHierarchy[],
          residualProbability: hazard.residualProbability as RiskValue,
          residualSeverity: hazard.residualSeverity as RiskValue,
          responsiblePerson: hazard.responsiblePerson,
          completionDeadline: hazard.completionDeadline,
          status: hazard.status,
          comments: hazard.comments,
        }),
      );
      const assessment: SavedRiskAssessment = {
        id: Date.now(),
        header: generatedHeader,
        hazards: generatedHazards,
        savedAt: new Date().toISOString(),
      };
      const updated = mergeSavedRiskAssessments([assessment, ...savedAssessments]);
      const nextActivities = activitiesBySector[generatedHeader.sector] ?? [];

      writeRiskAssessments(userId, updated);
      setSavedAssessments(updated);
      setHeader(generatedHeader);
      setHazards(generatedHazards);
      setCurrentAssessmentId(assessment.id);
      setHighRiskOnly(false);
      setCustomSectorMode(
        Boolean(generatedHeader.sector) &&
          !sectorOptions.includes(generatedHeader.sector),
      );
      setCustomActivityMode(
        Boolean(generatedHeader.activity) &&
          !nextActivities.includes(generatedHeader.activity),
      );
      setNotice("AI-generated editable risk assessment created and saved.");
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: "smooth" }),
      );

      return true;
    } catch {
      setNotice("Could not import the AI-generated risk assessment.");
      return false;
    }
  };

  const newAssessment = () => {
    setHeader({
      ...createEmptyHeader(),
      company: workspaceCompanyProfile.companyName,
      site: workspaceCompanyProfile.mainSiteLocation,
      sector: workspaceCompanyProfile.industrySector,
    });
    setHazards([createEmptyHazard()]);
    setCurrentAssessmentId(null);
    setHighRiskOnly(false);
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
    setHighRiskOnly(false);
    setNotice("Risk assessment loaded.");
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };

  useEffect(() => {
    if (!navigationIntent || navigationIntent.moduleId !== "risk-assessments") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (navigationIntent.action === "new") {
        newAssessment();
        onNavigationIntentHandled?.();
        return;
      }

      if (navigationIntent.action === "open-record") {
        const assessment = savedAssessments.find(
          (item) => String(item.id) === navigationIntent.recordId,
        );

        if (assessment) {
          loadAssessment(assessment);
          onNavigationIntentHandled?.();
        }
        return;
      }

      const assessmentWithHighRisk = savedAssessments.find((assessment) =>
        assessment.hazards.some(
          (hazard) =>
            riskLevel(
              riskScore(hazard.residualProbability, hazard.residualSeverity),
            ) === "High" ||
            riskLevel(
              riskScore(hazard.initialProbability, hazard.initialSeverity),
            ) === "High",
        ),
      );

      if (assessmentWithHighRisk) {
        loadAssessment(assessmentWithHighRisk);
      }

      setHighRiskOnly(true);
      setNotice(
        assessmentWithHighRisk
          ? "Showing high-risk hazards."
          : "No high-risk hazards found in saved assessments.",
      );
      onNavigationIntentHandled?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // This consumes one parent-owned navigation intent after the module mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationIntent, onNavigationIntentHandled, savedAssessments]);

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

  const theme = getRiskAssessmentTheme(darkMode);

  const summaryCards = [
    {
      label: "Total hazards",
      value: summary.totalHazards,
      tone: theme.scoreText,
    },
    {
      label: "High initial risks",
      value: summary.highInitialRisks,
      tone: darkMode ? "text-rose-300" : "text-rose-600",
    },
    {
      label: "High residual risks",
      value: summary.highResidualRisks,
      tone: darkMode ? "text-amber-200" : "text-amber-600",
    },
    {
      label: "Open actions",
      value: summary.openActions,
      tone: darkMode ? "text-cyan-200" : "text-[#0759A8]",
    },
  ];
  const workspaceCompanyProfile = workspaceSettings.companyProfile;
  const workspaceCompanyName = workspaceCompanyProfile.companyName.trim();
  const workspaceCompanyDetails = [
    workspaceCompanyProfile.industrySector,
    workspaceCompanyProfile.mainSiteLocation,
    workspaceCompanyProfile.contactEmail,
    workspaceCompanyProfile.phone,
    workspaceCompanyProfile.address,
  ].filter((value) => value.trim().length > 0);
  const hasWorkspaceCompanyBranding = hasCompanyBranding(workspaceSettings);
  const displayedHazards = highRiskOnly
    ? hazards.filter(
        (hazard) =>
          riskLevel(
            riskScore(hazard.residualProbability, hazard.residualSeverity),
          ) === "High" ||
          riskLevel(riskScore(hazard.initialProbability, hazard.initialSeverity)) ===
            "High",
      )
    : hazards;

  return (
    <div
      className={joinClasses(
        "relative z-10 min-h-screen w-full min-w-0 px-4 py-24 transition-colors duration-300 sm:px-6 lg:px-10 lg:py-10",
        theme.pageText,
      )}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div
          className={joinClasses(
            "overflow-hidden rounded-3xl border backdrop-blur-2xl",
            theme.shell,
          )}
        >
          <div
            className={joinClasses(
              "border-b px-5 py-5 sm:px-7",
              theme.shellHeader,
            )}
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Risk Assessments
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  5x5 Workplace Risk Assessment
                </h1>
                <p className={joinClasses("mt-2 max-w-3xl text-sm leading-6", theme.muted)}>
                  Manually document hazards, evaluate initial and residual risk,
                  assign controls, and export a professional Laboria report.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={newAssessment}
                  className={joinClasses(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    theme.ghostButton,
                  )}
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
                  onClick={onToggleTheme}
                  className={joinClasses(
                    "inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-200",
                    theme.themeToggleButton,
                  )}
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {darkMode ? (
                    <Sun size={18} aria-hidden />
                  ) : (
                    <Moon size={18} aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void exportRiskAssessmentPDF()}
                  className={joinClasses(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    theme.exportButton,
                  )}
                >
                  <Download size={16} aria-hidden />
                  Export PDF
                </button>
              </div>
            </div>

            <div className="mt-4">
              <OrbitAiToolStrip
                darkMode={darkMode}
                userId={userId}
                compact
                title="Risk Assessment AI"
                sourceModule="Risk Assessments"
                context={{ hazardCount: hazards.length }}
                onRiskAssessmentGenerated={importAiRiskAssessment}
                toolIds={[
                  "risk-assessment-basic",
                  "suggest-hazards",
                  "recommend-controls",
                  "risk-review-advanced",
                ]}
              />
            </div>

            {notice ? (
              <div
                className={joinClasses(
                  "mt-4 rounded-xl border px-4 py-3 text-sm font-semibold",
                  theme.notice,
                )}
              >
                {notice}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={joinClasses("rounded-2xl border p-4", theme.statCard)}
              >
                <div
                  className={joinClasses(
                    "text-xs font-semibold uppercase tracking-[0.16em]",
                    theme.label,
                  )}
                >
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
            <section
              className={joinClasses(
                "rounded-3xl border p-5 backdrop-blur-2xl sm:p-7",
                theme.section,
              )}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Assessment header</h2>
                  <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                    Core context for the risk assessment report.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field
                  label="Company name"
                  value={header.company}
                  onChange={(value) => updateHeader("company", value)}
                  theme={theme}
                />
                <Field
                  label="Site / Location"
                  value={header.site}
                  onChange={(value) => updateHeader("site", value)}
                  theme={theme}
                />
                <Field
                  label="Department / Area"
                  value={header.department}
                  onChange={(value) => updateHeader("department", value)}
                  theme={theme}
                />
                <Field
                  label="Assessment title"
                  value={header.title}
                  onChange={(value) => updateHeader("title", value)}
                  theme={theme}
                />
                <Field
                  label="Assessor"
                  value={header.assessor}
                  onChange={(value) => updateHeader("assessor", value)}
                  theme={theme}
                />
                <Field
                  label="Assessment date"
                  value={header.assessmentDate}
                  onChange={(value) => updateHeader("assessmentDate", value)}
                  theme={theme}
                  type="date"
                />
                <SelectField
                  label="Sector / Category"
                  value={sectorSelectValue}
                  onChange={updateSector}
                  options={sectorSelectOptions}
                  theme={theme}
                  placeholder="Select sector"
                />
                {customSectorMode ? (
                  <Field
                    label="Custom sector / category"
                    value={header.sector}
                    onChange={(value) => updateHeader("sector", value)}
                    theme={theme}
                  />
                ) : null}
                {!customSectorMode ? (
                  <SelectField
                    label="Activity / Task"
                    value={activitySelectValue}
                    onChange={updateActivity}
                    options={activitySelectOptions}
                    optionGroups={activitySelectGroups}
                    theme={theme}
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
                    theme={theme}
                  />
                )}
                {!customSectorMode && customActivityMode ? (
                  <Field
                    label="Custom activity / task"
                    value={header.activity}
                    onChange={(value) => updateHeader("activity", value)}
                    theme={theme}
                  />
                ) : null}
              </div>

              {canGenerateLibraryAssessment ? (
                <div
                  className={joinClasses(
                    "mt-5 rounded-2xl border p-4",
                    theme.libraryCard,
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className={joinClasses("text-sm font-semibold", theme.libraryTitle)}>
                        Laboria HSE Library prototype available
                      </div>
                      <p className={joinClasses("mt-1 text-sm", theme.soft)}>
                        Generate a complete editable assessment for{" "}
                        {header.sector} - {header.activity}.
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

            <section
              className={joinClasses(
                "rounded-3xl border p-5 backdrop-blur-2xl sm:p-7",
                theme.section,
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Hazard register</h2>
                  <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                    Add hazards and score initial and residual risk using the
                    5x5 matrix.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {highRiskOnly ? (
                    <button
                      type="button"
                      onClick={() => setHighRiskOnly(false)}
                      className={joinClasses(
                        "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                        theme.ghostButton,
                      )}
                    >
                      Show all hazards
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={addHazard}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
                  >
                    <Plus size={16} aria-hidden />
                    Add hazard
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {displayedHazards.length === 0 ? (
                  <div
                    className={joinClasses(
                      "rounded-2xl border border-dashed px-5 py-8 text-center text-sm",
                      theme.emptyState,
                    )}
                  >
                    {highRiskOnly
                      ? "No high-risk hazards found in this assessment."
                      : "No hazards added yet."}
                  </div>
                ) : null}

                {displayedHazards.map((hazard, index) => {
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
                      className={joinClasses(
                        "rounded-3xl border p-4 sm:p-5",
                        theme.hazardCard,
                      )}
                    >
                      <div
                        className={joinClasses(
                          "flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between",
                          theme.divider,
                        )}
                      >
                        <div>
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#4DEBFF]">
                            Hazard row {index + 1}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <RiskBadge score={initialScore} darkMode={darkMode} />
                            <RiskBadge score={residualScore} darkMode={darkMode} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => createActionFromHazard(hazard)}
                            className={joinClasses(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                              createdActionLinks.includes(
                                getRiskAssessmentActionLinkId(hazard),
                              )
                                ? theme.checkboxSelected
                                : theme.exportButton,
                            )}
                          >
                            <Plus size={14} aria-hidden />
                            {createdActionLinks.includes(
                              getRiskAssessmentActionLinkId(hazard),
                            )
                              ? "Action created"
                              : "Create Action"}
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateHazard(hazard)}
                            className={joinClasses(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                              theme.ghostButton,
                            )}
                          >
                            <Copy size={14} aria-hidden />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHazard(hazard.id)}
                            className={joinClasses(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                              theme.deleteButton,
                            )}
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
                          theme={theme}
                        />
                        <Field
                          label="Who may be harmed"
                          value={hazard.whoMayBeHarmed}
                          onChange={(value) =>
                            updateHazard(hazard.id, "whoMayBeHarmed", value)
                          }
                          theme={theme}
                        />
                        <TextAreaField
                          label="Hazard description"
                          value={hazard.hazardDescription}
                          onChange={(value) =>
                            updateHazard(hazard.id, "hazardDescription", value)
                          }
                          theme={theme}
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
                          theme={theme}
                        />
                        <TextAreaField
                          label="Existing preventive measures"
                          value={hazard.existingMeasures}
                          onChange={(value) =>
                            updateHazard(hazard.id, "existingMeasures", value)
                          }
                          theme={theme}
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
                          theme={theme}
                        />
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div
                          className={joinClasses(
                            "rounded-2xl border p-4",
                            theme.riskPanel,
                          )}
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold">
                              Initial risk
                            </h3>
                            <RiskBadge score={initialScore} darkMode={darkMode} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label>
                              <span
                                className={joinClasses(
                                  "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
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
                                className={joinClasses(
                                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                                  theme.select,
                                )}
                              >
                                {riskValues.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span
                                className={joinClasses(
                                  "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
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
                                className={joinClasses(
                                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                                  theme.select,
                                )}
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
                            <div
                              className={joinClasses(
                                "rounded-xl border p-3",
                                theme.miniCard,
                              )}
                            >
                              <div
                                className={joinClasses(
                                  "text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
                                Initial Risk Score
                              </div>
                              <div className={joinClasses("mt-2 text-2xl font-bold", theme.scoreText)}>
                                {initialScore}
                              </div>
                            </div>
                            <div
                              className={joinClasses(
                                "rounded-xl border p-3",
                                theme.miniCard,
                              )}
                            >
                              <div
                                className={joinClasses(
                                  "text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
                                Initial Risk Level
                              </div>
                              <div className="mt-2">
                                <RiskBadge score={initialScore} darkMode={darkMode} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className={joinClasses(
                            "rounded-2xl border p-4",
                            theme.riskPanel,
                          )}
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold">
                              Residual risk
                            </h3>
                            <RiskBadge score={residualScore} darkMode={darkMode} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label>
                              <span
                                className={joinClasses(
                                  "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
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
                                className={joinClasses(
                                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                                  theme.select,
                                )}
                              >
                                {riskValues.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span
                                className={joinClasses(
                                  "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
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
                                className={joinClasses(
                                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                                  theme.select,
                                )}
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
                            <div
                              className={joinClasses(
                                "rounded-xl border p-3",
                                theme.miniCard,
                              )}
                            >
                              <div
                                className={joinClasses(
                                  "text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
                                Residual Risk Score
                              </div>
                              <div className={joinClasses("mt-2 text-2xl font-bold", theme.scoreText)}>
                                {residualScore}
                              </div>
                            </div>
                            <div
                              className={joinClasses(
                                "rounded-xl border p-3",
                                theme.miniCard,
                              )}
                            >
                              <div
                                className={joinClasses(
                                  "text-xs font-bold uppercase tracking-[0.14em]",
                                  theme.label,
                                )}
                              >
                                Residual Risk Level
                              </div>
                              <div className="mt-2">
                                <RiskBadge score={residualScore} darkMode={darkMode} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <span
                            className={joinClasses(
                              "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                              theme.label,
                            )}
                          >
                            Control hierarchy used
                          </span>
                          <div className="grid gap-2">
                            {controlHierarchyOptions.map((option) => (
                              <label
                                key={option}
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                  hazard.controlHierarchy.includes(option)
                                    ? theme.checkboxSelected
                                    : theme.checkboxIdle
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
                          theme={theme}
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
                          theme={theme}
                          type="date"
                        />
                        <label>
                          <span
                            className={joinClasses(
                              "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                              theme.label,
                            )}
                          >
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
                            className={joinClasses(
                              "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                              theme.select,
                            )}
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
                          theme={theme}
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
            <RiskMatrixGuide darkMode={darkMode} theme={theme} />

            <section
              className={joinClasses(
                "rounded-3xl border p-5 backdrop-blur-2xl",
                theme.section,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Saved assessments</h2>
                  <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                    Load previous manual risk assessments.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {savedAssessments.length === 0 ? (
                  <div
                    className={joinClasses(
                      "rounded-2xl border border-dashed px-4 py-6 text-sm",
                      theme.emptyState,
                    )}
                  >
                    No saved risk assessments yet.
                  </div>
                ) : null}

                {savedAssessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className={joinClasses(
                      "rounded-2xl border p-4 transition",
                      theme.savedCard(currentAssessmentId === assessment.id),
                    )}
                  >
                    <div className={joinClasses("font-semibold", theme.heading)}>
                      {assessment.header.title || "Untitled risk assessment"}
                    </div>
                    <div className={joinClasses("mt-1 text-xs leading-5", theme.muted)}>
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
                        className={joinClasses(
                          "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                          theme.deleteButton,
                        )}
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

        {hasWorkspaceCompanyBranding ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              background: "#FFFFFF",
              border: "1px solid #D8E7F7",
              borderRadius: "18px",
              padding: "16px 18px",
              marginBottom: "20px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "#64748B",
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Client workspace
              </div>
              <div
                style={{
                  color: "#071225",
                  fontSize: "18px",
                  fontWeight: 900,
                  lineHeight: 1.25,
                }}
              >
                {workspaceCompanyName || header.company || "Company not provided"}
              </div>
              {workspaceCompanyDetails.length > 0 ? (
                <div
                  style={{
                    marginTop: "6px",
                    color: "#475569",
                    fontSize: "11px",
                    lineHeight: 1.55,
                  }}
                >
                  {workspaceCompanyDetails.join(" | ")}
                </div>
              ) : null}
            </div>
            {workspaceCompanyProfile.logoDataUrl ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "132px",
                  minHeight: "62px",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  padding: "10px",
                }}
              >
                <Image
                  src={workspaceCompanyProfile.logoDataUrl}
                  alt={`${workspaceCompanyName || "Company"} logo`}
                  width={120}
                  height={58}
                  unoptimized
                  style={{
                    maxWidth: "112px",
                    maxHeight: "50px",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

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
