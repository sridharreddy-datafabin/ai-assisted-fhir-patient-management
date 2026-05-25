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
import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";

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

interface Candidate {
  id: string;
  text: string;
  type: CandidateType;
  confidence: Confidence;
  sourcePhrase: string;
  status: "Needs review" | "Reviewed" | "Excluded";
  included: boolean;
}

interface TermDef {
  term: string;
  type: CandidateType;
  confidence: Confidence;
}

const TERMS: TermDef[] = [
  { term: "type 2 diabetes", type: "condition", confidence: "High" },
  { term: "diabetes", type: "condition", confidence: "High" },
  { term: "hypertension", type: "condition", confidence: "High" },
  { term: "asthma", type: "condition", confidence: "High" },
  { term: "shortness of breath", type: "symptom", confidence: "Medium" },
  { term: "chest pain", type: "symptom", confidence: "Medium" },
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
    text: "Patient attended for diabetes follow-up. Type 2 diabetes remains poorly controlled. Patient also reports hypertension and intermittent shortness of breath. No chest pain reported. Medication review completed. Follow-up blood pressure monitoring advised.",
  },
  respiratory: {
    label: "Respiratory review",
    text: "Respiratory review clinic. Known asthma, ongoing shortness of breath on exertion. History of COPD exacerbations in winter. Smoking 10/day, advised cessation support. No chest pain. Medication review completed and inhaler technique reviewed.",
  },
  injury: {
    label: "Injury review",
    text: "Patient seen following a fall last week. Reports neck injury and mild wrist fracture identified on X-ray. No loss of consciousness. Pain controlled with simple analgesia. Medication review completed. Follow-up in fracture clinic arranged.",
  },
  social: {
    label: "Social care review",
    text: "Social care review for elderly patient living alone. Reports social isolation and low mood consistent with depression and anxiety. Obesity noted. Known chronic kidney disease stage 3. Medication review completed. Referral to community team discussed.",
  },
};

function extractCandidates(note: string): Candidate[] {
  if (!note.trim()) return [];
  const lower = note.toLowerCase();
  const found: Candidate[] = [];
  const seen = new Set<string>();

  // Sort by term length desc so multi-word terms match before substrings.
  const sorted = [...TERMS].sort((a, b) => b.term.length - a.term.length);
  const consumed: Array<[number, number]> = [];

  for (const def of sorted) {
    const needle = def.term.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      const end = idx + needle.length;
      const overlap = consumed.some(([s, e]) => idx < e && end > s);
      if (!overlap && !seen.has(needle)) {
        consumed.push([idx, end]);
        seen.add(needle);
        // Source phrase: surrounding sentence.
        const sentenceStart = Math.max(
          note.lastIndexOf(".", idx - 1),
          note.lastIndexOf("\n", idx - 1),
        );
        const sentenceEndDot = note.indexOf(".", end);
        const sentenceEnd =
          sentenceEndDot === -1 ? note.length : sentenceEndDot + 1;
        const phrase = note
          .slice(sentenceStart + 1, sentenceEnd)
          .trim();
        found.push({
          id: `${def.term}-${idx}`,
          text: note.slice(idx, end),
          type: def.type,
          confidence: def.confidence,
          sourcePhrase: phrase || note.slice(idx, end),
          status: "Needs review",
          included: true,
        });
      }
      idx = end;
    }
  }
  return found;
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

export function ClinicalNotesTab({ patient }: Props) {
  const [note, setNote] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const summary = useMemo(() => {
    const total = candidates.length;
    const included = candidates.filter((c) => c.included && c.status !== "Excluded").length;
    const excluded = candidates.filter((c) => c.status === "Excluded").length;
    const reviewed = candidates.filter((c) => c.status === "Reviewed").length;
    return { total, included, excluded, reviewed };
  }, [candidates]);

  function loadSample(key: keyof typeof SAMPLES) {
    setNote(SAMPLES[key].text);
  }

  function runExtraction() {
    setCandidates(extractCandidates(note));
  }

  function updateCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total", value: summary.total },
            { label: "Included", value: summary.included },
            { label: "Excluded", value: summary.excluded },
            { label: "Reviewed", value: summary.reviewed },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Candidates table */}
      {candidates.length > 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold text-foreground">Candidate clinical concepts</h3>
            <p className="text-xs text-muted-foreground">Suggested action: Review before coding</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Include</TableHead>
                <TableHead>Extracted text</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Source phrase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => {
                const excluded = c.status === "Excluded";
                return (
                  <TableRow key={c.id} className={excluded ? "opacity-50 line-through" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={c.included && !excluded}
                        disabled={excluded}
                        onCheckedChange={(v) => updateCandidate(c.id, { included: Boolean(v) })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.text}</TableCell>
                    <TableCell><TypeBadge value={c.type} /></TableCell>
                    <TableCell><ConfidenceBadge value={c.confidence} /></TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{c.sourcePhrase}</TableCell>
                    <TableCell className="text-sm">{c.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={excluded || c.status === "Reviewed"}
                          onClick={() => updateCandidate(c.id, { status: "Reviewed" })}
                        >
                          Mark as reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={excluded}
                          onClick={() => updateCandidate(c.id, { status: "Excluded", included: false })}
                        >
                          Exclude
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No candidates extracted yet. Enter a note and click "Extract candidate conditions".
        </div>
      )}

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
          app in Phase 3 #1.
        </div>
      </div>
    </div>
  );
}
