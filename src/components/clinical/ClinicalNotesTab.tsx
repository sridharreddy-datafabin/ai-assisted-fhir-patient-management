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
import { AlertTriangle, ShieldCheck, Sparkles, Info } from "lucide-react";

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
  { term: "asthma", type: "condition", confidence: "High" },
  { term: "shortness of breath", type: "symptom", confidence: "Medium" },
  { term: "chest pain", type: "symptom", confidence: "Medium" },
  { term: "neck pain", type: "symptom", confidence: "Medium" },
  { term: "low mood", type: "symptom", confidence: "Medium" },
  { term: "fracture", type: "condition", confidence: "Medium" },
  { term: "neck injury", type: "condition", confidence: "Medium" },
  { term: "social isolation", type: "social factor", confidence: "Medium" },
  { term: "medication review", type: "review item", confidence: "Low" },
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
    text: "Patient reports intermittent shortness of breath. Possible asthma discussed. Denies chest pain. Family history of COPD noted in father.",
  },
  injury: {
    label: "Injury review",
    text: "Patient has neck pain after a recent fall. Previous fracture of wrist in 2018. No evidence of new fracture on examination.",
  },
  social: {
    label: "Social care review",
    text: "Patient reports social isolation and low mood. Mother had depression. Patient denies anxiety. Medication review due.",
  },
};

// Context detection patterns — applied to the window of text before the term
// (and a small lookahead for "ruled out / excluded" patterns).
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
const NEGATION_POST = [
  /\bruled out\b/i,
  /\bexcluded\b/i,
];
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
  // Window: from previous sentence boundary to term, and a short lookahead.
  const sentenceStart = Math.max(
    fullText.lastIndexOf(".", termStart - 1),
    fullText.lastIndexOf("\n", termStart - 1),
    -1,
  );
  const pre = fullText.slice(sentenceStart + 1, termStart);
  const post = fullText.slice(termEnd, Math.min(fullText.length, termEnd + 60));

  // "?term" prefix
  const immediatelyBefore = fullText.slice(Math.max(0, termStart - 2), termStart);
  if (immediatelyBefore.trim().endsWith("?")) return "Uncertain";

  if (FAMILY_PRE.some((r) => r.test(pre))) return "Family history";
  if (NEGATION_POST.some((r) => r.test(post))) return "Negated";
  if (NEGATION_PRE.some((r) => r.test(pre))) {
    // Special-case: "no history of X" should be Negated (not Historical).
    return "Negated";
  }
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
        });
      }
      idx = end;
    }
  }
  return found.sort((a, b) => {
    const aIdx = parseInt(a.id.split("-").pop() ?? "0", 10);
    const bIdx = parseInt(b.id.split("-").pop() ?? "0", 10);
    return aIdx - bIdx;
  });
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
    Present:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Negated:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    Historical:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "Family history":
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    Uncertain:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
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
  | "Reviewed only";

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
];

export function ClinicalNotesTab({ patient }: Props) {
  const [note, setNote] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filter, setFilter] = useState<FilterKey>("All");

  const summary = useMemo(() => {
    const by = (fn: (c: Candidate) => boolean) => candidates.filter(fn).length;
    return {
      total: candidates.length,
      present: by((c) => c.context === "Present"),
      negated: by((c) => c.context === "Negated"),
      historical: by((c) => c.context === "Historical"),
      family: by((c) => c.context === "Family history"),
      uncertain: by((c) => c.context === "Uncertain"),
      included: by(
        (c) =>
          c.included &&
          c.status !== "Excluded" &&
          c.status !== "Excluded by context",
      ),
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
        return candidates.filter(
          (c) =>
            c.included &&
            c.status !== "Excluded" &&
            c.status !== "Excluded by context",
        );
      case "Excluded only":
        return candidates.filter(
          (c) => c.status === "Excluded" || c.status === "Excluded by context",
        );
      case "Reviewed only":
        return candidates.filter((c) => c.status === "Reviewed");
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
      // Including
      const isContextExcluded =
        c.context === "Negated" || c.context === "Family history";
      updateCandidate(c.id, {
        included: true,
        status: "Needs review",
        overridden: isContextExcluded ? true : c.overridden,
      });
    } else {
      // Excluding
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

      {/* Summary */}
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
                return (
                  <TableRow key={c.id} className={hardExcluded ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={
                          c.included &&
                          c.status !== "Excluded" &&
                          c.status !== "Excluded by context"
                        }
                        onCheckedChange={(v) => toggleInclude(c, Boolean(v))}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.text}</TableCell>
                    <TableCell><TypeBadge value={c.type} /></TableCell>
                    <TableCell><ContextBadge value={c.context} /></TableCell>
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
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
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
          Context detection is rule-based and intended for workflow support only.
          Clinician review is required before coding or saving any condition.
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
