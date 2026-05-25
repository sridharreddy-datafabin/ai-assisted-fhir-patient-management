import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, ShieldCheck, ShieldAlert, ShieldX, Shield, HelpCircle, Plus } from "lucide-react";
import { getConditions, codeDisplay, type FhirCondition, type FhirPatient } from "@/lib/fhir";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";
import { AddConditionDialog } from "./AddConditionDialog";

const SNOMED_SYSTEM = "http://snomed.info/sct";

type ValidationStatus =
  | "not-validated"
  | "validating"
  | "valid"
  | "invalid"
  | "auth-required"
  | "forbidden"
  | "missing-code"
  | "not-snomed"
  | "error";

interface ValidationResult {
  status: ValidationStatus;
  message?: string;
  display?: string;
  requestPath?: string;
  httpStatus?: number;
  rawBody?: string;
  validatedAt?: number;
}

interface FhirParameter {
  name: string;
  valueBoolean?: boolean;
  valueString?: string;
}

type FilterValue =
  | "all"
  | "not-validated"
  | "valid"
  | "invalid"
  | "auth-required"
  | "forbidden"
  | "missing-code"
  | "not-snomed"
  | "error";

type ServiceStatus = "not-checked" | "available" | "auth-required" | "forbidden" | "error";

function getSnomedCode(c: FhirCondition): string | undefined {
  return c.code?.coding?.find((co) => co.system === SNOMED_SYSTEM)?.code;
}

function getCodingInfo(c: FhirCondition): { code?: string; system?: string } {
  const snomed = c.code?.coding?.find((co) => co.system === SNOMED_SYSTEM);
  if (snomed) return { code: snomed.code, system: snomed.system };
  const first = c.code?.coding?.[0];
  return { code: first?.code, system: first?.system };
}

function initialStatus(c: FhirCondition): ValidationResult {
  if (!c.code || (!c.code.coding?.length && !c.code.text)) {
    return { status: "missing-code" };
  }
  if (!getSnomedCode(c)) return { status: "not-snomed" };
  return { status: "not-validated" };
}

const STATUS_META: Record<ValidationStatus, { label: string; cls: string }> = {
  "not-validated": { label: "Not validated", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
  validating: { label: "Validating…", cls: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800" },
  valid: { label: "Valid", cls: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800" },
  invalid: { label: "Invalid", cls: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800" },
  "auth-required": { label: "Auth required", cls: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800" },
  forbidden: { label: "Forbidden", cls: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800" },
  "missing-code": { label: "Missing code", cls: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" },
  "not-snomed": { label: "Not SNOMED", cls: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800" },
  error: { label: "Error", cls: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800" },
};

function StatusBadge({ status }: { status: ValidationStatus }) {
  const { label, cls } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status === "validating" && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </span>
  );
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function validateCode(code: string): Promise<ValidationResult> {
  const params = new URLSearchParams({ url: SNOMED_SYSTEM, code });
  const requestPath = `/api/terminology/CodeSystem/$validate-code?${params.toString()}`;
  try {
    const res = await fetch(requestPath, { headers: { Accept: "application/fhir+json" } });
    const text = await res.text();
    let body: { parameter?: FhirParameter[]; resourceType?: string } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // keep empty
    }

    const base = { requestPath, httpStatus: res.status, rawBody: text, validatedAt: Date.now() };

    if (res.status === 401) {
      return {
        ...base,
        status: "auth-required",
        message:
          "Terminology service requires authentication. Configure OntoServer/NHS bearer token to validate SNOMED codes.",
      };
    }
    if (res.status === 403) {
      return {
        ...base,
        status: "forbidden",
        message: "Terminology access forbidden. Check SNOMED licensing or terminology permissions.",
      };
    }
    if (!res.ok) {
      return { ...base, status: "error", message: `HTTP ${res.status}` };
    }

    const responseParams = body.parameter ?? [];
    const result = responseParams.find((p) => p.name === "result")?.valueBoolean;
    const message = responseParams.find((p) => p.name === "message")?.valueString;
    const display = responseParams.find((p) => p.name === "display")?.valueString;

    if (result === true) return { ...base, status: "valid", message, display };
    if (result === false) return { ...base, status: "invalid", message, display };
    return { ...base, status: "error", message: "Unexpected response from terminology server" };
  } catch (e) {
    return {
      status: "error",
      requestPath,
      httpStatus: 0,
      validatedAt: Date.now(),
      message: e instanceof Error ? e.message : "Request failed",
    };
  }
}

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not-validated", label: "Not validated" },
  { value: "valid", label: "Valid" },
  { value: "invalid", label: "Invalid" },
  { value: "auth-required", label: "Authentication required" },
  { value: "forbidden", label: "Forbidden" },
  { value: "missing-code", label: "Missing code" },
  { value: "not-snomed", label: "Not SNOMED" },
  { value: "error", label: "Error" },
];

function ServiceBanner({ status }: { status: ServiceStatus }) {
  const map: Record<ServiceStatus, { title: string; msg: string; cls: string; Icon: typeof Shield }> = {
    "not-checked": {
      title: "Terminology service: Not checked",
      msg: "Run a validation to check the terminology service status.",
      cls: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
      Icon: HelpCircle,
    },
    available: {
      title: "Terminology service: Available",
      msg: "SNOMED validation is responding successfully.",
      cls: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100",
      Icon: ShieldCheck,
    },
    "auth-required": {
      title: "Terminology service: Authentication required",
      msg: "SNOMED validation is configured, but the NHS OntoServer requires authentication. Configure an OntoServer/NHS bearer token to complete live validation.",
      cls: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100",
      Icon: ShieldAlert,
    },
    forbidden: {
      title: "Terminology service: Forbidden",
      msg: "The terminology service rejected the request. Check SNOMED licensing or terminology permissions.",
      cls: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-100",
      Icon: ShieldX,
    },
    error: {
      title: "Terminology service: Error",
      msg: "An unexpected error occurred while contacting the terminology service.",
      cls: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-100",
      Icon: ShieldX,
    },
  };
  const { title, msg, cls, Icon } = map[status];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs opacity-90">{msg}</div>
      </div>
    </div>
  );
}

export function ConditionsTab({ patientId, patient }: { patientId: string; patient?: FhirPatient }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["conditions", patientId],
    queryFn: () => getConditions(patientId),
  });

  const [results, setResults] = useState<Record<string, ValidationResult>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [addOpen, setAddOpen] = useState(false);

  const conditions = data ?? [];

  const getResult = (c: FhirCondition): ValidationResult => {
    const id = c.id ?? "";
    return results[id] ?? initialStatus(c);
  };

  const visibleConditions = useMemo(() => {
    if (filter === "all") return conditions;
    return conditions.filter((c) => getResult(c).status === filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, results, filter]);

  const runOne = async (c: FhirCondition) => {
    const id = c.id;
    const code = getSnomedCode(c);
    if (!id || !code) return;
    setResults((r) => ({ ...r, [id]: { ...getResult(c), status: "validating" } }));
    const result = await validateCode(code);
    setResults((r) => ({ ...r, [id]: result }));
  };

  const runAll = async () => {
    setBulkRunning(true);
    const targets = visibleConditions.filter((c) => c.id && getSnomedCode(c));
    setResults((r) => {
      const next = { ...r };
      for (const c of targets) next[c.id!] = { ...getResult(c), status: "validating" };
      return next;
    });
    for (const c of targets) {
      const code = getSnomedCode(c)!;
      const result = await validateCode(code);
      setResults((r) => ({ ...r, [c.id!]: result }));
    }
    setBulkRunning(false);
  };

  const summary = useMemo(() => {
    const s = {
      total: conditions.length,
      validated: 0,
      valid: 0,
      invalid: 0,
      authRequired: 0,
      forbidden: 0,
      notSnomed: 0,
      missingCode: 0,
      error: 0,
    };
    for (const c of conditions) {
      const r = getResult(c);
      if (r.status === "valid") { s.valid++; s.validated++; }
      else if (r.status === "invalid") { s.invalid++; s.validated++; }
      else if (r.status === "auth-required") { s.authRequired++; s.validated++; }
      else if (r.status === "forbidden") { s.forbidden++; s.validated++; }
      else if (r.status === "error") { s.error++; s.validated++; }
      else if (r.status === "not-snomed") s.notSnomed++;
      else if (r.status === "missing-code") s.missingCode++;
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, results]);

  const serviceStatus: ServiceStatus = useMemo(() => {
    const statuses = Object.values(results).map((r) => r.status);
    if (statuses.length === 0) return "not-checked";
    if (statuses.includes("valid") || statuses.includes("invalid")) return "available";
    if (statuses.includes("auth-required")) return "auth-required";
    if (statuses.includes("forbidden")) return "forbidden";
    if (statuses.includes("error")) return "error";
    return "not-checked";
  }, [results]);

  if (isLoading) return <LoadingState label="Loading conditions..." />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load conditions"}
        onRetry={() => refetch()}
      />
    );
  if (conditions.length === 0)
    return <EmptyState title="No conditions" hint="This patient has no recorded conditions." />;

  const visibleValidatableCount = visibleConditions.filter((c) => getSnomedCode(c)).length;

  const quickFilters: { value: FilterValue; label: string }[] = [
    { value: "invalid", label: "Show invalid" },
    { value: "auth-required", label: "Show auth-required" },
    { value: "missing-code", label: "Show missing-code" },
    { value: "not-snomed", label: "Show not-SNOMED" },
  ];

  return (
    <div className="space-y-4">
      <ServiceBanner status={serviceStatus} />

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span><b className="text-foreground">{summary.total}</b> total</span>
            <span><b className="text-foreground">{summary.validated}</b> validated</span>
            <span className="text-green-700 dark:text-green-300"><b>{summary.valid}</b> valid</span>
            <span className="text-red-700 dark:text-red-300"><b>{summary.invalid}</b> invalid</span>
            <span className="text-amber-700 dark:text-amber-300"><b>{summary.authRequired}</b> auth required</span>
            <span className="text-orange-700 dark:text-orange-300"><b>{summary.forbidden}</b> forbidden</span>
            <span><b className="text-foreground">{summary.notSnomed}</b> not SNOMED</span>
            <span><b className="text-foreground">{summary.missingCode}</b> missing code</span>
            <span className="text-rose-700 dark:text-rose-300"><b>{summary.error}</b> error</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runAll}
              disabled={bulkRunning || visibleValidatableCount === 0}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {bulkRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Validate all visible conditions ({visibleValidatableCount})
            </button>
            {patient && (
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Add coded condition
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Validation results are session-only and are not saved to the FHIR server.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground">
            Filter:
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterValue)}
              className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {quickFilters.map((q) => (
              <button
                key={q.value}
                onClick={() => setFilter(q.value)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                  filter === q.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {q.label}
              </button>
            ))}
            <button
              onClick={() => setFilter("all")}
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Clear filter
            </button>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Showing <b className="text-foreground">{visibleConditions.length}</b> of <b className="text-foreground">{conditions.length}</b>
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">Condition</th>
              <th className="px-4 py-3 font-bold">Code</th>
              <th className="px-4 py-3 font-bold">System</th>
              <th className="px-4 py-3 font-bold">Clinical</th>
              <th className="px-4 py-3 font-bold">Onset</th>
              <th className="px-4 py-3 font-bold">Validation</th>
              <th className="px-4 py-3 font-bold">Last validated</th>
              <th className="px-4 py-3 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleConditions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No conditions match the selected filter.
                </td>
              </tr>
            )}
            {visibleConditions.map((c) => {
              const id = c.id ?? Math.random().toString();
              const r = getResult(c);
              const { code, system } = getCodingInfo(c);
              const canValidate = !!getSnomedCode(c) && r.status !== "validating";
              const isOpen = expanded[id];
              const hasDetails = r.requestPath || r.message || r.display || r.rawBody;
              return (
                <Fragment key={id}>
                  <tr className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{codeDisplay(c.code)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{code ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {system ? (system === SNOMED_SYSTEM ? "SNOMED CT" : system) : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{codeDisplay(c.clinicalStatus)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.onsetDateTime?.slice(0, 10) ?? c.recordedDate?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {hasDetails && (
                          <button
                            onClick={() => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Toggle details"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.validatedAt ? formatTimestamp(r.validatedAt) : "Not validated this session"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => runOne(c)}
                        disabled={!canValidate}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        {r.status === "validating" && <Loader2 className="h-3 w-3 animate-spin" />}
                        Validate
                      </button>
                    </td>
                  </tr>
                  {isOpen && hasDetails && (
                    <tr className="bg-muted/30">
                      <td colSpan={8} className="px-4 py-3">
                        <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-xs text-muted-foreground">
                          {r.requestPath && (
                            <>
                              <dt>Request path</dt>
                              <dd className="font-mono text-foreground break-all">{r.requestPath}</dd>
                            </>
                          )}
                          {r.httpStatus != null && (
                            <>
                              <dt>HTTP status</dt>
                              <dd className="font-mono text-foreground">{r.httpStatus || "—"}</dd>
                            </>
                          )}
                          {r.display && (
                            <>
                              <dt>Display</dt>
                              <dd className="text-foreground">{r.display}</dd>
                            </>
                          )}
                          {r.message && (
                            <>
                              <dt>Message</dt>
                              <dd className="text-foreground">{r.message}</dd>
                            </>
                          )}
                          {r.rawBody && (
                            <>
                              <dt>Raw response</dt>
                              <dd>
                                <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] text-foreground">
                                  {r.rawBody}
                                </pre>
                              </dd>
                            </>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {addOpen && patient && (
        <AddConditionDialog patient={patient} onClose={() => setAddOpen(false)} />
      )}
    </div>
  );
}
