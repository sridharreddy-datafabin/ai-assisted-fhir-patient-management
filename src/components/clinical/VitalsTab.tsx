import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart3, Table as TableIcon } from "lucide-react";
import {
  getVitals,
  VITAL_CODES,
  observationCode,
  observationDate,
  type FhirObservation,
} from "@/lib/fhir";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";

interface VitalRow {
  date: string;
  label: string;
  value: string;
  unit: string;
  code: string;
}

interface ChartPoint {
  date: string;
  ts: number;
  [series: string]: number | string;
}

const VITAL_META: Record<string, { label: string; unit?: string }> = {
  [VITAL_CODES.heartRate]: { label: "Heart rate", unit: "bpm" },
  [VITAL_CODES.temperature]: { label: "Temperature", unit: "°C" },
  [VITAL_CODES.temperatureOral]: { label: "Temperature", unit: "°C" },
  [VITAL_CODES.temperatureBody]: { label: "Temperature", unit: "°C" },
  [VITAL_CODES.respiratoryRate]: { label: "Respiratory rate", unit: "/min" },
  [VITAL_CODES.oxygenSaturation]: { label: "Oxygen saturation", unit: "%" },
  [VITAL_CODES.oxygenSaturationAlt]: { label: "Oxygen saturation", unit: "%" },
  [VITAL_CODES.height]: { label: "Height", unit: "cm" },
  [VITAL_CODES.weight]: { label: "Weight", unit: "kg" },
  [VITAL_CODES.bmi]: { label: "BMI", unit: "kg/m²" },
  [VITAL_CODES.bloodPressure]: { label: "Blood pressure", unit: "mmHg" },
  [VITAL_CODES.bloodPressurePanel]: { label: "Blood pressure", unit: "mmHg" },
};

const BP_CODES = new Set<string>([VITAL_CODES.bloodPressure, VITAL_CODES.bloodPressurePanel]);
const TEMP_CODES = new Set<string>([
  VITAL_CODES.temperature,
  VITAL_CODES.temperatureOral,
  VITAL_CODES.temperatureBody,
]);
const SPO2_CODES = new Set<string>([
  VITAL_CODES.oxygenSaturation,
  VITAL_CODES.oxygenSaturationAlt,
]);

const SERIES_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
  "#0ea5e9",
];

function extractRows(obs: FhirObservation[]): VitalRow[] {
  const rows: VitalRow[] = [];
  for (const o of obs) {
    const code = observationCode(o) ?? "";
    const date = observationDate(o) ?? "";
    const meta = VITAL_META[code];
    if (!meta) continue;

    if (BP_CODES.has(code) && o.component?.length) {
      const sys = o.component.find((c) => c.code?.coding?.some((cc) => cc.code === "8480-6"));
      const dia = o.component.find((c) => c.code?.coding?.some((cc) => cc.code === "8462-4"));
      const sysV = sys?.valueQuantity?.value;
      const diaV = dia?.valueQuantity?.value;
      if (sysV != null) {
        rows.push({
          date,
          label: "Systolic BP",
          value: String(sysV),
          unit: sys?.valueQuantity?.unit ?? "mmHg",
          code: "8480-6",
        });
      }
      if (diaV != null) {
        rows.push({
          date,
          label: "Diastolic BP",
          value: String(diaV),
          unit: dia?.valueQuantity?.unit ?? "mmHg",
          code: "8462-4",
        });
      }
    } else if (o.valueQuantity?.value != null) {
      rows.push({
        date,
        label: meta.label,
        value: String(o.valueQuantity.value),
        unit: o.valueQuantity.unit ?? meta.unit ?? "",
        code,
      });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows;
}

function buildChartData(rows: VitalRow[]): { data: ChartPoint[]; series: string[] } {
  const byTs = new Map<number, ChartPoint>();
  const seriesSet = new Set<string>();
  for (const r of rows) {
    if (!r.date) continue;
    const ts = new Date(r.date).getTime();
    if (Number.isNaN(ts)) continue;
    seriesSet.add(r.label);
    let point = byTs.get(ts);
    if (!point) {
      point = { date: r.date.slice(0, 10), ts };
      byTs.set(ts, point);
    }
    const num = Number(r.value);
    if (!Number.isNaN(num)) point[r.label] = num;
  }
  return {
    data: Array.from(byTs.values()).sort((a, b) => a.ts - b.ts),
    series: Array.from(seriesSet),
  };
}

function VitalCard({
  label,
  rows,
  colors,
}: {
  label: string;
  rows: VitalRow[];
  colors: string[];
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { data: chartData, series } = useMemo(() => buildChartData(rows), [rows]);
  const unit = rows[0]?.unit ?? "";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{label}</h4>
          {unit && <p className="text-xs text-muted-foreground">{unit}</p>}
        </div>
        <div className="inline-flex rounded-md border border-border bg-background p-0.5">
          <button
            onClick={() => setView("chart")}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              view === "chart"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            Chart
          </button>
          <button
            onClick={() => setView("table")}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              view === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TableIcon className="h-3 w-3" />
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {series.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 text-left uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">Date</th>
                <th className="px-3 py-2 font-bold">Metric</th>
                <th className="px-3 py-2 font-bold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-3 py-1.5 text-muted-foreground">{r.date.slice(0, 10)}</td>
                  <td className="px-3 py-1.5 text-foreground">{r.label}</td>
                  <td className="px-3 py-1.5 text-foreground">
                    {r.value} <span className="text-muted-foreground">{r.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VitalsTab({ patientId }: { patientId: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vitals", patientId],
    queryFn: () => getVitals(patientId),
  });

  const rows = useMemo(() => (data ? extractRows(data) : []), [data]);
  const { data: chartData, series } = useMemo(() => buildChartData(rows), [rows]);

  // Group rows by vital code/label for per-vital charts.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: VitalRow[] }>();
    for (const r of rows) {
      // Combine systolic + diastolic into a single "Blood pressure" card,
      // and normalize alternate temperature / SpO2 LOINC codes into one group.
      let key = r.code;
      let groupLabel = r.label;
      if (r.code === "8480-6" || r.code === "8462-4" || BP_CODES.has(r.code)) {
        key = "blood-pressure";
        groupLabel = "Blood pressure";
      } else if (TEMP_CODES.has(r.code)) {
        key = "temperature";
        groupLabel = "Temperature";
      } else if (SPO2_CODES.has(r.code)) {
        key = "oxygen-saturation";
        groupLabel = "Oxygen saturation";
      }
      const g = map.get(key) ?? { label: groupLabel, rows: [] };
      g.rows.push(r);
      map.set(key, g);
    }
    return Array.from(map.values()).filter((g) => g.rows.length > 0);
  }, [rows]);

  if (isLoading) return <LoadingState label="Loading vitals..." />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load vitals"}
        onRetry={() => refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vital signs — combined</h3>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setView("chart")}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "chart"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Chart
          </button>
          <button
            onClick={() => setView("table")}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No vitals" hint="No vital sign observations available." />
      ) : view === "chart" ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.map((s, i) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Vital</th>
                <th className="px-4 py-3 font-bold">Value</th>
                <th className="px-4 py-3 font-bold">LOINC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-4 py-3 text-muted-foreground">{r.date.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.label}</td>
                  <td className="px-4 py-3 text-foreground">
                    {r.value} <span className="text-muted-foreground">{r.unit}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold text-foreground">Individual vitals</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g, i) => (
              <VitalCard
                key={g.label}
                label={g.label}
                rows={g.rows}
                colors={[
                  SERIES_COLORS[i % SERIES_COLORS.length],
                  SERIES_COLORS[(i + 3) % SERIES_COLORS.length],
                ]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
