"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* =========================
   LANGUAGE & TEXTS
========================= */

type Lang = "EN" | "KA";

const TEXT = {
  EN: {
    title: "PERSONAL PROTECTIVE EQUIPMENT (PPE) COMPLIANCE CHECKLIST",
    item: "Item",
    risk: "Risk",
    corrective: "Corrective action",
    responsible: "Responsible",
    deadline: "Deadline",
    comments: "Comments",
    company: "Company name",
    site: "Site / Location",
    inspector: "Inspector",
    date: "Inspection date",
    result: "Result",
    export: "Export inspection report (PDF)",
    compliant: "Compliant",
    partially: "Partially compliant",
    nonCompliant: "Non-compliant",
    noData: "No data",
  },
  KA: {
    title: "ინდივიდუალური დაცვის საშუალებების შესაბამისობის ჩექლისტი",
    item: "შეკითხვა",
    risk: "რისკი",
    corrective: "გასატარებელი ღონისძიება",
    responsible: "პასუხისმგებელი",
    deadline: "ვადა",
    comments: "კომენტარი",
    company: "კომპანიის დასახელება",
    site: "ობიექტი / ლოკაცია",
    inspector: "ინსპექტორი",
    date: "ინსპექტირების თარიღი",
    result: "შედეგი",
    export: "ინსპექტირების ანგარიშის ექსპორტი (PDF)",
    compliant: "შესაბამისობა",
    partially: "ნაწილობრივი შესაბამისობა",
    nonCompliant: "შეუსაბამობა",
    noData: "მონაცემები არ არის",
  },
};
/* =========================
   CHECKLIST DATA
========================= */

const CHECKLIST = [
  {
    sectionEN: "PPE RISK ASSESSMENT & SELECTION",
    sectionKA: "ინდივიდუალური დაცვის საშუალებების რისკების შეფასება და შერჩევა",
    items: [
      {
        EN: "PPE requirements are defined based on risk assessment",
        KA: "იდს მოთხოვნები განსაზღვრულია რისკების შეფასების საფუძველზე",
      },
      {
        EN: "PPE selection considers specific hazards and tasks",
        KA: "იდს შერჩევა ითვალისწინებს კონკრეტულ საფრთხეებსა და სამუშაოებს",
      },
      {
        EN: "PPE is selected after applying higher-level controls",
        KA: "იდს შერჩეულია უფრო მაღალი დონის კონტროლის ღონისძიებების შემდეგ",
      },
      {
        EN: "PPE is suitable for the work environment",
        KA: "იდს შეესაბამება სამუშაო გარემოს",
      },
      {
        EN: "PPE selection is reviewed when tasks or risks change",
        KA: "იდს შერჩევა გადახედილია სამუშაოს ან რისკების ცვლილებისას",
      },
    ],
  },
  {
    sectionEN: "PPE STANDARDS & COMPLIANCE",
    sectionKA: "იდს სტანდარტები და შესაბამისობა",
    items: [
      {
        EN: "PPE complies with applicable standards (EN / ANSI / ISO)",
        KA: "იდს შეესაბამება მოქმედ სტანდარტებს (EN / ANSI / ISO)",
      },
      {
        EN: "PPE markings and certifications are visible",
        KA: "იდს მარკირება და სერტიფიკაცია თვალსაჩინოა",
      },
      {
        EN: "PPE provides adequate protection level",
        KA: "იდს უზრუნველყოფს დაცვის შესაბამის დონეს",
      },
      {
        EN: "PPE is compatible when multiple items are worn together",
        KA: "იდს თავსებადია სხვა დამცავ საშუალებებთან ერთად გამოყენებისას",
      },
      {
        EN: "Non-compliant PPE is removed from use",
        KA: "არაშესაბამისი იდს ამოღებულია გამოყენებიდან",
      },
    ],
  },
  {
    sectionEN: "PPE AVAILABILITY & FIT",
    sectionKA: "იდს ხელმისაწვდომობა და მორგება",
    items: [
      {
        EN: "Required PPE is available at point of use",
        KA: "საჭირო იდს ხელმისაწვდომია გამოყენების ადგილზე",
      },
      {
        EN: "PPE is available in appropriate sizes",
        KA: "იდს ხელმისაწვდომია შესაბამის ზომებში",
      },
      {
        EN: "PPE fits workers correctly",
        KA: "იდს სწორად ერგება თანამშრომლებს",
      },
      {
        EN: "Respiratory PPE fit testing is conducted where required",
        KA: "რესპირატორული იდს მორგების ტესტირება ჩატარებულია საჭიროების შემთხვევაში",
      },
      {
        EN: "PPE does not create additional hazards",
        KA: "იდს არ ქმნის დამატებით საფრთხეებს",
      },
    ],
  },
  {
    sectionEN: "PPE CONDITION, MAINTENANCE & STORAGE",
    sectionKA: "იდს მდგომარეობა, მოვლა და შენახვა",
    items: [
      { EN: "PPE is in good condition", KA: "იდს კარგ მდგომარეობაშია" },
      {
        EN: "Damaged or defective PPE is replaced",
        KA: "დაზიანებული ან დეფექტური იდს შეცვლილია",
      },
      {
        EN: "PPE is cleaned and maintained as required",
        KA: "იდს იწმინდება და ინახება მოთხოვნების შესაბამისად",
      },
      {
        EN: "PPE is stored in clean and suitable locations",
        KA: "იდს ინახება სუფთა და შესაბამის ადგილებში",
      },
      {
        EN: "PPE with expiry dates is controlled",
        KA: "ვადაგასული იდს კონტროლდება",
      },
    ],
  },
  {
    sectionEN: "PPE USE & BEHAVIOR",
    sectionKA: "იდს გამოყენება და ქცევა",
    items: [
      {
        EN: "Workers wear PPE when required",
        KA: "თანამშრომლები ატარებენ იდს საჭიროების შემთხვევაში",
      },
      { EN: "PPE is worn correctly", KA: "იდს სწორად გამოიყენება" },
      {
        EN: "PPE is not modified or misused",
        KA: "იდს არ არის შეცვლილი ან არასწორად გამოყენებული",
      },
      {
        EN: "Supervisors enforce PPE requirements",
        KA: "ხელმძღვანელები აკონტროლებენ იდს გამოყენებას",
      },
      {
        EN: "Non-compliance is addressed promptly",
        KA: "არათანამშრომლობა დროულად აღმოიფხვრება",
      },
    ],
  },
];
/* =========================
   COMPONENT
========================= */

export default function Home() {
  const [lang, setLang] = useState<Lang>("EN");
  const t = TEXT[lang];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [risk, setRisk] = useState<Record<string, string>>({});

  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const [inspector, setInspector] = useState("");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [openSection, setOpenSection] = useState<number | null>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showFab, setShowFab] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  /* =========================
     RESPONSIVE DETECTION
  ========================= */

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* =========================
     SCROLL DETECTION
  ========================= */

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const current = window.scrollY;

      setScrolled(current > 10);

      if (current > lastScrollY) {
        setShowFab(false);
      } else {
        setShowFab(true);
      }

      lastScrollY = current;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const existing = localStorage.getItem("laboria_ppe_history");
    if (existing) {
      setHistory(JSON.parse(existing));
    }
  }, []);

  /* =========================
     CALCULATIONS
  ========================= */

  const calculateResult = () => {
    const values = Object.values(answers);
    const applicable = values.filter((v) => v !== "na");
    const yesCount = applicable.filter((v) => v === "yes").length;

    if (applicable.length === 0) {
      return { percent: 0, status: t.noData };
    }

    const percent = Math.round((yesCount / applicable.length) * 100);

    if (percent >= 90) return { percent, status: t.compliant };
    if (percent >= 70) return { percent, status: t.partially };

    return { percent, status: t.nonCompliant };
  };
  const result = calculateResult();
  const calculateRiskSummary = () => {
    const values = Object.values(risk);

    const high = values.filter((v) => v === "H").length;
    const medium = values.filter((v) => v === "M").length;
    const low = values.filter((v) => v === "L").length;

    return { high, medium, low };
  };

  const riskSummary = calculateRiskSummary();

  const calculateSectionResult = (sectionIndex: number) => {
    const section = CHECKLIST[sectionIndex];

    const ids = section.items.map((_, qi) => `${sectionIndex}-${qi}`);
    const values = ids.map((id) => answers[id]).filter((v) => v && v !== "na");

    if (values.length === 0) {
      return { percent: 0 };
    }

    const yesCount = values.filter((v) => v === "yes").length;
    const percent = Math.round((yesCount / values.length) * 100);

    return { percent };
  };

  /* =========================
     PDF EXPORT
  ========================= */

  const handleExportPDF = async () => {
    const element = document.getElementById("inspection-report");
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: darkMode ? "#1f2937" : "#cfe5c9",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("LABORIA_PPE_Checklist.pdf");
  };
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadFromHistory = (item: any) => {
    setAnswers(item.answers || {});
    setRisk(item.risk || {});
    setCompany(item.company || "");
    setSite(item.site || "");
    setInspector(item.inspector || "");
    setInspectionDate(item.inspectionDate || "");
  };

  const deleteInspection = (id: number) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    localStorage.setItem("laboria_ppe_history", JSON.stringify(updated));
  };

  const saveInspection = () => {
    const inspectionData = {
      id: Date.now(),
      company,
      site,
      inspector,
      inspectionDate,
      answers,
      risk,
      result,
      savedAt: new Date().toISOString(),
    };

    const existing = localStorage.getItem("laboria_ppe_history");
    const historyData = existing ? JSON.parse(existing) : [];

    historyData.push(inspectionData);

    localStorage.setItem("laboria_ppe_history", JSON.stringify(historyData));
  };

  const loadInspection = () => {
    const saved = localStorage.getItem("laboria_ppe_inspection");

    if (!saved) return;

    const parsed = JSON.parse(saved);

    setAnswers(parsed.answers || {});
    setRisk(parsed.risk || {});
    setCompany(parsed.company || "");
    setSite(parsed.site || "");
    setInspector(parsed.inspector || "");
    setInspectionDate(parsed.inspectionDate || "");
  };

  const generateAIInsight = async () => {
    try {
      setAiLoading(true);
      setAiError(null);

      const res = await fetch("/api/ai-insight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers,
          lang,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI request failed");
      }

      setAiInsight(data.result);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center relative overflow-hidden bg-[#050816]">
      {/* SPACE GLOW BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.15),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(99,102,241,0.15),transparent_40%)]" />

      {/* DEEP GRADIENT LAYER */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 via-transparent to-indigo-900/40" />

      {/* CONTENT WRAPPER */}
      <div className="relative z-10 w-full max-w-[1100px]">
        <div
          id="inspection-report"
          className="w-full max-w-[960px] px-6 md:px-12 py-10 space-y-8 transition-colors duration-300"
          style={{
            background: darkMode ? "#0F172A" : "#F3F4F6",
            color: darkMode ? "#F3F4F6" : "#000000",
          }}
        >
          {/* LANGUAGE SWITCH */}
          <div className="flex justify-end gap-2 mb-2">
            <button onClick={() => setLang("EN")}>EN</button>
            <button onClick={() => setLang("KA")}>KA</button>
          </div>

          {/* PREMIUM GLASS HEADER */}
          <div className="mb-6">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-transparent backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              {/* subtle glow */}

              <div className="relative z-10 px-8 py-6">
                <div className="flex items-center gap-4">
                  <Image
                    src="/laboria-logo.png"
                    alt="Laboria"
                    width={120}
                    height={40}
                    className="object-contain drop-shadow-md"
                  />

                  {/* Top Right Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveInspection}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center
  transition-all duration-200 shadow-md
  ${
    darkMode
      ? "bg-slate-800 hover:bg-slate-700 text-white"
      : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
  }
`}
                      title={lang === "KA" ? "შენახვა" : "Save"}
                    >
                      💾
                    </button>

                    <button
                      onClick={() => setShowHistory(true)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center
  transition-all duration-200 shadow-md
  ${
    darkMode
      ? "bg-slate-800 hover:bg-slate-700 text-white"
      : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
  }
`}
                      title={lang === "KA" ? "ისტორია" : "History"}
                    >
                      🕘
                    </button>

                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center
                 border border-slate-500/30
                 hover:bg-slate-700/20
                 transition-all duration-200"
                      title="Theme"
                    >
                      {darkMode ? "☀" : "🌙"}
                    </button>
                  </div>
                </div>

                <h1
                  className={`text-2xl md:text-3xl font-semibold tracking-tight leading-snug ${
                    darkMode ? "text-white" : "text-black"
                  }`}
                >
                  {t.title}
                </h1>

                <p
                  className={`mt-2 text-sm tracking-wide ${
                    darkMode ? "text-white/70" : "text-gray-600"
                  }`}
                >
                  {lang === "EN"
                    ? "Compliance Inspection Checklist"
                    : "ინსპექტირების შესაბამისობის ჩექლისტი"}
                </p>
              </div>
            </div>
          </div>

          {/* INFO */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm mt-4">
            <div>
              {t.company}:
              <input
                className="border-b border-black bg-transparent ml-2"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div>
              {t.date}:
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
              />
            </div>

            <div>
              {t.site}:
              <input
                className="border-b border-black bg-transparent ml-2 w-full"
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
            </div>

            <div>
              {t.inspector}:
              <input
                className="border-b border-black bg-transparent ml-2"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
              />
            </div>
          </div>

          {/* RESULT - PREMIUM VERSION */}
          <div className="mb-8">
            <div
              className={`
      relative overflow-hidden
      rounded-2xl
      px-6 py-5
      border
      transition-all duration-500
      ${
        darkMode
          ? "bg-[#111827] border-[#1F2937] shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
          : "bg-white border-gray-200 shadow-md"
      }
    `}
            >
              {/* Left Accent Line */}
              <div
                className={`
        absolute left-0 top-0 h-full w-1 rounded-l-2xl
        ${
          result.percent >= 90
            ? "bg-emerald-500"
            : result.percent >= 70
              ? "bg-amber-500"
              : "bg-rose-500"
        }
      `}
              />

              <div className="pl-3 space-y-3">
                {/* Title */}
                <div className="text-sm font-medium opacity-70">{t.result}</div>

                {/* Percentage */}
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold tracking-tight">
                    {result.percent}%
                  </span>

                  <span className="text-sm font-medium opacity-70">
                    {result.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full rounded-full bg-slate-700/20 overflow-hidden">
                  <div
                    className={`
            h-full transition-all duration-700 ease-out
            ${
              result.percent >= 90
                ? "bg-emerald-500"
                : result.percent >= 70
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }
          `}
                    style={{ width: `${result.percent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* RISK SUMMARY CARD */}
          <div className="mb-8">
            <div
              className={`rounded-2xl p-6 border transition-all duration-300 ${
                darkMode
                  ? "bg-[#111827] border-[#1F2937] text-slate-100"
                  : "bg-white border-gray-200 text-gray-800"
              }`}
            >
              <h3 className="text-lg font-semibold mb-4">
                {lang === "KA" ? "რისკების შეჯამება" : "Risk Summary"}
              </h3>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl p-4 bg-rose-500/10">
                  <div className="text-2xl font-bold text-rose-500">
                    {riskSummary.high}
                  </div>
                  <div className="text-sm">
                    {lang === "KA" ? "მაღალი" : "High"}
                  </div>
                </div>

                <div className="rounded-xl p-4 bg-amber-500/10">
                  <div className="text-2xl font-bold text-amber-500">
                    {riskSummary.medium}
                  </div>
                  <div className="text-sm">
                    {lang === "KA" ? "საშუალო" : "Medium"}
                  </div>
                </div>

                <div className="rounded-xl p-4 bg-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-500">
                    {riskSummary.low}
                  </div>
                  <div className="text-sm">
                    {lang === "KA" ? "დაბალი" : "Low"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* SMART RISK WARNING BANNER */}
          {(riskSummary.high > 0 ||
            riskSummary.medium > 0 ||
            riskSummary.low > 0) && (
            <div
              className={`mb-8 rounded-2xl p-5 border transition-all duration-300 ${
                riskSummary.high > 0
                  ? "bg-rose-500/10 border-rose-500 text-rose-500"
                  : riskSummary.medium > 0
                    ? "bg-amber-500/10 border-amber-500 text-amber-500"
                    : "bg-emerald-500/10 border-emerald-500 text-emerald-500"
              }`}
            >
              <div className="font-semibold text-sm">
                {riskSummary.high > 0
                  ? lang === "KA"
                    ? "მაღალი რისკები დაფიქსირდა — დაუყოვნებლივი მოქმედება აუცილებელია."
                    : "High risks detected — Immediate action required."
                  : riskSummary.medium > 0
                    ? lang === "KA"
                      ? "საშუალო რისკები გამოვლენილია — რეკომენდებულია კონტროლის ზომები."
                      : "Medium risks identified — Control improvement recommended."
                    : lang === "KA"
                      ? "დაბალი რისკები — მდგომარეობა სტაბილურია."
                      : "Low risks only — Situation under control."}
              </div>
            </div>
          )}

          {/* SIMPLE CHECKLIST RENDER */}
          <div className="space-y-10">
            {CHECKLIST.map((sec, si) => (
              <div
                key={si}
                className={`border rounded ${
                  darkMode ? "bg-gray-800 border-gray-600" : "bg-white"
                }`}
              >
                <div
                  onClick={() => setOpenSection(openSection === si ? null : si)}
                  className={`px-6 py-5 rounded-2xl cursor-pointer transition-all duration-500 backdrop-blur-xl border ${
                    darkMode
                      ? "bg-white/5 border-white/10 hover:bg-white/10"
                      : "bg-white/70 border-gray-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tracking-wide text-sm uppercase">
                      {lang === "EN" ? sec.sectionEN : sec.sectionKA}
                    </span>
                    <div className="text-xs mt-1 opacity-70">
                      {calculateSectionResult(si).percent}%{" "}
                      {lang === "EN" ? "Compliant" : "შესაბამისობა"}
                    </div>
                    <div className="mt-2 h-1 w-full bg-gray-300 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          calculateSectionResult(si).percent >= 90
                            ? "bg-emerald-500"
                            : calculateSectionResult(si).percent >= 70
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{
                          width: `${calculateSectionResult(si).percent}%`,
                        }}
                      />
                    </div>

                    <span>{openSection === si ? "−" : "+"}</span>
                  </div>
                </div>

                {openSection === si && (
                  <div className="px-6 py-6 space-y-6">
                    {sec.items.map((q, qi) => {
                      const id = `${si}-${qi}`;
                      return (
                        <div
                          key={id}
                          className={`p-6 rounded-2xl border transition-all duration-300 ${
                            darkMode
                              ? "bg-[#1E293B] border-[#334155]"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div className="mb-4">
                            {lang === "EN" ? q.EN : q.KA}
                          </div>

                          <div className="flex gap-2 mb-4">
                            {["yes", "no", "na"].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() =>
                                  setAnswers({ ...answers, [id]: v })
                                }
                                className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                                  answers[id] === v
                                    ? v === "yes"
                                      ? "bg-emerald-600 text-white"
                                      : v === "no"
                                        ? "bg-red-600 text-white"
                                        : "bg-gray-600 text-white"
                                    : darkMode
                                      ? "bg-slate-700 text-slate-200"
                                      : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                {v.toUpperCase()}
                              </button>
                            ))}
                          </div>

                          <select
                            value={risk[id] || ""}
                            onChange={(e) =>
                              setRisk({ ...risk, [id]: e.target.value })
                            }
                            className={`w-full px-4 py-3 rounded-xl border transition-all ${
                              darkMode
                                ? "bg-[#0F172A] text-slate-100 border-[#334155]"
                                : "bg-white text-gray-800 border-gray-300"
                            }`}
                          >
                            <option value="">Select Risk</option>
                            <option value="L">Low</option>
                            <option value="M">Medium</option>
                            <option value="H">High</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`
    fixed bottom-8 right-8 z-50
    transition-all duration-500
    ${showFab ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"}
  `}
      >
        <button
          onClick={handleExportPDF}
          className={`
    fixed bottom-6 right-6
    w-12 h-12
    rounded-full
    flex items-center justify-center
    shadow-lg
    transition-all duration-300
    ${
      result.percent >= 90
        ? "bg-emerald-600 hover:bg-emerald-500"
        : result.percent >= 70
          ? "bg-amber-500 hover:bg-amber-400"
          : "bg-rose-600 hover:bg-rose-500"
    }
  `}
        >
          <span className="text-white text-lg">↓</span>
        </button>
      </div>

      {/* HISTORY SLIDE PANEL */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[320px]
          bg-[#0F172A] text-white
          shadow-2xl border-l border-white/10
          transform transition-transform duration-300 z-50
          ${showHistory ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="p-6 flex justify-between items-center border-b border-white/10">
          <h2 className="text-lg font-semibold">
            {lang === "KA" ? "ინსპექტირების ისტორია" : "Inspection History"}
          </h2>
          <button
            onClick={() => setShowHistory(false)}
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto h-full">
          {history.length === 0 && (
            <div className="text-sm opacity-60">
              {lang === "KA" ? "ისტორია ცარიელია" : "No saved inspections"}
            </div>
          )}

          {history.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="font-medium">{item.company || "Unnamed"}</div>

              <div className="text-xs opacity-60 mb-3">
                {item.inspectionDate}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadFromHistory(item)}
                  className="px-3 py-1 text-xs bg-blue-600 rounded-md"
                >
                  {lang === "KA" ? "ჩატვირთვა" : "Load"}
                </button>

                <button
                  onClick={() => deleteInspection(item.id)}
                  className="px-3 py-1 text-xs bg-red-600 rounded-md"
                >
                  {lang === "KA" ? "წაშლა" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
