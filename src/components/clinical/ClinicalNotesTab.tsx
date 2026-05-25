import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { AlertTriangle, ShieldCheck, Sparkles, Info, Copy, Check, ChevronDown, ChevronUp, FileJson, Ban, ThumbsUp, ThumbsDown, RotateCcw, ClipboardList, Edit3, ExternalLink, Send, Clock, Trash2 } from "lucide-react";
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

type ApprovalStatus =
  | "Not reviewed"
  | "Approved for coding"
  | "Needs changes"
  | "Rejected";

type ReviewPriority =
  | "Routine"
  | "Needs clinician review"
  | "Urgent review"
  | "Do not code";

const APPROVAL_STATUSES: ApprovalStatus[] = [
  "Not reviewed",
  "Approved for coding",
  "Needs changes",
  "Rejected",
];

const REVIEW_PRIORITIES: ReviewPriority[] = [
  "Routine",
  "Needs clinician review",
  "Urgent review",
  "Do not code",
];

type SnomedCodingStatus =
  | "Awaiting SNOMED search"
  | "Search opened"
  | "Authentication required"
  | "Coding deferred"
  | "Manually removed";

interface CodingQueueItem {
  candidateId: string;
  codingStatus: SnomedCodingStatus;
  addedAt: string;
}

interface ApprovalRecord {
  status: ApprovalStatus;
  notes: string;
  priority: ReviewPriority;
  clinical: ClinicalStatusCode;
  verification: VerificationStatusCode;
  searchTerm: string;
  contextOverrideConfirmed: boolean;
}

function defaultApprovalFor(c: Candidate): ApprovalRecord {
  const s = statusesForContext(c.context, c.confidence);
  return {
    status: "Not reviewed",
    notes: "",
    priority: "Routine",
    clinical: s.clinical,
    verification: s.verification,
    searchTerm: c.searchTerm,
    contextOverrideConfirmed: false,
  };
}

function buildConditionPreviewWith(
  c: Candidate,
  patient: FhirPatient,
  a: ApprovalRecord,
): Record<string, unknown> {
  const base = buildConditionPreview(c, patient) as Record<string, unknown>;
  (base.clinicalStatus as { coding: Array<{ code: string; display: string; system: string }> }).coding[0] = {
    system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
    code: a.clinical,
    display: CLINICAL_DISPLAY[a.clinical],
  };
  (base.verificationStatus as { coding: Array<{ code: string; display: string; system: string }> }).coding[0] = {
    system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
    code: a.verification,
    display: VERIFICATION_DISPLAY[a.verification],
  };
  const ext = base.extension as Array<{ url: string; valueString: string }>;
  base.extension = ext.map((e) =>
    e.url.endsWith("nlp-suggested-snomed-search-term")
      ? { ...e, valueString: a.searchTerm }
      : e,
  );
  (base.extension as Array<{ url: string; valueString: string }>).push(
    {
      url: "https://example.org/fhir/StructureDefinition/nlp-review-priority",
      valueString: a.priority,
    },
    {
      url: "https://example.org/fhir/StructureDefinition/nlp-approval-status",
      valueString: a.status,
    },
  );
  return base;
}

function ApprovalBadge({ value }: { value: ApprovalStatus }) {
  const map: Record<ApprovalStatus, string> = {
    "Not reviewed": "bg-muted text-muted-foreground",
    "Approved for coding": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    "Needs changes": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[value]}`}>
      {value}
    </span>
  );
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
  const [approvals, setApprovals] = useState<globalThis.Map<string, ApprovalRecord>>(
    new globalThis.Map(),
  );
  const [approvalFilter, setApprovalFilter] = useState<"All" | ApprovalStatus>("All");
  const [copiedApprovalPkg, setCopiedApprovalPkg] = useState(false);
  const [codingQueue, setCodingQueue] = useState<globalThis.Map<string, CodingQueueItem>>(
    new globalThis.Map(),
  );
  const [copiedHandoff, setCopiedHandoff] = useState(false);

  function sendApprovedToCodingQueue(approvedIds: string[]) {
    setCodingQueue((prev) => {
      const next = new globalThis.Map(prev);
      const now = new Date().toISOString();
      approvedIds.forEach((id) => {
        if (!next.has(id)) {
          next.set(id, {
            candidateId: id,
            codingStatus: "Awaiting SNOMED search",
            addedAt: now,
          });
        }
      });
      return next;
    });
  }

  function updateCodingStatus(id: string, codingStatus: SnomedCodingStatus) {
    setCodingQueue((prev) => {
      const next = new globalThis.Map(prev);
      const cur = next.get(id);
      if (!cur) return prev;
      next.set(id, { ...cur, codingStatus });
      return next;
    });
  }

  function removeFromCodingQueue(id: string) {
    setCodingQueue((prev) => {
      const next = new globalThis.Map(prev);
      next.delete(id);
      return next;
    });
  }

  function getApproval(c: Candidate): ApprovalRecord {
    return approvals.get(c.id) ?? defaultApprovalFor(c);
  }

  function patchApproval(c: Candidate, patch: Partial<ApprovalRecord>) {
    setApprovals((prev) => {
      const next = new globalThis.Map(prev);
      const cur = next.get(c.id) ?? defaultApprovalFor(c);
      next.set(c.id, { ...cur, ...patch });
      return next;
    });
  }

  function setApprovalStatusFor(c: Candidate, status: ApprovalStatus) {
    if (status === "Approved for coding") {
      const cur = getApproval(c);
      const needsOverride =
        (c.context === "Negated" || c.context === "Family history") &&
        !cur.contextOverrideConfirmed;
      if (needsOverride) {
        const ok = globalThis.confirm(
          `This candidate has context "${c.context}" and would normally be excluded. ` +
            `Approve as a clinician override?`,
        );
        if (!ok) return;
        patchApproval(c, { status, contextOverrideConfirmed: true });
        return;
      }
    }
    patchApproval(c, { status });
  }

  function resetApprovalFor(c: Candidate) {
    setApprovals((prev) => {
      const next = new globalThis.Map(prev);
      next.delete(c.id);
      return next;
    });
  }

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

  // FHIR Condition preview computations
  const eligiblePreviewCandidates = useMemo(
    () => selectedQueue.filter((c) => isEligibleForPreview(c) && !excludedPreviewIds.has(c.id)),
    [selectedQueue, excludedPreviewIds],
  );

  const previews = useMemo(
    () =>
      eligiblePreviewCandidates.map((c) => ({
        candidate: c,
        readiness: codingReadinessFor(c),
        resource: buildConditionPreview(c, patient),
      })),
    [eligiblePreviewCandidates, patient],
  );

  const previewSummary = useMemo(() => {
    const by = (fn: (r: CodingReadiness) => boolean) =>
      previews.filter((p) => fn(p.readiness)).length;
    return {
      total: previews.length,
      ready: by((r) => r === "Ready for SNOMED search"),
      needsReview: by((r) => r === "Needs clinician review" || r === "Needs specificity review"),
      lowConfidence: by((r) => r === "Low confidence"),
      historical: previews.filter((p) => p.candidate.context === "Historical").length,
      uncertain: previews.filter((p) => p.candidate.context === "Uncertain").length,
      specificityReview: by((r) => r === "Needs specificity review"),
    };
  }, [previews]);

  function generatePreviews() {
    setExcludedPreviewIds(new Set());
    setPreviewsGenerated(true);
  }

  function togglePreviewExpanded(id: string) {
    setExpandedPreviews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function excludeFromPreviews(id: string) {
    setExcludedPreviewIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  async function copyPreviewJson(id: string, resource: Record<string, unknown>) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(resource, null, 2));
      setCopiedPreviewId(id);
      setTimeout(() => setCopiedPreviewId(null), 1500);
    } catch {
      /* noop */
    }
  }

  async function copyAllPreviews() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(previews.map((p) => p.resource), null, 2),
      );
      setCopiedAllPreviews(true);
      setTimeout(() => setCopiedAllPreviews(false), 1500);
    } catch {
      /* noop */
    }
  }



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

      {/* FHIR Condition previews */}
      {candidates.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">FHIR Condition previews</h3>
              <p className="text-xs text-muted-foreground">
                Preview-only FHIR R4 Condition resources generated from eligible NLP candidates.
                Local placeholder coding is used until SNOMED coding is implemented.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={generatePreviews}
                disabled={eligiblePreviewCandidates.length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate FHIR Condition previews
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={copyAllPreviews}
                disabled={!previewsGenerated || previews.length === 0}
              >
                {copiedAllPreviews ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiedAllPreviews ? "Copied" : "Copy all Condition previews JSON"}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              These FHIR Condition resources are previews only. They use local NLP
              candidate codes and must not be saved until reviewed, SNOMED-coded, and
              approved by a clinician.
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Clinician approval in this phase is session-only. Approved items are not
              saved to the FHIR server and do not become part of the patient record.
            </div>
          </div>

          {previewsGenerated && previews.length > 0 && (() => {
            const approvalSummary = {
              total: previews.length,
              notReviewed: previews.filter((p) => getApproval(p.candidate).status === "Not reviewed").length,
              approved: previews.filter((p) => getApproval(p.candidate).status === "Approved for coding").length,
              needsChanges: previews.filter((p) => getApproval(p.candidate).status === "Needs changes").length,
              rejected: previews.filter((p) => getApproval(p.candidate).status === "Rejected").length,
              lowConfidence: previews.filter((p) => p.candidate.confidence === "Low").length,
              specificityReview: previews.filter(
                (p) =>
                  p.candidate.specificity === "Generic" ||
                  p.candidate.specificity === "Possible duplicate" ||
                  p.candidate.specificity === "Needs specificity review",
              ).length,
              uncertain: previews.filter((p) => p.candidate.context === "Uncertain").length,
            };

            const filteredPreviews =
              approvalFilter === "All"
                ? previews
                : previews.filter((p) => getApproval(p.candidate).status === approvalFilter);

            const approvedPreviews = previews.filter(
              (p) => getApproval(p.candidate).status === "Approved for coding",
            );

            async function copyApprovalPackage() {
              const buildItem = (p: typeof previews[number]) => {
                const a = getApproval(p.candidate);
                const c = p.candidate;
                return {
                  candidateText: c.text,
                  context: c.context,
                  confidence: c.confidence,
                  specificityStatus: c.specificity,
                  sourcePhrase: c.sourcePhrase,
                  suggestedSnomedSearchTerm: a.searchTerm,
                  clinicalStatus: a.clinical,
                  verificationStatus: a.verification,
                  reviewPriority: a.priority,
                  approvalStatus: a.status,
                  reviewerNotes: a.notes,
                  conditionPreviewJson: buildConditionPreviewWith(c, patient, a),
                };
              };
              const payload = {
                patientId: patient.id ?? null,
                patientName: formatPatientName(patient),
                generatedAt: new Date().toISOString(),
                approvalSummary,
                approvedItems: approvedPreviews.map(buildItem),
                allPreviewItems: previews.map(buildItem),
              };
              try {
                await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                setCopiedApprovalPkg(true);
                setTimeout(() => setCopiedApprovalPkg(false), 1500);
              } catch {
                /* noop */
              }
            }

            return (
              <>
                {/* Preview + approval summary */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  {[
                    { label: "Total previews", value: approvalSummary.total },
                    { label: "Not reviewed", value: approvalSummary.notReviewed },
                    { label: "Approved", value: approvalSummary.approved },
                    { label: "Needs changes", value: approvalSummary.needsChanges },
                    { label: "Rejected", value: approvalSummary.rejected },
                    { label: "Low confidence", value: approvalSummary.lowConfidence },
                    { label: "Specificity review", value: approvalSummary.specificityReview },
                    { label: "Uncertain context", value: approvalSummary.uncertain },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                      <div className="mt-1 text-xl font-bold text-foreground">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Approval filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Filter:
                  </span>
                  {(["All", ...APPROVAL_STATUSES] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={approvalFilter === f ? "default" : "outline"}
                      onClick={() => setApprovalFilter(f)}
                    >
                      {f === "All" ? "All" : `Show ${f.toLowerCase()}`}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyApprovalPackage}
                    className="ml-auto"
                  >
                    {copiedApprovalPkg ? <Check className="mr-2 h-4 w-4" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                    {copiedApprovalPkg ? "Copied" : "Copy approval package JSON"}
                  </Button>
                </div>

                {/* Preview cards */}
                <div className="grid gap-3">
                  {filteredPreviews.map(({ candidate: c, readiness }) => {
                    const expanded = expandedPreviews.has(c.id);
                    const a = getApproval(c);
                    const resource = buildConditionPreviewWith(c, patient, a);
                    const warnings: string[] = [];
                    if (c.confidence === "Low") warnings.push("Low confidence — review before approval");
                    if (
                      c.specificity === "Generic" ||
                      c.specificity === "Possible duplicate" ||
                      c.specificity === "Needs specificity review"
                    )
                      warnings.push("Specificity review needed");
                    if (c.context === "Historical") warnings.push("Historical");
                    if (c.context === "Uncertain") warnings.push("Uncertain context — review before approval");
                    if (c.context === "Negated") warnings.push("Negated — requires clinician override to approve");
                    if (c.context === "Family history") warnings.push("Family history — requires clinician override to approve");
                    if (c.overridden) warnings.push("Manually overridden contextual exclusion");

                    return (
                      <div key={c.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-foreground">{c.text}</div>
                              <ApprovalBadge value={a.status} />
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <ContextBadge value={c.context} />
                              <ConfidenceBadge value={c.confidence} />
                              <SpecificityBadge value={c.specificity} />
                              <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                                {readiness}
                              </span>
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                Priority: {a.priority}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setApprovalStatusFor(c, "Approved for coding")}>
                              <ThumbsUp className="mr-1 h-4 w-4" />
                              Approve for coding
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setApprovalStatusFor(c, "Needs changes")}>
                              <Edit3 className="mr-1 h-4 w-4" />
                              Needs changes
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setApprovalStatusFor(c, "Rejected")}>
                              <ThumbsDown className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => resetApprovalFor(c)}>
                              <RotateCcw className="mr-1 h-4 w-4" />
                              Reset review
                            </Button>
                          </div>
                        </div>

                        {warnings.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {warnings.map((w) => (
                              <span
                                key={w}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {w}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Editable preview metadata */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Clinical status
                            </label>
                            <select
                              value={a.clinical}
                              onChange={(e) => patchApproval(c, { clinical: e.target.value as ClinicalStatusCode })}
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="active">active</option>
                              <option value="resolved">resolved</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Verification status
                            </label>
                            <select
                              value={a.verification}
                              onChange={(e) => patchApproval(c, { verification: e.target.value as VerificationStatusCode })}
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="provisional">provisional</option>
                              <option value="differential">differential</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Suggested SNOMED search term
                            </label>
                            <Input
                              value={a.searchTerm}
                              onChange={(e) => patchApproval(c, { searchTerm: e.target.value })}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Review priority
                            </label>
                            <select
                              value={a.priority}
                              onChange={(e) => patchApproval(c, { priority: e.target.value as ReviewPriority })}
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              {REVIEW_PRIORITIES.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Reviewer notes
                          </label>
                          <Textarea
                            value={a.notes}
                            onChange={(e) => patchApproval(c, { notes: e.target.value })}
                            placeholder="Add review notes, coding instructions, or clarification needed..."
                            className="mt-1 min-h-[70px] text-sm"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => togglePreviewExpanded(c.id)}>
                            {expanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                            {expanded ? "Hide JSON" : "Show JSON"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyPreviewJson(c.id, resource)}>
                            {copiedPreviewId === c.id ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                            {copiedPreviewId === c.id ? "Copied" : "Copy JSON"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => excludeFromPreviews(c.id)}>
                            <Ban className="mr-1 h-4 w-4" />
                            Exclude from previews
                          </Button>
                        </div>

                        {expanded && (
                          <pre className="overflow-auto rounded border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
                            {JSON.stringify(resource, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                  {filteredPreviews.length === 0 && (
                    <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No previews match this approval filter.
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <FileJson className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    FHIR JSON dates are rendered in ISO format: YYYY-MM-DD. Condition.code
                    uses the local placeholder system <code>urn:local:nlp-candidate</code>{" "}
                    until SNOMED coding is implemented.
                  </span>
                </div>

                {/* Approved for coding queue */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-base font-semibold text-foreground">Approved for coding queue</h4>
                      <p className="text-xs text-muted-foreground">
                        Approved items are ready for future SNOMED coding review, but are
                        not saved to FHIR in Phase 3 #6.
                      </p>
                    </div>
                  </div>
                  {approvedPreviews.length === 0 ? (
                    <div className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      No previews have been approved for coding yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Context</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Specificity</TableHead>
                          <TableHead>Suggested SNOMED search</TableHead>
                          <TableHead>Clinical</TableHead>
                          <TableHead>Verification</TableHead>
                          <TableHead>Reviewer notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedPreviews.map(({ candidate: c }) => {
                          const a = getApproval(c);
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.text}</TableCell>
                              <TableCell><ContextBadge value={c.context} /></TableCell>
                              <TableCell><ConfidenceBadge value={c.confidence} /></TableCell>
                              <TableCell><SpecificityBadge value={c.specificity} /></TableCell>
                              <TableCell className="text-sm">{a.searchTerm}</TableCell>
                              <TableCell className="text-sm">{a.clinical}</TableCell>
                              <TableCell className="text-sm">{a.verification}</TableCell>
                              <TableCell className="max-w-xs text-xs text-muted-foreground">
                                {a.notes || <span className="italic">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            );
          })()}

          {previewsGenerated && previews.length === 0 && (
            <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No eligible candidates to preview. Negated, family-history, and excluded
              candidates are not previewed.
            </div>
          )}

          {!previewsGenerated && (
            <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {eligiblePreviewCandidates.length} eligible candidate(s) ready. Click
              "Generate FHIR Condition previews" to build preview-only Condition
              resources.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled variant="outline">Save approved Conditions</Button>
            <Button disabled variant="outline">Create FHIR Conditions</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Saving to FHIR is disabled until SNOMED coding, validation, and final
            clinician sign-off are implemented.
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
          <Button disabled variant="outline">Save approved Conditions</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Saving is disabled until SNOMED coding and clinician approval are implemented.
        </p>
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
