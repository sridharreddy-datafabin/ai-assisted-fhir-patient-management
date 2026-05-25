import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  getConditions,
  getMedications,
  getVitals,
  formatPatientName,
  type FhirPatient,
} from "@/lib/fhir";
import { useWorkflowSnapshot, type WorkflowSnapshot } from "@/lib/workflow-store";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Check,
  FileJson,
  Info,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";

interface Props {
  patient: FhirPatient;
}

type CardStatus =
  | "complete"
  | "in-progress"
  | "pending"
  | "blocked"
  | "not-started"
  | "connected"
  | "error"
  | "not-configured"
  | "yes"
  | "no";

type TimelineStatus = "complete" | "in-progress" | "pending" | "blocked";

type WorkflowStatus =
  | "Not started"
  | "Ready for review"
  | "Terminology pending"
  | "Awaiting SNOMED coding"
  | "Awaiting validation"
  | "Awaiting final sign-off"
  | "Ready for FHIR save";

const EMPTY_SNAPSHOT: WorkflowSnapshot = {
  updatedAt: "",
  totalCandidates: 0,
  contextCounts: { Present: 0, Negated: 0, Historical: 0, "Family history": 0, Uncertain: 0 },
  included: 0,
  excluded: 0,
  reviewedCount: 0,
  needsReviewCount: 0,
  previewsGenerated: false,
  previewsCount: 0,
  approvedForCoding: 0,
  needsChanges: 0,
  rejected: 0,
  notReviewed: 0,
  inCodingQueue: 0,
  codingDeferred: 0,
  codingRemoved: 0,
  eligibleForSignOff: 0,
  signedOff: 0,
  needsSignOffReview: 0,
  notSigned: 0,
  hasOverlapWarnings: false,
  hasLowConfidence: false,
  hasNegatedExcluded: false,
  hasFamilyHistoryExcluded: false,
};

export function WorkflowSummaryTab({ patient }: Props) {
  const pid = patient.id ?? "";
  const live = useWorkflowSnapshot(pid);
  const snap = live ?? EMPTY_SNAPSHOT;
  const [copied, setCopied] = useState(false);

  const results = useQueries({
    queries: [
      { queryKey: ["conditions", pid], queryFn: () => getConditions(pid), enabled: !!pid },
      { queryKey: ["medications", pid], queryFn: () => getMedications(pid), enabled: !!pid },
      { queryKey: ["vitals", pid], queryFn: () => getVitals(pid), enabled: !!pid },
    ],
  });
  const [condQ, medQ, vitQ] = results;

  const fhirLoaded = !!patient.id && results.every((r) => r.isSuccess);
  const fhirLoading = results.some((r) => r.isLoading);

  const workflowStatus: WorkflowStatus = useMemo(() => {
    if (!live || snap.totalCandidates === 0) return "Terminology pending";
    if (snap.eligibleForSignOff > 0 && snap.signedOff === snap.eligibleForSignOff && snap.eligibleForSignOff > 0) {
      return "Ready for FHIR save";
    }
    if (snap.inCodingQueue > 0 && snap.eligibleForSignOff < snap.inCodingQueue) return "Awaiting validation";
    if (snap.approvedForCoding > 0 && snap.inCodingQueue === 0) return "Awaiting SNOMED coding";
    if (snap.approvedForCoding > 0) return "Awaiting SNOMED coding";
    if (snap.previewsGenerated && snap.approvedForCoding === 0) return "Ready for review";
    if (snap.totalCandidates > 0) return "Ready for review";
    return "Terminology pending";
  }, [live, snap]);

  const readyForFhirSave = false; // Always disabled in current phase.

  const cards: Array<{
    key: string;
    title: string;
    status: CardStatus;
    message?: string;
    bullets?: Array<{ label: string; value: string | number }>;
  }> = [
    {
      key: "fhir",
      title: "FHIR data loaded",
      status: fhirLoading ? "in-progress" : fhirLoaded ? "complete" : "not-started",
      bullets: [
        { label: "Patient resource", value: patient.id ? "Loaded" : "Not loaded" },
        { label: "Conditions", value: condQ.isSuccess ? `${condQ.data?.length ?? 0} loaded` : "Not loaded" },
        { label: "Observations", value: vitQ.isSuccess ? `${vitQ.data?.length ?? 0} loaded` : "Not loaded" },
        { label: "Medications", value: medQ.isSuccess ? `${medQ.data?.length ?? 0} loaded` : "Not loaded" },
      ],
    },
    {
      key: "term",
      title: "Terminology authentication",
      status: "pending",
      message:
        "NHS system-to-system credentials requested. Live SNOMED search and validation are pending.",
    },
    {
      key: "nlp",
      title: "NLP extraction",
      status: snap.totalCandidates === 0 ? "not-started" : "complete",
      bullets: [{ label: "Extracted candidates", value: snap.totalCandidates }],
    },
    {
      key: "review",
      title: "Candidate review",
      status:
        snap.totalCandidates === 0
          ? "not-started"
          : snap.needsReviewCount === 0
            ? "complete"
            : "in-progress",
      bullets: [
        { label: "Reviewed", value: snap.reviewedCount },
        { label: "Included", value: snap.included },
        { label: "Excluded", value: snap.excluded },
        { label: "Needs review", value: snap.needsReviewCount },
      ],
    },
    {
      key: "approved",
      title: "Approved for coding",
      status:
        snap.approvedForCoding === 0
          ? snap.previewsGenerated
            ? "in-progress"
            : "not-started"
          : "complete",
      bullets: [{ label: "Approved", value: snap.approvedForCoding }],
    },
    {
      key: "coding",
      title: "SNOMED coding",
      status: "pending",
      message: "SNOMED coding requires live terminology access and clinician-selected concepts.",
      bullets: [{ label: "In coding queue", value: snap.inCodingQueue }],
    },
    {
      key: "validation",
      title: "SNOMED validation",
      status: "pending",
      message:
        "Validation will use CodeSystem/$validate-code after terminology authentication is configured.",
    },
    {
      key: "signoff",
      title: "Final clinical sign-off",
      status:
        snap.eligibleForSignOff === 0
          ? "not-started"
          : snap.signedOff === snap.eligibleForSignOff
            ? "complete"
            : "in-progress",
      bullets: [
        { label: "Eligible items", value: snap.eligibleForSignOff },
        { label: "Signed off", value: snap.signedOff },
        { label: "Needs review", value: snap.needsSignOffReview },
      ],
    },
    {
      key: "ready",
      title: "Ready for FHIR save",
      status: readyForFhirSave ? "yes" : "no",
      message:
        "FHIR save remains disabled until SNOMED coding, validation, and final clinical sign-off are complete.",
    },
  ];

  type TLStep = { label: string; status: TimelineStatus; reason?: string };
  const timeline: TLStep[] = [
    {
      label: "FHIR data loaded",
      status: fhirLoaded ? "complete" : fhirLoading ? "in-progress" : "pending",
    },
    {
      label: "NLP extraction",
      status: snap.totalCandidates === 0 ? "pending" : "complete",
    },
    {
      label: "Candidate context review",
      status:
        snap.totalCandidates === 0
          ? "pending"
          : snap.reviewedCount > 0 || snap.excluded > 0
            ? "complete"
            : "in-progress",
    },
    {
      label: "Specificity review",
      status:
        snap.totalCandidates === 0
          ? "pending"
          : snap.hasOverlapWarnings
            ? "in-progress"
            : "complete",
    },
    {
      label: "Condition preview generated",
      status: snap.previewsGenerated ? "complete" : "pending",
    },
    {
      label: "Clinician approval",
      status:
        snap.approvedForCoding === 0
          ? snap.previewsGenerated
            ? "in-progress"
            : "pending"
          : "complete",
    },
    {
      label: "SNOMED coding handoff",
      status: snap.inCodingQueue === 0 ? "pending" : "complete",
    },
    {
      label: "SNOMED coding",
      status: "blocked",
      reason: "Awaiting NHS OntoServer authentication.",
    },
    {
      label: "SNOMED validation",
      status: "blocked",
      reason: "Awaiting NHS OntoServer authentication.",
    },
    {
      label: "Final clinical sign-off",
      status:
        snap.eligibleForSignOff === 0
          ? "pending"
          : snap.signedOff === snap.eligibleForSignOff
            ? "complete"
            : "in-progress",
    },
    {
      label: "Ready for FHIR save",
      status: "blocked",
      reason: "FHIR save workflow is not yet enabled.",
    },
  ];

  const safetyFlags: Array<{ label: string; detail: string }> = [];
  if (snap.hasNegatedExcluded)
    safetyFlags.push({
      label: "Negated concept excluded",
      detail: "Negated findings are excluded from coding unless a clinician overrides the context.",
    });
  if (snap.hasFamilyHistoryExcluded)
    safetyFlags.push({
      label: "Family history excluded",
      detail: "Family history is excluded from the patient's coded problem list by default.",
    });
  if (snap.hasOverlapWarnings)
    safetyFlags.push({
      label: "Generic/specific overlap detected",
      detail: "Two candidates appear to refer to the same finding at different specificity levels.",
    });
  if (snap.hasLowConfidence)
    safetyFlags.push({
      label: "Low confidence candidate",
      detail: "At least one included candidate has low NLP confidence and needs clinician review.",
    });
  safetyFlags.push({
    label: "SNOMED coding pending",
    detail: "SNOMED coding cannot run until terminology authentication is configured.",
  });
  safetyFlags.push({
    label: "SNOMED validation pending",
    detail: "Validation will run via CodeSystem/$validate-code once credentials are available.",
  });
  safetyFlags.push({
    label: "FHIR save disabled",
    detail: "Create FHIR Conditions remains disabled until coding, validation, and sign-off complete.",
  });

  const recommendedNextAction = useMemo(() => {
    if (snap.totalCandidates === 0)
      return "Enter or paste a clinical note and extract candidate conditions.";
    if (snap.needsReviewCount > 0)
      return "Review extracted candidates and exclude irrelevant findings.";
    if (snap.approvedForCoding === 0)
      return "Approve clinically relevant Condition previews for SNOMED coding.";
    if (snap.inCodingQueue === 0 && snap.approvedForCoding > 0)
      return "Send approved items to SNOMED coding queue.";
    // Terminology credentials are not configured in this phase.
    if (snap.inCodingQueue > 0)
      return "Configure NHS OntoServer system-to-system credentials before live SNOMED coding and validation.";
    if (snap.eligibleForSignOff > 0 && snap.signedOff < snap.eligibleForSignOff)
      return "Complete final clinical sign-off.";
    if (readyForFhirSave)
      return "Save approved Conditions to FHIR when save workflow is enabled.";
    return "Complete SNOMED coding and terminology validation once credentials are available.";
  }, [snap, readyForFhirSave]);

  async function copySummaryJson() {
    const payload = {
      patientId: patient.id ?? null,
      patientName: formatPatientName(patient),
      generatedAt: new Date().toISOString(),
      workflowStatus,
      statusCards: cards.map((c) => ({
        key: c.key,
        title: c.title,
        status: c.status,
        message: c.message ?? null,
        bullets: c.bullets ?? [],
      })),
      timeline: timeline.map((t) => ({ step: t.label, status: t.status, reason: t.reason ?? null })),
      counts: {
        totalCandidates: snap.totalCandidates,
        present: snap.contextCounts.Present,
        negated: snap.contextCounts.Negated,
        historical: snap.contextCounts.Historical,
        familyHistory: snap.contextCounts["Family history"],
        uncertain: snap.contextCounts.Uncertain,
        included: snap.included,
        excluded: snap.excluded,
        approvedForCoding: snap.approvedForCoding,
        inCodingQueue: snap.inCodingQueue,
        clinicallySignedOff: snap.signedOff,
        readyForFhirSave: 0,
      },
      safetyFlags,
      recommendedNextAction,
      readyForFhirSave,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Workflow Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPatientName(patient)} ·{" "}
              <span className="font-mono text-xs">{patient.id ?? "—"}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Last updated this session:{" "}
              {live ? new Date(snap.updatedAt).toLocaleString() : "—"}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <WorkflowStatusBadge status={workflowStatus} />
            <Button size="sm" variant="outline" onClick={copySummaryJson}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <FileJson className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy workflow summary JSON"}
            </Button>
          </div>
        </div>
      </section>

      {/* Demo note */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This workflow summary is session-based. It is intended for review and demonstration until
        persistent workflow storage is implemented.
      </div>

      {/* Status cards */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Status cards</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <StatusCard key={c.key} {...c} />
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Workflow timeline</h3>
        <ol className="space-y-2">
          {timeline.map((t, i) => (
            <li key={t.label} className="flex items-start gap-3">
              <TimelineDot status={t.status} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {i + 1}. {t.label}
                  </span>
                  <TimelinePill status={t.status} />
                </div>
                {t.reason && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.reason}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Counts */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Counts</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Count label="Total extracted" value={snap.totalCandidates} />
          <Count label="Present" value={snap.contextCounts.Present} />
          <Count label="Negated" value={snap.contextCounts.Negated} />
          <Count label="Historical" value={snap.contextCounts.Historical} />
          <Count label="Family history" value={snap.contextCounts["Family history"]} />
          <Count label="Uncertain" value={snap.contextCounts.Uncertain} />
          <Count label="Included" value={snap.included} />
          <Count label="Excluded" value={snap.excluded} />
          <Count label="Approved for coding" value={snap.approvedForCoding} />
          <Count label="In SNOMED coding queue" value={snap.inCodingQueue} />
          <Count label="Clinically signed off" value={snap.signedOff} />
          <Count label="Ready for FHIR save" value={0} />
        </div>
      </section>

      {/* Safety flags */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Safety flags
        </h3>
        <ul className="space-y-2">
          {safetyFlags.map((f) => (
            <li
              key={f.label}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-900/10"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div>
                <div className="font-medium text-foreground">{f.label}</div>
                <div className="text-muted-foreground">{f.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Recommended next action */}
      <section className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold text-foreground">Recommended next action</h3>
        <p className="mt-1 text-sm text-foreground">{recommendedNextAction}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Link
            to="/terminology-configuration"
            className="text-primary underline hover:no-underline"
          >
            Terminology Configuration
          </Link>
          <Link to="/terminology" className="text-primary underline hover:no-underline">
            Terminology Search
          </Link>
        </div>
      </section>
    </div>
  );
}

function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const map: Record<WorkflowStatus, string> = {
    "Not started": "bg-muted text-muted-foreground",
    "Ready for review": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    "Terminology pending": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Awaiting SNOMED coding": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Awaiting validation": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Awaiting final sign-off": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Ready for FHIR save": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function StatusCard({
  title,
  status,
  message,
  bullets,
}: {
  title: string;
  status: CardStatus;
  message?: string;
  bullets?: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <StatusPill status={status} />
      </div>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      {bullets && bullets.length > 0 && (
        <dl className="mt-3 space-y-1 text-xs">
          {bullets.map((b) => (
            <div key={b.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{b.label}</dt>
              <dd className="font-medium text-foreground">{b.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: CardStatus }) {
  const map: Record<CardStatus, { label: string; cls: string }> = {
    complete: { label: "Complete", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
    "in-progress": { label: "In progress", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    blocked: { label: "Blocked", cls: "bg-destructive/10 text-destructive" },
    "not-started": { label: "Not started", cls: "bg-muted text-muted-foreground" },
    connected: { label: "Connected", cls: "bg-emerald-100 text-emerald-800" },
    error: { label: "Error", cls: "bg-destructive/10 text-destructive" },
    "not-configured": { label: "Not configured", cls: "bg-muted text-muted-foreground" },
    yes: { label: "Yes", cls: "bg-emerald-100 text-emerald-800" },
    no: { label: "No", cls: "bg-muted text-muted-foreground" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function TimelineDot({ status }: { status: TimelineStatus }) {
  if (status === "complete")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "in-progress")
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-600" />;
  if (status === "blocked")
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
}

function TimelinePill({ status }: { status: TimelineStatus }) {
  const map: Record<TimelineStatus, { label: string; cls: string; Icon: typeof Clock }> = {
    complete: { label: "Complete", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
    "in-progress": { label: "In progress", cls: "bg-sky-100 text-sky-800", Icon: Loader2 },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground", Icon: Clock },
    blocked: { label: "Blocked", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}
