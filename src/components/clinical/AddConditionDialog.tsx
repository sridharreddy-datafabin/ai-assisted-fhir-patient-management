import { useState, useMemo, useEffect, Fragment } from "react";
import { X, Loader2, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { formatPatientName, calculateAge, type FhirPatient } from "@/lib/fhir";

const SNOMED_SYSTEM = "http://snomed.info/sct";
const CLINICAL_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-clinical";
const VER_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-ver-status";

interface SnomedConcept {
  system: string;
  code: string;
  display: string;
  version?: string;
}

type SearchStatus = "idle" | "loading" | "ok" | "auth-required" | "forbidden" | "error";

interface SearchState {
  status: SearchStatus;
  results: SnomedConcept[];
  message?: string;
  requestPath?: string;
  httpStatus?: number;
  rawBody?: string;
}

const CLINICAL_OPTIONS = [
  { code: "active", display: "Active" },
  { code: "recurrence", display: "Recurrence" },
  { code: "relapse", display: "Relapse" },
  { code: "inactive", display: "Inactive" },
  { code: "remission", display: "Remission" },
  { code: "resolved", display: "Resolved" },
];

const VERIFICATION_OPTIONS = [
  { code: "unconfirmed", display: "Unconfirmed" },
  { code: "provisional", display: "Provisional" },
  { code: "differential", display: "Differential" },
  { code: "confirmed", display: "Confirmed" },
  { code: "refuted", display: "Refuted" },
  { code: "entered-in-error", display: "Entered in Error" },
];

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function AddConditionDialog({
  patient,
  onClose,
}: {
  patient: FhirPatient;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle", results: [] });
  const [selected, setSelected] = useState<SnomedConcept | null>(null);
  const [showTech, setShowTech] = useState(false);

  const [clinicalStatus, setClinicalStatus] = useState("active");
  const [verificationStatus, setVerificationStatus] = useState("confirmed");
  const [onsetDate, setOnsetDate] = useState("");
  const [recordedDate, setRecordedDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    const params = new URLSearchParams({
      url: "http://snomed.info/sct?fhir_vs",
      filter: q,
      count: "20",
    });
    const requestPath = `/api/terminology/ValueSet/$expand?${params.toString()}`;
    setSearch({ status: "loading", results: [], requestPath });
    try {
      const res = await fetch(requestPath, { headers: { Accept: "application/fhir+json" } });
      const text = await res.text();
      const base = { requestPath, httpStatus: res.status, rawBody: text };
      if (res.status === 401) {
        setSearch({
          ...base,
          status: "auth-required",
          results: [],
          message:
            "Terminology service requires authentication. Configure an OntoServer/NHS bearer token before live SNOMED search can return results.",
        });
        return;
      }
      if (res.status === 403) {
        setSearch({
          ...base,
          status: "forbidden",
          results: [],
          message: "Terminology access forbidden. Check SNOMED licensing or terminology permissions.",
        });
        return;
      }
      if (!res.ok) {
        setSearch({
          ...base,
          status: "error",
          results: [],
          message: "SNOMED concept search failed. Check terminology server configuration.",
        });
        return;
      }
      let body: { expansion?: { contains?: SnomedConcept[] } } = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        // ignore
      }
      const results = (body.expansion?.contains ?? []).map((c) => ({
        system: c.system ?? SNOMED_SYSTEM,
        code: c.code,
        display: c.display,
        version: c.version,
      }));
      setSearch({ ...base, status: "ok", results });
    } catch (e) {
      setSearch({
        status: "error",
        results: [],
        requestPath,
        httpStatus: 0,
        message: e instanceof Error ? e.message : "SNOMED concept search failed.",
      });
    }
  };

  const fhirPreview = useMemo(() => {
    if (!selected) return null;
    const clinDisp = CLINICAL_OPTIONS.find((c) => c.code === clinicalStatus)?.display ?? clinicalStatus;
    const verDisp = VERIFICATION_OPTIONS.find((v) => v.code === verificationStatus)?.display ?? verificationStatus;
    const resource: Record<string, unknown> = {
      resourceType: "Condition",
      clinicalStatus: {
        coding: [{ system: CLINICAL_SYSTEM, code: clinicalStatus, display: clinDisp }],
      },
      verificationStatus: {
        coding: [{ system: VER_SYSTEM, code: verificationStatus, display: verDisp }],
      },
      code: {
        coding: [{ system: SNOMED_SYSTEM, code: selected.code, display: selected.display }],
        text: selected.display,
      },
      subject: {
        reference: `Patient/${patient.id ?? ""}`,
        display: formatPatientName(patient),
      },
    };
    if (onsetDate) resource.onsetDateTime = onsetDate;
    if (recordedDate) resource.recordedDate = recordedDate;
    if (notes.trim()) resource.note = [{ text: notes.trim() }];
    return resource;
  }, [selected, clinicalStatus, verificationStatus, onsetDate, recordedDate, notes, patient]);

  const previewJson = fhirPreview ? JSON.stringify(fhirPreview, null, 2) : "";

  const copy = async () => {
    if (!previewJson) return;
    try {
      await navigator.clipboard.writeText(previewJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const age = calculateAge(patient.birthDate);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-4xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add Coded Condition</h2>
            <p className="text-xs text-muted-foreground">
              Preview-only workflow. No data will be saved to the FHIR server.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            This workflow is preview-only. No Condition resource will be saved to the FHIR server in Phase 2 #5.
          </div>

          {/* 1. Patient context */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Patient context</h3>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">Name</div>
                <div className="font-medium text-foreground">{formatPatientName(patient)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Patient ID</div>
                <div className="break-all font-mono text-foreground">{patient.id ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Gender</div>
                <div className="capitalize text-foreground">{patient.gender ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Date of birth</div>
                <div className="text-foreground">
                  {patient.birthDate ?? "—"}
                  {age != null && <span className="text-muted-foreground"> ({age}y)</span>}
                </div>
              </div>
            </div>
          </section>

          {/* 2. SNOMED concept search */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">SNOMED concept search</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search conditions, diagnoses, findings..."
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={doSearch}
                disabled={search.status === "loading" || !query.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {search.status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Search
              </button>
            </div>

            {search.message && (
              <div
                className={`mt-2 rounded-md border px-3 py-2 text-xs ${
                  search.status === "auth-required"
                    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
                    : search.status === "forbidden"
                      ? "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-100"
                      : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-100"
                }`}
              >
                {search.message}
              </div>
            )}

            {search.status === "ok" && search.results.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">No concepts found.</p>
            )}

            {search.results.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-bold">Display</th>
                      <th className="px-3 py-2 font-bold">Code</th>
                      <th className="px-3 py-2 font-bold">System</th>
                      <th className="px-3 py-2 font-bold">Version</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {search.results.map((c) => {
                      const isSel = selected?.code === c.code && selected?.system === c.system;
                      return (
                        <tr
                          key={`${c.system}|${c.code}`}
                          onClick={() => setSelected(c)}
                          className={`cursor-pointer ${
                            isSel ? "bg-primary/10" : "hover:bg-muted/40"
                          }`}
                        >
                          <td className="px-3 py-2 font-medium text-foreground">{c.display}</td>
                          <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                            {c.system === SNOMED_SYSTEM ? "SNOMED CT" : c.system}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{c.version ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {(search.requestPath || search.rawBody) && (
              <div className="mt-3">
                <button
                  onClick={() => setShowTech((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showTech ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Technical details
                </button>
                {showTech && (
                  <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-1 text-xs text-muted-foreground">
                    <dt>Request path</dt>
                    <dd className="break-all font-mono text-foreground">{search.requestPath}</dd>
                    <dt>HTTP status</dt>
                    <dd className="font-mono text-foreground">{search.httpStatus ?? "—"}</dd>
                    {search.rawBody && (
                      <Fragment>
                        <dt>Raw response</dt>
                        <dd>
                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] text-foreground">
                            {search.rawBody}
                          </pre>
                        </dd>
                      </Fragment>
                    )}
                  </dl>
                )}
              </div>
            )}

            {selected && (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Selected: </span>
                <span className="font-medium text-foreground">{selected.display}</span>
                <span className="ml-2 font-mono text-muted-foreground">({selected.code})</span>
              </div>
            )}
          </section>

          {/* 3. Condition details form */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Condition details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="text-muted-foreground">Clinical status</span>
                <select
                  value={clinicalStatus}
                  onChange={(e) => setClinicalStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {CLINICAL_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Verification status</span>
                <select
                  value={verificationStatus}
                  onChange={(e) => setVerificationStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {VERIFICATION_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Onset date (optional)</span>
                <input
                  type="date"
                  value={onsetDate}
                  onChange={(e) => setOnsetDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Recorded date</span>
                <input
                  type="date"
                  value={recordedDate}
                  onChange={(e) => setRecordedDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="text-muted-foreground">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          </section>

          {/* 4. FHIR Preview */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">FHIR Condition JSON preview</h3>
            {selected ? (
              <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted p-3 text-[11px] text-foreground">
                {previewJson}
              </pre>
            ) : (
              <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                Select a SNOMED concept above to preview the FHIR Condition resource.
              </p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
          <span className="mr-auto text-[11px] italic text-muted-foreground">
            Saving to FHIR is disabled in this phase. This workflow currently previews the Condition resource only.
          </span>
          <button
            onClick={copy}
            disabled={!previewJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Close
          </button>
          <button
            disabled
            title="Saving to FHIR is disabled in this phase. This workflow currently previews the Condition resource only."
            className="cursor-not-allowed rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
