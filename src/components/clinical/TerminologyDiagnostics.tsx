import { useState } from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";

interface TestResult {
  status: number;
  ok: boolean;
  resourceType?: string;
  softwareName?: string;
  fhirVersion?: string;
  error?: string;
}

export function TerminologyDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/terminology/metadata", {
        headers: { Accept: "application/fhir+json" },
      });
      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      setResult({
        status: res.status,
        ok: res.ok,
        resourceType: body.resourceType as string | undefined,
        softwareName: (body.software as { name?: string } | undefined)?.name,
        fhirVersion: body.fhirVersion as string | undefined,
        error: !res.ok ? (body.error as string) ?? `HTTP ${res.status}` : undefined,
      });
    } catch (e) {
      setResult({
        status: 0,
        ok: false,
        error: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Developer diagnostics</h2>
          <p className="text-xs text-muted-foreground">
            Verify the OntoServer terminology proxy.
          </p>
        </div>
        <button
          onClick={runTest}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Activity className="h-3.5 w-3.5" />
          {loading ? "Testing..." : "Test OntoServer Proxy"}
        </button>
      </div>

      {result && (
        <div className="rounded-md border border-border bg-card p-3 text-xs">
          <div className="mb-2 flex items-center gap-2 font-medium">
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-foreground">
              Status: {result.status || "—"} {result.ok ? "OK" : "Failed"}
            </span>
          </div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-muted-foreground">
            <dt>resourceType</dt>
            <dd className="font-mono text-foreground">{result.resourceType ?? "—"}</dd>
            <dt>Software name</dt>
            <dd className="text-foreground">{result.softwareName ?? "—"}</dd>
            <dt>FHIR version</dt>
            <dd className="font-mono text-foreground">{result.fhirVersion ?? "—"}</dd>
            {result.error && (
              <>
                <dt>Error</dt>
                <dd className="text-destructive">{result.error}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}
