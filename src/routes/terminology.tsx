import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ChevronLeft, AlertTriangle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { LoadingState, ErrorState, EmptyState } from "@/components/clinical/StateViews";

export const Route = createFileRoute("/terminology")({
  component: TerminologyPage,
});

interface SnomedConcept {
  system?: string;
  code?: string;
  display?: string;
  version?: string;
}

type Status = "unknown" | "connected" | "auth-required" | "forbidden" | "not-configured" | "error";

interface SearchError {
  status: number;
  message: string;
  body: string;
  requestPath: string;
}

function TerminologyPage() {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SnomedConcept[] | null>(null);
  const [error, setError] = useState<SearchError | null>(null);
  const [status, setStatus] = useState<Status>("unknown");
  const [lastPath, setLastPath] = useState<string>("");
  const [showDetails, setShowDetails] = useState(false);

  const doSearch = async () => {
    const q = term.trim();
    if (!q) return;
    const requestPath = `/api/terminology/ValueSet/$expand?url=${encodeURIComponent(
      "http://snomed.info/sct?fhir_vs",
    )}&filter=${encodeURIComponent(q)}&count=20`;
    setLastPath(requestPath);
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(requestPath, { headers: { Accept: "application/fhir+json" } });
      const text = await res.text();
      let body: Record<string, unknown> = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }

      if (!res.ok) {
        let message: string;
        if (res.status === 401) {
          message =
            "Terminology service requires authentication. SNOMED search is unavailable until an OntoServer/NHS bearer token is configured.";
          setStatus("auth-required");
        } else if (res.status === 403) {
          message =
            "Terminology access forbidden. Check SNOMED licensing or terminology server permissions.";
          setStatus("forbidden");
        } else if (res.status === 503 && typeof body.error === "string" && body.error.includes("ONTOSERVER_BASE_URL")) {
          message = "Terminology server not configured.";
          setStatus("not-configured");
        } else {
          message = "Terminology search failed. Please check the terminology server configuration.";
          setStatus("error");
        }
        setError({ status: res.status, message, body: text || JSON.stringify(body, null, 2), requestPath });
        return;
      }

      const expansion = (body as { expansion?: { contains?: SnomedConcept[] } }).expansion;
      const contains = expansion?.contains ?? [];
      setResults(contains);
      setStatus("connected");
    } catch (e) {
      setStatus("error");
      setError({
        status: 0,
        message: "Terminology search failed. Please check the terminology server configuration.",
        body: e instanceof Error ? e.message : String(e),
        requestPath,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Patient Management" className="h-7 w-7" />
            <h1 className="text-lg font-semibold text-foreground">Patient Management</h1>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" /> Back to patients
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">SNOMED Concept Search</h2>
              <p className="text-xs text-muted-foreground">
                Search SNOMED CT via the NHS OntoServer terminology proxy.
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="flex gap-2">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
              placeholder="Search conditions, diagnoses, findings..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={doSearch}
              disabled={loading || !term.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="mt-4">
            {loading ? (
              <LoadingState label="Searching SNOMED..." />
            ) : error ? (
              <div className="space-y-3">
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error.message}
                </div>
                <button
                  onClick={() => setShowDetails((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {showDetails ? "Hide" : "Show"} technical details
                </button>
                {showDetails && (
                  <dl className="grid grid-cols-[140px_1fr] gap-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                    <dt className="text-muted-foreground">HTTP status</dt>
                    <dd className="font-mono">{error.status || "—"}</dd>
                    <dt className="text-muted-foreground">Request path</dt>
                    <dd className="font-mono break-all">{error.requestPath}</dd>
                    <dt className="text-muted-foreground">Raw body</dt>
                    <dd>
                      <pre className="mt-1 max-h-60 overflow-auto rounded bg-background p-2 text-[11px]">
                        {error.body}
                      </pre>
                    </dd>
                  </dl>
                )}
              </div>
            ) : results === null ? (
              <EmptyState
                title="Search SNOMED CT"
                hint="Enter a term above to search for clinical concepts."
              />
            ) : results.length === 0 ? (
              <EmptyState title="No concepts found" hint={`No SNOMED concepts matched "${term}".`} />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Display</th>
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">System</th>
                      <th className="px-3 py-2 font-medium">Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((c, i) => (
                      <tr key={`${c.code}-${i}`} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 text-foreground">{c.display ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.code ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.system ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.version ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {lastPath && (
            <p className="mt-3 text-[11px] text-muted-foreground font-mono break-all">
              Last request: {lastPath}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground", Icon: HelpCircle },
    connected: { label: "Connected", cls: "bg-green-100 text-green-800", Icon: CheckCircle2 },
    "auth-required": { label: "Authentication required", cls: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
    forbidden: { label: "Forbidden", cls: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
    "not-configured": { label: "Not configured", cls: "bg-muted text-muted-foreground", Icon: HelpCircle },
    error: { label: "Error", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
