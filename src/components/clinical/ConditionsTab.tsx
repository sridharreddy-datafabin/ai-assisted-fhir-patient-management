import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { getConditions, codeDisplay, type FhirCondition } from "@/lib/fhir";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";

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
}

interface FhirParameter {
  name: string;
  valueBoolean?: boolean;
  valueString?: string;
}

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

function StatusBadge({ status }: { status: ValidationStatus }) {
  const map: Record<ValidationStatus, { label: string; cls: string }> = {
    "not-validated": { label: "Not validated", cls: "bg-muted text-muted-foreground" },
    validating: { label: "Validating…", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
    valid: { label: "Valid", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    invalid: { label: "Invalid", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    "auth-required": { label: "Auth required", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    forbidden: { label: "Forbidden", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    "missing-code": { label: "Missing code", cls: "bg-muted text-muted-foreground" },
    "not-snomed": { label: "Not SNOMED", cls: "bg-muted text-muted-foreground" },
    error: { label: "Error", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
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

    const base = { requestPath, httpStatus: res.status, rawBody: text };

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

    const params = body.parameter ?? [];
    const result = params.find((p) => p.name === "result")?.valueBoolean;
    const message = params.find((p) => p.name === "message")?.valueString;
    const display = params.find((p) => p.name === "display")?.valueString;

    if (result === true) return { ...base, status: "valid", message, display };
    if (result === false) return { ...base, status: "invalid", message, display };
    return { ...base, status: "error", message: "Unexpected response from terminology server" };
  } catch (e) {
    return {
      status: "error",
      requestPath,
      httpStatus: 0,
      message: e instanceof Error ? e.message : "Request failed",
    };
  }
}

export function ConditionsTab({ patientId }: { patientId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["conditions", patientId],
    queryFn: () => getConditions(patientId),
  });

  const [results, setResults] = useState<Record<string, ValidationResult>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulkRunning, setBulkRunning] = useState(false);

  const conditions = data ?? [];

  const getResult = (c: FhirCondition): ValidationResult => {
    const id = c.id ?? "";
    return results[id] ?? initialStatus(c);
  };

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
    const targets = conditions.filter((c) => c.id && getSnomedCode(c));
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
      notSnomed: 0,
      missingCode: 0,
      error: 0,
    };
    for (const c of conditions) {
      const r = getResult(c);
      if (r.status === "valid") {
        s.valid++;
        s.validated++;
      } else if (r.status === "invalid") {
        s.invalid++;
        s.validated++;
      } else if (r.status === "auth-required") {
        s.authRequired++;
        s.validated++;
      } else if (r.status === "forbidden" || r.status === "error") {
        s.error++;
        s.validated++;
      } else if (r.status === "not-snomed") s.notSnomed++;
      else if (r.status === "missing-code") s.missingCode++;
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, results]);

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

  const validatableCount = conditions.filter((c) => getSnomedCode(c)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span><b className="text-foreground">{summary.total}</b> total</span>
            <span><b className="text-foreground">{summary.validated}</b> validated</span>
            <span className="text-green-700 dark:text-green-300"><b>{summary.valid}</b> valid</span>
            <span className="text-red-700 dark:text-red-300"><b>{summary.invalid}</b> invalid</span>
            <span className="text-amber-700 dark:text-amber-300"><b>{summary.authRequired}</b> auth required</span>
            <span><b className="text-foreground">{summary.notSnomed}</b> not SNOMED</span>
            <span><b className="text-foreground">{summary.missingCode}</b> missing code</span>
            <span className="text-red-700 dark:text-red-300"><b>{summary.error}</b> error</span>
          </div>
          <button
            onClick={runAll}
            disabled={bulkRunning || validatableCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {bulkRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Validate all visible conditions
          </button>
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
              <th className="px-4 py-3 font-bold">Verification</th>
              <th className="px-4 py-3 font-bold">Onset</th>
              <th className="px-4 py-3 font-bold">Validation</th>
              <th className="px-4 py-3 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {conditions.map((c) => {
              const id = c.id ?? Math.random().toString();
              const r = getResult(c);
              const { code, system } = getCodingInfo(c);
              const canValidate = !!getSnomedCode(c) && r.status !== "validating";
              const isOpen = expanded[id];
              const hasDetails = r.requestPath || r.message || r.display || r.rawBody;
              return (
                <Fragment key={id}>
                  <tr key={id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{codeDisplay(c.code)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{code ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {system ? (system === SNOMED_SYSTEM ? "SNOMED CT" : system) : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{codeDisplay(c.clinicalStatus)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{codeDisplay(c.verificationStatus)}</td>
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
                    <tr key={`${id}-details`} className="bg-muted/30">
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
    </div>
  );
}
