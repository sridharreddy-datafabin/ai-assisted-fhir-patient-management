import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPatientName,
  type FhirPatient,
} from "@/lib/fhir";
import { AlertTriangle, ShieldCheck, Sparkles, Info, Copy, Check, ChevronDown, ChevronUp, FileJson, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  patient: FhirPatient;
}

type CandidateType =
  | "condition"
  | "problem"
  | "symptom"
  | "social factor"
  | "review item";

type Confidence = "High" | "Medium" | "Low";

type Context =
  | "Present"
  | "Negated"
  | "Historical"
  | "Family history"
  | "Uncertain";

type Status = "Needs review" | "Reviewed" | "Excluded" | "Excluded by context";

type SpecificityStatus =
  | "Specific"
  | "Generic"
  | "Possible duplicate"
  | "Needs specificity review";

interface Candidate {
  id: string;
  text: string;
  type: CandidateType;
  confidence: Confidence;
  sourcePhrase: string;
  context: Context;
  suggestedAction: string;
  status: Status;
  included: boolean;
  overridden: boolean;
  searchTerm: string;
  specificity: SpecificityStatus;
  overlapGroup: string | null;
}

type CodingReadiness =
  | "Ready for SNOMED search"
  | "Needs clinician review"
  | "Needs specificity review"
  | "Excluded by context"
  | "Low confidence"
  | "Uncertain context";

const SEARCH_NORMALISE: Record<string, string> = {
  "type 2 diabetes": "diabetes mellitus type 2",
  "diabetes": "diabetes mellitus",
  "diabetic": "diabetes mellitus",
  "shortness of breath": "dyspnea",
  "high blood pressure": "hypertension",
  "low mood": "depressive symptoms",
  "medication review": "medication review",
  "neck injury": "injury of neck",
};

// Generic → specific pairs that are NOT substring-related but are clinically related.
const SPECIFICITY_PAIRS: Array<[string, string]> = [
  ["depression", "depressive symptoms"],
  ["low mood", "depression"],
];

// Pairs where the "specific" side actually requires further clarification.
const NEEDS_SPECIFICITY_REVIEW_TERMS = new Set<string>([
  "depressive symptoms",
]);

function suggestSearchTerm(text: string): string {
  const key = text.toLowerCase().trim();
  return SEARCH_NORMALISE[key] ?? text;
}

function codingReadinessFor(c: Candidate): CodingReadiness {
  const contextExcluded =
    (c.context === "Negated" || c.context === "Family history") && !c.overridden;
  if (contextExcluded) return "Excluded by context";

  if (c.specificity === "Possible duplicate") return "Needs specificity review";
  if (c.specificity === "Needs specificity review") return "Needs clinician review";

  if (c.confidence === "Low") return "Low confidence";
  if (c.context === "Historical") return "Needs clinician review";
  if (c.context === "Uncertain") return "Uncertain context";

  if (c.specificity === "Generic") return "Needs specificity review";

  return "Ready for SNOMED search";
}

interface TermDef {
  term: string;
  type: CandidateType;
  confidence: Confidence;
}

const TERMS: TermDef[] = [
  { term: "type 2 diabetes", type: "condition", confidence: "High" },
  { term: "diabetes", type: "condition", confidence: "High" },
  { term: "diabetic", type: "condition", confidence: "High" },
  { term: "hypertension", type: "condition", confidence: "High" },
  { term: "heart disease", type: "condition", confidence: "High" },
  { term: "childhood asthma", type: "condition", confidence: "High" },
  { term: "asthma", type: "condition", confidence: "High" },
  { term: "shortness of breath", type: "symptom", confidence: "Medium" },
  { term: "chest pain", type: "symptom", confidence: "Medium" },
  { term: "neck pain", type: "symptom", confidence: "Medium" },
  { term: "pain", type: "symptom", confidence: "Low" },
  { term: "low mood", type: "symptom", confidence: "Medium" },
  { term: "wrist fracture", type: "condition", confidence: "Medium" },
  { term: "fracture", type: "condition", confidence: "Medium" },
  { term: "neck injury", type: "condition", confidence: "Medium" },
  { term: "injury", type: "condition", confidence: "Low" },
  { term: "social isolation", type: "social factor", confidence: "Medium" },
  { term: "medication review", type: "review item", confidence: "Low" },
  { term: "depressive symptoms", type: "symptom", confidence: "Medium" },
  { term: "depression", type: "condition", confidence: "High" },
  { term: "anxiety", type: "condition", confidence: "High" },
  { term: "obesity", type: "condition", confidence: "High" },
  { term: "smoking", type: "social factor", confidence: "Medium" },
  { term: "chronic kidney disease", type: "condition", confidence: "High" },
  { term: "COPD", type: "condition", confidence: "High" },
];

const SAMPLES: Record<string, { label: string; text: string }> = {
  diabetes: {
    label: "Diabetes follow-up",
    text: "Patient attended for diabetes follow-up. Type 2 diabetes remains poorly controlled. Patient also has hypertension. No chest pain reported. Medication review completed.",
  },
  respiratory: {
    label: "Respiratory review",
    text: "Patient reports intermittent shortness of breath. Possible asthma discussed. Childhood asthma noted. Denies chest pain. Family history of COPD in father.",
  },
  injury: {
    label: "Injury review",
    text: "Patient has neck pain and neck injury after a recent fall. Generalised injury noted. Previous wrist fracture in 2018. No evidence of new fracture on examination.",
  },
  social: {
    label: "Social care review",
    text: "Patient reports social isolation, low mood and depressive symptoms. Possible depression. Mother had depression. Patient denies anxiety. Medication review due.",
  },
};

// Context detection patterns
const NEGATION_PRE = [
  /\bno\b/i,
  /\bdenies\b/i,
  /\bdenied\b/i,
  /\bno evidence of\b/i,
  /\bno history of\b/i,
  /\bnot\b/i,
  /\bwithout\b/i,
  /\bnegative for\b/i,
];
const NEGATION_POST = [/\bruled out\b/i, /\bexcluded\b/i];
const FAMILY_PRE = [
  /\bfamily history of\b/i,
  /\bparental history of\b/i,
  /\bfather (has|had)\b/i,
  /\bmother (has|had)\b/i,
  /\bbrother (has|had)\b/i,
  /\bsister (has|had)\b/i,
  /\bparent (has|had)\b/i,
  /\bin (father|mother|brother|sister|parent)\b/i,
];
const HISTORICAL_PRE = [
  /\bpast history of\b/i,
  /\bprevious\b/i,
  /\bhistory of\b/i,
  /\bresolved\b/i,
  /\bin remission\b/i,
  /\bchildhood\b/i,
  /\bold\b/i,
  /\bprior\b/i,
];
const UNCERTAIN_PRE = [
  /\bpossible\b/i,
  /\bsuspected\b/i,
  /\bquery\b/i,
  /\?$/,
  /\blikely\b/i,
  /\brule out\b/i,
  /\bdifferential diagnosis (includes|of)\b/i,
  /\b\?\s*$/,
];

function detectContext(
  fullText: string,
  termStart: number,
  termEnd: number,
): Context {
  const sentenceStart = Math.max(
    fullText.lastIndexOf(".", termStart - 1),
    fullText.lastIndexOf("\n", termStart - 1),
    -1,
  );
  const pre = fullText.slice(sentenceStart + 1, termStart);
  const post = fullText.slice(termEnd, Math.min(fullText.length, termEnd + 60));

  const immediatelyBefore = fullText.slice(Math.max(0, termStart - 2), termStart);
  if (immediatelyBefore.trim().endsWith("?")) return "Uncertain";

  if (FAMILY_PRE.some((r) => r.test(pre))) return "Family history";
  if (NEGATION_POST.some((r) => r.test(post))) return "Negated";
  if (NEGATION_PRE.some((r) => r.test(pre))) return "Negated";
  if (UNCERTAIN_PRE.some((r) => r.test(pre))) return "Uncertain";
  if (HISTORICAL_PRE.some((r) => r.test(pre))) return "Historical";
  return "Present";
}

function defaultsForContext(ctx: Context): {
  included: boolean;
  status: Status;
  suggestedAction: string;
} {
  switch (ctx) {
    case "Negated":
      return {
        included: false,
        status: "Excluded by context",
        suggestedAction: "Do not code unless clinician overrides",
      };
    case "Family history":
      return {
        included: false,
        status: "Excluded by context",
        suggestedAction: "Do not code as patient condition",
      };
    case "Historical":
      return {
        included: true,
        status: "Needs review",
        suggestedAction:
          "Review whether this should be coded as active, resolved, or historical",
      };
    case "Uncertain":
      return {
        included: true,
        status: "Needs review",
        suggestedAction: "Review before coding",
      };
    case "Present":
    default:
      return {
        included: true,
        status: "Needs review",
        suggestedAction: "Review before coding",
      };
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function annotateSpecificity(cs: Candidate[]): Candidate[] {
  type Info = {
    specificity: SpecificityStatus;
    overlapGroup: string | null;
  };
  const info = new globalThis.Map<string, Info>();
  cs.forEach((c) =>
    info.set(c.id, { specificity: "Specific", overlapGroup: null }),
  );

  // Exact duplicate detection (by lowered text)
  const byText = new globalThis.Map<string, Candidate[]>();
  cs.forEach((c) => {
    const k = c.text.toLowerCase().trim();
    const arr = byText.get(k) ?? [];
    arr.push(c);
    byText.set(k, arr);
  });

  // Generic↔specific via substring (whole word) or explicit pairs
  for (let i = 0; i < cs.length; i++) {
    for (let j = 0; j < cs.length; j++) {
      if (i === j) continue;
      const a = cs[i];
      const b = cs[j];
      const at = a.text.toLowerCase().trim();
      const bt = b.text.toLowerCase().trim();
      if (at === bt) continue;

      const substringHit =
        bt.length > at.length && new RegExp(`\\b${escapeRe(at)}\\b`, "i").test(bt);
      const pairHit = SPECIFICITY_PAIRS.some(
        ([g, s]) => g === at && s === bt,
      );

      if (substringHit || pairHit) {
        const ai = info.get(a.id)!;
        const bi = info.get(b.id)!;
        if (ai.specificity !== "Possible duplicate") ai.specificity = "Generic";
        ai.overlapGroup = ai.overlapGroup ?? at;
        bi.overlapGroup = bi.overlapGroup ?? at;
        if (NEEDS_SPECIFICITY_REVIEW_TERMS.has(bt)) {
          if (bi.specificity === "Specific")
            bi.specificity = "Needs specificity review";
        }
      }
    }
  }

  // Apply duplicate status (overrides Generic)
  byText.forEach((rows, key) => {
    if (rows.length > 1) {
      rows.forEach((r) => {
        const inf = info.get(r.id)!;
        inf.specificity = "Possible duplicate";
        inf.overlapGroup = inf.overlapGroup ?? key;
      });
    }
  });

  return cs.map((c) => {
    const inf = info.get(c.id)!;
    let suggestedAction = c.suggestedAction;
    if (c.context !== "Negated" && c.context !== "Family history") {
      if (inf.specificity === "Specific")
        suggestedAction = "Review before coding";
      else if (inf.specificity === "Generic")
        suggestedAction =
          "Consider excluding if a more specific candidate is correct";
      else if (inf.specificity === "Possible duplicate")
        suggestedAction = "Review duplicate extraction";
      else if (inf.specificity === "Needs specificity review")
        suggestedAction = "Clarify concept before SNOMED coding";
    }
    return {
      ...c,
      specificity: inf.specificity,
      overlapGroup: inf.overlapGroup,
      suggestedAction,
    };
  });
}

function extractCandidates(note: string): Candidate[] {
  if (!note.trim()) return [];
  const lower = note.toLowerCase();
  const found: Candidate[] = [];
  const consumed: Array<[number, number]> = [];

  const sorted = [...TERMS].sort((a, b) => b.term.length - a.term.length);

  for (const def of sorted) {
    const needle = def.term.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      const end = idx + needle.length;
      const overlap = consumed.some(([s, e]) => idx < e && end > s);
      if (!overlap) {
        consumed.push([idx, end]);
        const sentenceStart = Math.max(
          note.lastIndexOf(".", idx - 1),
          note.lastIndexOf("\n", idx - 1),
        );
        const sentenceEndDot = note.indexOf(".", end);
        const sentenceEnd =
          sentenceEndDot === -1 ? note.length : sentenceEndDot + 1;
        const phrase = note.slice(sentenceStart + 1, sentenceEnd).trim();

        const context = detectContext(note, idx, end);
        const defs = defaultsForContext(context);

        found.push({
          id: `${def.term}-${idx}`,
          text: note.slice(idx, end),
          type: def.type,
          confidence: def.confidence,
          sourcePhrase: phrase || note.slice(idx, end),
          context,
          suggestedAction: defs.suggestedAction,
          status: defs.status,
          included: defs.included,
          overridden: false,
          searchTerm: suggestSearchTerm(note.slice(idx, end)),
          specificity: "Specific",
          overlapGroup: null,
        });
      }
      idx = end;
    }
  }
  const sortedByPos = found.sort((a, b) => {
    const aIdx = parseInt(a.id.split("-").pop() ?? "0", 10);
    const bIdx = parseInt(b.id.split("-").pop() ?? "0", 10);
    return aIdx - bIdx;
  });
  return annotateSpecificity(sortedByPos);
}

type ClinicalStatusCode = "active" | "resolved";
type VerificationStatusCode = "provisional" | "differential";

function statusesForContext(
  ctx: Context,
  confidence: Confidence,
): { clinical: ClinicalStatusCode; verification: VerificationStatusCode } {
  if (confidence === "Low") return { clinical: "active", verification: "provisional" };
  switch (ctx) {
    case "Historical":
      return { clinical: "resolved", verification: "provisional" };
    case "Uncertain":
      return { clinical: "active", verification: "differential" };
    case "Present":
    default:
      return { clinical: "active", verification: "provisional" };
  }
}

const CLINICAL_DISPLAY: Record<ClinicalStatusCode, string> = {
  active: "Active",
  resolved: "Resolved",
};
const VERIFICATION_DISPLAY: Record<VerificationStatusCode, string> = {
  provisional: "Provisional",
  differential: "Differential",
};

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildConditionPreview(
  c: Candidate,
  patient: FhirPatient,
): Record<string, unknown> {
  const { clinical, verification } = statusesForContext(c.context, c.confidence);
  const localCode = `nlp-${c.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  return {
    resourceType: "Condition",
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: clinical,
          display: CLINICAL_DISPLAY[clinical],
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: verification,
          display: VERIFICATION_DISPLAY[verification],
        },
      ],
    },
    code: {
      text: c.text,
      coding: [
        {
          system: "urn:local:nlp-candidate",
          code: localCode,
          display: c.text,
        },
      ],
    },
    subject: {
      reference: patient.id ? `Patient/${patient.id}` : "Patient/unknown",
      display: formatPatientName(patient),
    },
    recordedDate: todayIsoDate(),
    note: [
      {
        text: "Preview generated from NLP candidate. Requires clinician review and SNOMED coding before saving.",
      },
    ],
    extension: [
      {
        url: "https://example.org/fhir/StructureDefinition/nlp-source-context",
        valueString: c.context,
      },
      {
        url: "https://example.org/fhir/StructureDefinition/nlp-confidence",
        valueString: c.confidence,
      },
      {
        url: "https://example.org/fhir/StructureDefinition/nlp-source-phrase",
        valueString: c.sourcePhrase,
      },
      {
        url: "https://example.org/fhir/StructureDefinition/nlp-specificity-status",
        valueString: c.specificity,
      },
      {
        url: "https://example.org/fhir/StructureDefinition/nlp-suggested-snomed-search-term",
        valueString: c.searchTerm,
      },
    ],
  };
}

const ELIGIBLE_READINESS = new Set<CodingReadiness>([
  "Ready for SNOMED search",
  "Needs specificity review",
  "Needs clinician review",
  "Uncertain context",
  "Low confidence",
]);

function isEligibleForPreview(c: Candidate): boolean {
  if (!c.included) return false;
  if (c.status === "Excluded" || c.status === "Excluded by context") return false;
  if (c.context === "Negated" || c.context === "Family history") {
    if (!c.overridden) return false;
  }
  const r = codingReadinessFor(c);
  return ELIGIBLE_READINESS.has(r);
}

function ConfidenceBadge({ value }: { value: Confidence }) {
  const map: Record<Confidence, string> = {
    High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Low: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[value]}`}>
      {value}
    </span>
  );
}

function TypeBadge({ value }: { value: CandidateType }) {
  return (
    <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium capitalize text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
      {value}
    </span>
  );
}

function ContextBadge({ value }: { value: Context }) {
  const map: Record<Context, string> = {
    Present: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Negated: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    Historical: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "Family history": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    Uncertain: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[value]}`}>
      {value}
    </span>
  );
}

function SpecificityBadge({ value }: { value: SpecificityStatus }) {
  const map: Record<SpecificityStatus, string> = {
    Specific: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    Generic: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "Possible duplicate": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
    "Needs specificity review": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[value]}`}>
      {value}
    </span>
  );
}

type FilterKey =
  | "All"
  | "Present"
  | "Negated"
  | "Historical"
  | "Family history"
  | "Uncertain"
  | "Included only"
  | "Excluded only"
  | "Reviewed only"
  | "Specific"
  | "Generic"
  | "Possible duplicate"
  | "Needs specificity review";

const FILTERS: FilterKey[] = [
  "All",
  "Present",
  "Negated",
  "Historical",
  "Family history",
  "Uncertain",
  "Included only",
  "Excluded only",
  "Reviewed only",
  "Specific",
  "Generic",
  "Possible duplicate",
  "Needs specificity review",
];

function isActivelyIncluded(c: Candidate) {
  return (
    c.included &&
    c.status !== "Excluded" &&
    c.status !== "Excluded by context"
  );
}

export function ClinicalNotesTab({ patient }: Props) {
  const [note, setNote] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [copied, setCopied] = useState(false);
  const [previewsGenerated, setPreviewsGenerated] = useState(false);
  const [excludedPreviewIds, setExcludedPreviewIds] = useState<Set<string>>(new Set());
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  const [copiedPreviewId, setCopiedPreviewId] = useState<string | null>(null);
  const [copiedAllPreviews, setCopiedAllPreviews] = useState(false);

  // overlap warning per id: true when this candidate shares an overlap group with another *included* candidate
  const overlapWarnings = useMemo(() => {
    const w = new globalThis.Map<string, boolean>();
    candidates.forEach((c) => {
      if (!c.overlapGroup || !isActivelyIncluded(c)) {
        w.set(c.id, false);
        return;
      }
      const sibling = candidates.some(
        (o) =>
          o.id !== c.id &&
          o.overlapGroup === c.overlapGroup &&
          isActivelyIncluded(o),
      );
      w.set(c.id, sibling);
    });
    return w;
  }, [candidates]);

  const overlapGroups = useMemo(() => {
    const groups = new globalThis.Map<string, Candidate[]>();
    candidates.forEach((c) => {
      if (!c.overlapGroup) return;
      const arr = groups.get(c.overlapGroup) ?? [];
      arr.push(c);
      groups.set(c.overlapGroup, arr);
    });
    // Only keep groups with 2+ rows
    return Array.from(groups.entries()).filter(([, rows]) => rows.length > 1);
  }, [candidates]);

  const anyOverlapIncluded = useMemo(
    () => Array.from(overlapWarnings.values()).some(Boolean),
    [overlapWarnings],
  );

  const selectedQueue = useMemo(
    () =>
      candidates.filter((c) => {
        if (!isActivelyIncluded(c)) return false;
        const contextuallyExcluded =
          c.context === "Negated" || c.context === "Family history";
        if (contextuallyExcluded && !c.overridden) return false;
        return true;
      }),
    [candidates],
  );

  const queueSummary = useMemo(() => {
    const by = (fn: (c: Candidate) => boolean) => selectedQueue.filter(fn).length;
    return {
      included: selectedQueue.length,
      ready: by((c) => codingReadinessFor(c) === "Ready for SNOMED search"),
      needsReview: by((c) => codingReadinessFor(c) === "Needs clinician review"),
      needsSpecificity: by((c) => codingReadinessFor(c) === "Needs specificity review"),
      lowConfidence: by((c) => codingReadinessFor(c) === "Low confidence"),
      uncertain: by((c) => codingReadinessFor(c) === "Uncertain context"),
      excludedByContext: by((c) => codingReadinessFor(c) === "Excluded by context"),
    };
  }, [selectedQueue]);

  const specificitySummary = useMemo(() => {
    const by = (fn: (c: Candidate) => boolean) => candidates.filter(fn).length;
    return {
      specific: by((c) => c.specificity === "Specific"),
      generic: by((c) => c.specificity === "Generic"),
      duplicate: by((c) => c.specificity === "Possible duplicate"),
      needsSpec: by((c) => c.specificity === "Needs specificity review"),
      overlapGroups: overlapGroups.length,
    };
  }, [candidates, overlapGroups]);

  async function copyQueueJson() {
    const payload = selectedQueue.map((c) => ({
      patientId: patient.id ?? null,
      patientName: formatPatientName(patient),
      candidateText: c.text,
      type: c.type,
      context: c.context,
      confidence: c.confidence,
      sourcePhrase: c.sourcePhrase,
      suggestedSnomedSearchTerm: c.searchTerm,
      specificityStatus: c.specificity,
      overlapGroup: c.overlapGroup,
      overlapWarning: overlapWarnings.get(c.id) ?? false,
      codingReadiness: codingReadinessFor(c),
      included: c.included,
      reviewed: c.status === "Reviewed",
    }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  const summary = useMemo(() => {
    const by = (fn: (c: Candidate) => boolean) => candidates.filter(fn).length;
    return {
      total: candidates.length,
      present: by((c) => c.context === "Present"),
      negated: by((c) => c.context === "Negated"),
      historical: by((c) => c.context === "Historical"),
      family: by((c) => c.context === "Family history"),
      uncertain: by((c) => c.context === "Uncertain"),
      included: by(isActivelyIncluded),
      excluded: by(
        (c) => c.status === "Excluded" || c.status === "Excluded by context",
      ),
      reviewed: by((c) => c.status === "Reviewed"),
    };
  }, [candidates]);

  const visible = useMemo(() => {
    switch (filter) {
      case "All":
        return candidates;
      case "Included only":
        return candidates.filter(isActivelyIncluded);
      case "Excluded only":
        return candidates.filter(
          (c) => c.status === "Excluded" || c.status === "Excluded by context",
        );
      case "Reviewed only":
        return candidates.filter((c) => c.status === "Reviewed");
      case "Specific":
      case "Generic":
      case "Possible duplicate":
      case "Needs specificity review":
        return candidates.filter((c) => c.specificity === filter);
      default:
        return candidates.filter((c) => c.context === filter);
    }
  }, [candidates, filter]);

  function loadSample(key: keyof typeof SAMPLES) {
    setNote(SAMPLES[key].text);
  }

  function runExtraction() {
    setCandidates(extractCandidates(note));
  }

  function updateCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function toggleInclude(c: Candidate, next: boolean) {
    if (next) {
      const isContextExcluded =
        c.context === "Negated" || c.context === "Family history";
      updateCandidate(c.id, {
        included: true,
        status: "Needs review",
        overridden: isContextExcluded ? true : c.overridden,
      });
    } else {
      updateCandidate(c.id, {
        included: false,
        status: "Excluded",
        overridden: false,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Patient context */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Name</div>
            <div className="font-medium text-foreground">{formatPatientName(patient)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Patient ID</div>
            <div className="break-all font-mono text-xs text-foreground">{patient.id ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Gender</div>
            <div className="font-medium capitalize text-foreground">{patient.gender ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Date of birth</div>
            <div className="font-medium text-foreground">{patient.birthDate ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Preview-only banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          This NLP workflow is preview-only. Extracted candidates are not saved to the
          FHIR server and are not automatically coded.
        </div>
      </div>

      {/* Note input */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-foreground">Clinical note</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SAMPLES).map(([key, s]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                onClick={() => loadSample(key as keyof typeof SAMPLES)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter or paste a clinical note, consultation summary, discharge summary, or referral text..."
          className="min-h-[180px]"
        />
        <div className="flex justify-end">
          <Button onClick={runExtraction} disabled={!note.trim()}>
            <Sparkles className="mr-2 h-4 w-4" />
            Extract candidate conditions
          </Button>
        </div>
      </div>

      {/* Context summary */}
      {candidates.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {[
            { label: "Total", value: summary.total },
            { label: "Present", value: summary.present },
            { label: "Negated", value: summary.negated },
            { label: "Historical", value: summary.historical },
            { label: "Family hx", value: summary.family },
            { label: "Uncertain", value: summary.uncertain },
            { label: "Included", value: summary.included },
            { label: "Excluded", value: summary.excluded },
            { label: "Reviewed", value: summary.reviewed },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-xl font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Specificity summary */}
      {candidates.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Specific", value: specificitySummary.specific },
            { label: "Generic", value: specificitySummary.generic },
            { label: "Possible duplicate", value: specificitySummary.duplicate },
            { label: "Needs specificity review", value: specificitySummary.needsSpec },
            { label: "Overlap groups", value: specificitySummary.overlapGroups },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-xl font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Overlap warning banner */}
      {anyOverlapIncluded && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Potential duplicate or overlapping concepts detected. Review specificity
            before coding.
          </div>
        </div>
      )}

      {/* Overlap groups list */}
      {overlapGroups.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">Overlap groups</div>
          <div className="space-y-2">
            {overlapGroups.map(([group, rows]) => (
              <div key={group} className="rounded border border-border bg-muted/30 p-3 text-sm">
                <div className="font-medium text-foreground">Overlap group: {group}</div>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {rows.map((r) => (
                    <li key={r.id}>
                      {r.text}{" "}
                      <span className="text-xs">({r.specificity})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      )}

      {/* Candidates table */}
      {candidates.length > 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold text-foreground">Candidate clinical concepts</h3>
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {candidates.length} candidate(s)
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Include</TableHead>
                <TableHead>Extracted text</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Specificity</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Source phrase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Suggested action</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const hardExcluded = c.status === "Excluded";
                const hasOverlap = overlapWarnings.get(c.id) ?? false;
                return (
                  <TableRow key={c.id} className={hardExcluded ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isActivelyIncluded(c)}
                        onCheckedChange={(v) => toggleInclude(c, Boolean(v))}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.text}
                      {c.overlapGroup && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Overlap group: {c.overlapGroup}
                        </div>
                      )}
                    </TableCell>
                    <TableCell><TypeBadge value={c.type} /></TableCell>
                    <TableCell><ContextBadge value={c.context} /></TableCell>
                    <TableCell><SpecificityBadge value={c.specificity} /></TableCell>
                    <TableCell><ConfidenceBadge value={c.confidence} /></TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">{c.sourcePhrase}</TableCell>
                    <TableCell className="text-sm">
                      {c.status}
                      {c.overridden && (
                        <div className="mt-1 flex items-start gap-1 rounded border border-amber-300 bg-amber-50 p-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            This candidate was excluded by context. Include only if
                            clinically appropriate.
                          </span>
                        </div>
                      )}
                      {hasOverlap && (
                        <div className="mt-1 flex items-start gap-1 rounded border border-orange-300 bg-orange-50 p-1.5 text-[11px] text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            This candidate overlaps with a more specific candidate.
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      {c.suggestedAction}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={c.status === "Reviewed"}
                          onClick={() => updateCandidate(c.id, { status: "Reviewed" })}
                        >
                          Mark as reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={hardExcluded}
                          onClick={() =>
                            updateCandidate(c.id, {
                              status: "Excluded",
                              included: false,
                              overridden: false,
                            })
                          }
                        >
                          Exclude
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                    No candidates match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No candidates extracted yet. Enter a note and click "Extract candidate conditions".
        </div>
      )}

      {/* Explanatory note */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Context, specificity and duplicate detection are rule-based. Clinician review
          is required before coding or saving any condition.
        </div>
      </div>

      {/* SNOMED review preparation */}
      {candidates.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">SNOMED review preparation</h3>
              <p className="text-xs text-muted-foreground">
                Selected candidates queued for later terminology coding review.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={copyQueueJson} disabled={selectedQueue.length === 0}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy coding queue JSON"}
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              This SNOMED review queue is preview-only. No terminology search, coding,
              mapping, or FHIR save occurs in this step.
            </div>
          </div>

          {/* Queue summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {[
              { label: "Included", value: queueSummary.included },
              { label: "Ready for search", value: queueSummary.ready },
              { label: "Needs review", value: queueSummary.needsReview },
              { label: "Needs specificity", value: queueSummary.needsSpecificity },
              { label: "Low confidence", value: queueSummary.lowConfidence },
              { label: "Uncertain", value: queueSummary.uncertain },
              { label: "Excluded by context", value: queueSummary.excludedByContext },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Queue table */}
          <div className="rounded-lg border border-border">
            <div className="border-b border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">Selected candidates for SNOMED review</h4>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate text</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Specificity</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Source phrase</TableHead>
                  <TableHead>Review status</TableHead>
                  <TableHead>Suggested SNOMED search term</TableHead>
                  <TableHead>Coding readiness</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedQueue.map((c) => {
                  const readiness = codingReadinessFor(c);
                  const hasOverlap = overlapWarnings.get(c.id) ?? false;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.text}
                        {c.overlapGroup && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Overlap group: {c.overlapGroup}
                          </div>
                        )}
                      </TableCell>
                      <TableCell><TypeBadge value={c.type} /></TableCell>
                      <TableCell><ContextBadge value={c.context} /></TableCell>
                      <TableCell><SpecificityBadge value={c.specificity} /></TableCell>
                      <TableCell><ConfidenceBadge value={c.confidence} /></TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">{c.sourcePhrase}</TableCell>
                      <TableCell className="text-sm">{c.status}</TableCell>
                      <TableCell>
                        <Input
                          value={c.searchTerm}
                          onChange={(e) => updateCandidate(c.id, { searchTerm: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            readiness === "Ready for SNOMED search"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : readiness === "Excluded by context"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {readiness}
                        </span>
                        {c.overridden && (
                          <div className="mt-1 flex items-start gap-1 rounded border border-amber-300 bg-amber-50 p-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              This candidate was included manually despite contextual
                              exclusion. Review carefully before coding.
                            </span>
                          </div>
                        )}
                        {hasOverlap && (
                          <div className="mt-1 flex items-start gap-1 rounded border border-orange-300 bg-orange-50 p-1.5 text-[11px] text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              This candidate overlaps with a more specific candidate.
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateCandidate(c.id, {
                              status: "Excluded",
                              included: false,
                              overridden: false,
                            })
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {selectedQueue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                      No candidates selected for SNOMED review yet. Include candidates above to add them to the queue.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled variant="outline">Prepare SNOMED searches</Button>
            <Button disabled variant="outline">Open in SNOMED Concept Search</Button>
            <Button disabled variant="outline">Generate Condition previews</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            SNOMED search is disabled until terminology credentials are configured.
            This step only prepares candidate terms for later coding review.
          </p>
        </div>
      )}

      {/* Specificity explanatory note */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Specificity and duplicate detection are rule-based. Clinician review is
          required before coding or saving any condition.
        </div>
      </div>

      {/* Future workflow */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Future coding workflow</h3>
        <p className="text-sm text-muted-foreground">
          In a later step, selected candidate conditions will be passed into the SNOMED
          Concept Search workflow. The clinician will select an appropriate SNOMED
          concept, review the generated FHIR Condition JSON, and approve before saving.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled variant="outline">Search SNOMED for selected candidates</Button>
          <Button disabled variant="outline">Generate FHIR Condition previews</Button>
          <Button disabled variant="outline">Save approved Conditions</Button>
        </div>
      </div>

      {/* Audit note */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          No AI extraction results are persisted. No clinical data is sent outside this
          app in Phase 3.
        </div>
      </div>
    </div>
  );
}
