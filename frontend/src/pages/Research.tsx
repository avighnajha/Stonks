import { useEffect, useRef, useState } from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "@/api/axiosInstance";
import { command } from "@/api/trading.api";
import { useAuth } from "@/hooks/useAuth";

type Asset = {
  id: string;
  name: string;
  sector: string;
  subsector: string;
  price: string;
  marketWeight: number;
  sectorWeight: number;
  subsectorWeight: number;
  idiosyncraticWeight: number;
  templateId?: string;
  templateVersion?: number;
};
type Group = {
  id: string;
  strategy: string;
  count: number;
  cash: string;
  inventory: string;
  wakeMs: number;
  delayMs: number;
  signalNoise: number;
  information?: "public" | "valuation" | "both" | "none";
  parameters: Record<string, unknown>;
};
type News = {
  atMs: number;
  assetId: string;
  shock: number;
  releaseDelayMs: number;
  headline: string;
  signal: number;
};
type Manifest = {
  version: 1;
  durationMs: number;
  stepMs: number;
  seed: number;
  assets: Asset[];
  groups: Group[];
  events: News[];
};
type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  manifest: Manifest;
};
type Sample = {
  tick: number;
  assets: Record<
    string,
    {
      mid: number | null;
      reference: number;
      spread: number | null;
      bid: number | null;
      ask: number | null;
      bidDepth: number;
      askDepth: number;
    }
  >;
};
type Run = {
  id: string;
  experiment_id: string;
  manifest: Manifest;
  status: string;
  created_at: string;
  error?: string;
  cancel_requested: boolean;
  progress: { tick?: number; durationMs?: number; latest?: Sample };
  result?: {
    economicHash: string;
    runnerVersion: string;
    versions?: Record<string, string>;
    samples: Sample[];
    metrics: Record<
      string,
      {
        meanSpread: number | null;
        emptyBookFraction: number | null;
        referenceRmse: number | null;
      }
    >;
    cohorts: Record<
      string,
      { initialWealth: number; finalWealth: number; pnl: number }
    >;
    report: {
      trades: Array<{
        sequence: string;
        price: string;
        quantity: string;
        timestamp: string;
      }>;
      books: Record<
        string,
        {
          buys: Array<{ price: string; quantity: string }>;
          sells: Array<{ price: string; quantity: string }>;
        }
      >;
    };
  };
};
const asset = (id = "a"): Asset => ({
  id,
  name: `Asset ${id.toUpperCase()}`,
  sector: "Sports",
  subsector: "Football",
  price: "100.00",
  marketWeight: 0.01,
  sectorWeight: 0.02,
  subsectorWeight: 0.02,
  idiosyncraticWeight: 0.01,
});
const group = (id = "agents"): Group => ({
  id,
  strategy: "idle",
  count: 2,
  cash: "1000.00",
  inventory: "10.0000",
  wakeMs: 1000,
  delayMs: 100,
  signalNoise: 0.1,
  information: "public",
  parameters: {},
});
const initial = (): Manifest => ({
  version: 1,
  durationMs: 10000,
  stepMs: 1000,
  seed: 42,
  assets: [asset()],
  groups: [group()],
  events: [],
});
const input =
  "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const button =
  "rounded border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40";
const card = "rounded-md border border-border bg-card p-5 space-y-4";
const fmt = (x: unknown) =>
  typeof x === "number"
    ? x.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : "—";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function exportJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Research() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<Manifest>(initial);
  const [title, setTitle] = useState("My first experiment");
  const [hypothesis, setHypothesis] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]),
    [runs, setRuns] = useState<Run[]>([]),
    [catalogue, setCatalogue] = useState<Array<Asset & { version: number }>>(
      [],
    ),
    [strategies, setStrategies] = useState<
      Array<{ id: string; fixture: boolean }>
    >([]);
  const [selected, setSelected] = useState<Run | null>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [seeds, setSeeds] = useState("42,43,44"),
    [chartAsset, setChartAsset] = useState("a"),
    [compare, setCompare] = useState<Run[]>([]);
  const [sweep, setSweep] = useState("none"),
    [sweepGroup, setSweepGroup] = useState(""),
    [sweepValues, setSweepValues] = useState("");
  const [designStep, setDesignStep] = useState(0);
  const [filter, setFilter] = useState("");
  const invalidParameters = useRef(new Set<number>());
  const activeOwner = useRef(user?.id);
  activeOwner.current = user?.id;
  async function refresh() {
    const owner = user?.id;
    const [e, r, c, s] = await Promise.all([
      api.get("/research/experiments"),
      api.get("/research/runs"),
      api.get("/research/catalogue"),
      api.get("/research/strategies"),
    ]);
    if (activeOwner.current !== owner) return;
    setExperiments(e.data);
    setRuns(r.data);
    setCatalogue(c.data);
    setStrategies(s.data);
  }
  useEffect(() => {
    setSelected(null);
    setCompare([]);
    if (!user) {
      setExperiments([]);
      setRuns([]);
      setSelected(null);
      setCompare([]);
      return;
    }
    let live = true;
    const load = () =>
      refresh().catch(() => {
        if (live) setError("Could not load research data. Please retry.");
      });
    void load();
    const t = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!selected || !["QUEUED", "RUNNING"].includes(selected.status)) return;
    let live = true;
    const t = setInterval(() => {
      void api
        .get(`/research/runs/${selected.id}`)
        .then((r) => {
          if (live) setSelected(r.data);
        })
        .catch(() => {
          if (live)
            setError("Run refresh failed; displayed state may be stale.");
        });
    }, 2000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [selected?.id, selected?.status]);
  async function perform(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e: any) {
      setError(
        e.response?.data?.message?.toString() || e.message || "Request failed",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (invalidParameters.current.size)
      throw new Error(
        "Correct invalid strategy JSON before saving or launching",
      );
    const body = { title, hypothesis, manifest: draft };
    const { data } = editing
      ? await api.put(`/research/experiments/${editing}`, body)
      : await api.post("/research/experiments", body);
    setEditing(data.id);
    return data as Experiment;
  }
  function patchAsset(i: number, key: keyof Asset, value: unknown) {
    setDraft((d) => ({
      ...d,
      assets: d.assets.map((a, j) => (j === i ? { ...a, [key]: value } : a)),
    }));
  }
  function patchGroup(i: number, key: keyof Group, value: unknown) {
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g, j) => (j === i ? { ...g, [key]: value } : g)),
    }));
  }
  async function launch() {
    const seedList = [
      ...new Set(seeds.split(",").map((s) => Number(s.trim()))),
    ];
    if (!seeds.trim() || seedList.some((x) => !Number.isInteger(x) || x < 0))
      throw new Error("Enter comma-separated non-negative integer seeds");
    const values =
      sweep === "none"
        ? [null]
        : sweepValues.split(",").map((x) => Number(x.trim()));
    if (
      !values.length ||
      values.some((x) => x !== null && (!Number.isFinite(x) || x < 0)) ||
      seedList.length * values.length > 10
    )
      throw new Error("Choose at most 10 runs with valid sweep values");
    const target = sweepGroup || draft.groups[0].id;
    if (sweep !== "none" && !draft.groups.some((g) => g.id === target))
      throw new Error("Select a population group");
    const base = await save();
    let count = 0;
    for (const value of values) {
      let exp = base;
      if (value !== null) {
        const manifest = {
          ...draft,
          groups: draft.groups.map((g) =>
            g.id === target ? { ...g, [sweep]: value } : g,
          ),
        };
        exp = (
          await api.post("/research/experiments", {
            title: `${title.slice(0, 70)} · ${target} ${sweep}=${value}`,
            hypothesis,
            manifest,
          })
        ).data;
      }
      for (const seed of seedList) {
        await command("post", `/research/experiments/${exp.id}/runs`, { seed });
        count++;
      }
    }
    await refresh();
    setNotice(
      `${count} runs queued. A configured Python worker processes one run at a time. Each sweep variant is saved as a separate experiment.`,
    );
    setTab("runs");
  }
  function clone(e: Experiment) {
    invalidParameters.current.clear();
    setDraft(structuredClone(e.manifest));
    setTitle(e.title);
    setHypothesis(e.hypothesis);
    setEditing(e.id);
    setTab("design");
    setDesignStep(0);
    setNotice("Draft loaded. Existing runs remain unchanged.");
  }
  async function inspect(r: Run) {
    const { data } = await api.get(`/research/runs/${r.id}`);
    setSelected(data);
    setChartAsset(data.manifest.assets[0].id);
    setTab("results");
  }
  const samples =
    selected?.result?.samples ??
    (selected?.progress.latest ? [selected.progress.latest] : []);
  const points = samples.map((s) => ({
    seconds: s.tick / 1000,
    ...s.assets[chartAsset],
  }));
  if (!user)
    return (
      <div className="container py-16 max-w-4xl">
        <h1 className="text-4xl font-semibold">Your market research lab</h1>
        <p className="mt-4 text-muted-foreground">
          Create isolated experiments, configure Python agents and compare
          repeatable runs. Sign in to keep your experiments private.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-10">
          {[
            ["01", "Design a market"],
            ["02", "Run Python agents"],
            ["03", "Compare the evidence"],
          ].map(([n, t]) => (
            <div className="terminal-panel p-5" key={n}>
              <p className="eyebrow mb-6">{n} / Research</p>
              <h2 className="font-medium">{t}</h2>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Use Login to open your private workspace. The shared market is
          available in the Market tab.
        </p>
      </div>
    );
  return (
    <div className="workspace">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Stonks Research
          </p>
          <h1 className="text-3xl font-semibold mt-1">My experiments</h1>
          <p className="text-muted-foreground mt-2">
            Private, controlled runs. Independent books. Python strategies.
          </p>
        </div>
        <button
          className={button}
          onClick={() => {
            invalidParameters.current.clear();
            setDraft(initial());
            setTitle("New experiment");
            setHypothesis("");
            setEditing(null);
            setTab("design");
            setDesignStep(0);
          }}
        >
          New experiment
        </button>
      </header>
      <nav className="flex gap-2 flex-wrap" aria-label="Research views">
        {["overview", "design", "runs", "results", "compare"].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            className={`${button} ${tab === t ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive p-3 text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded border border-border p-3">
          {notice}
        </p>
      )}
      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              ["Saved experiments", experiments.length],
              [
                "Active runs in recent history",
                runs.filter((r) => ["QUEUED", "RUNNING"].includes(r.status))
                  .length,
              ],
              [
                "Completed in recent history",
                runs.filter((r) => r.status === "COMPLETED").length,
              ],
            ].map(([label, value]) => (
              <div key={label} className="terminal-panel p-5">
                <p className="eyebrow mb-3">{label}</p>
                <p className="metric-value">{value}</p>
              </div>
            ))}
          </div>
          <section className="terminal-panel overflow-hidden">
            <div className="p-5 border-b">
              <h2 className="font-semibold">Personal research</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your questions, configurations and repeatable runs.
              </p>
            </div>
            {!experiments.length ? (
              <div className="p-8 md:p-12">
                <p className="text-xl font-medium">Start with a question.</p>
                <p className="text-muted-foreground text-sm mt-2 max-w-xl">
                  Choose assets, assemble a population and vary one property.
                  Compare repeated seeds to see whether the effect persists.
                </p>
                <button
                  className={`${button} mt-5 bg-primary text-primary-foreground hover:bg-primary/90`}
                  onClick={() => {
                    setTab("design");
                    setDesignStep(0);
                  }}
                >
                  Design your first experiment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th>Experiment</th>
                      <th>Assets</th>
                      <th>Agents</th>
                      <th>Duration</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiments.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <p className="font-medium">{e.title}</p>
                          <p className="text-xs text-muted-foreground max-w-sm truncate">
                            {e.hypothesis || "No hypothesis recorded"}
                          </p>
                        </td>
                        <td>{e.manifest.assets.length}</td>
                        <td>
                          {e.manifest.groups.reduce((n, g) => n + g.count, 0)}
                        </td>
                        <td>{e.manifest.durationMs / 1000}s</td>
                        <td>
                          <button className={button} onClick={() => clone(e)}>
                            Open draft
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              [
                "01 / Configure",
                "Set assets, economic factors, agents and scheduled information.",
              ],
              [
                "02 / Run",
                "Each simulation has independent books and advances in logical time.",
              ],
              [
                "03 / Compare",
                "Inspect spreads, price discovery and cohort P&L across repeated seeds.",
              ],
            ].map(([title, body]) => (
              <div className="p-5 border-t" key={title}>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Shows up to 100 saved experiments and the 200 most recent runs.
          </p>
        </div>
      )}
      {tab === "design" && (
        <div className="grid xl:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4 min-w-0">
            <nav
              aria-label="Experiment setup"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {["Question & timing", "Assets", "Population", "Information"].map(
                (label, i) => (
                  <button
                    key={label}
                    aria-current={designStep === i ? "step" : undefined}
                    className={`${button} text-left ${designStep === i ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                    onClick={() => setDesignStep(i)}
                  >
                    <span className="block text-[10px] mb-1 opacity-60">
                      0{i + 1}
                    </span>
                    {label}
                  </button>
                ),
              )}
            </nav>
            <section hidden={designStep !== 0} className={card}>
              <h2 className="text-xl font-semibold">Question & timing</h2>
              <Field label="Title">
                <input
                  className={input}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Hypothesis">
                <textarea
                  className={input}
                  value={hypothesis}
                  maxLength={2000}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="What do you expect to change, and why?"
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                {(["durationMs", "stepMs"] as const).map((k) => (
                  <Field
                    key={k}
                    label={
                      k === "durationMs"
                        ? "Simulated duration (ms)"
                        : "World update interval (ms)"
                    }
                  >
                    <input
                      className={input}
                      type="number"
                      min={100}
                      value={draft[k]}
                      onChange={(e) =>
                        setDraft({ ...draft, [k]: Number(e.target.value) })
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Logical time advances as fast as the worker can process it. All
                runs use the same exchange rules. Fees are currently zero.
              </p>
            </section>
            <section hidden={designStep !== 1} className={card}>
              <h2 className="text-xl font-semibold">
                Assets & economic relationships
              </h2>
              <p className="text-sm text-muted-foreground">
                Shared sector/subsector names share factors. Weights are
                log-reference volatility per √simulated hour, not measured
                real-world correlations. Liquidity comes from the population.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${input} sm:w-52`}
                  aria-label="Filter catalogue"
                  placeholder="Filter sector or asset"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <select
                  className={`${input} sm:w-72`}
                  aria-label="Add catalogue asset"
                  value=""
                  onChange={(e) => {
                    const a = catalogue.find((x) => x.id === e.target.value);
                    if (a)
                      setDraft({
                        ...draft,
                        assets: [
                          ...draft.assets,
                          {
                            ...asset(`a${draft.assets.length + 1}`),
                            name: a.name,
                            price: String(a.price),
                            sector: a.sector,
                            subsector: a.subsector,
                            templateId: a.id,
                            templateVersion: a.version,
                          },
                        ],
                      });
                  }}
                >
                  <option value="">Add from approved catalogue…</option>
                  {catalogue
                    .filter((a) =>
                      `${a.name} ${a.sector} ${a.subsector}`
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.sector}/{a.subsector}
                      </option>
                    ))}
                </select>
                <button
                  className={button}
                  disabled={draft.assets.length >= 10}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      assets: [
                        ...draft.assets,
                        asset(`a${draft.assets.length + 1}`),
                      ],
                    })
                  }
                >
                  Add private asset
                </button>
              </div>
              {draft.assets.map((a, i) => (
                <div key={i} className="border-t border-border pt-4 space-y-3">
                  <div className="grid sm:grid-cols-4 gap-3">
                    {(["id", "name", "sector", "subsector"] as const).map(
                      (k) => (
                        <Field key={k} label={k}>
                          <input
                            className={input}
                            value={a[k]}
                            disabled={!!a.templateId && k !== "id"}
                            onChange={(e) => patchAsset(i, k, e.target.value)}
                          />
                        </Field>
                      ),
                    )}
                  </div>
                  <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Field label="Initial reference price">
                      <input
                        className={input}
                        value={a.price}
                        onChange={(e) => patchAsset(i, "price", e.target.value)}
                      />
                    </Field>
                    {(
                      [
                        "marketWeight",
                        "sectorWeight",
                        "subsectorWeight",
                        "idiosyncraticWeight",
                      ] as const
                    ).map((k) => (
                      <Field key={k} label={k.replace("Weight", " factor")}>
                        <input
                          className={input}
                          type="number"
                          min="0"
                          max="0.5"
                          step="0.01"
                          value={a[k]}
                          onChange={(e) =>
                            patchAsset(i, k, Number(e.target.value))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  {draft.assets.length > 1 && (
                    <button
                      className={button}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          assets: draft.assets.filter((_, j) => j !== i),
                          events: draft.events.filter(
                            (e) => e.assetId !== a.id,
                          ),
                        })
                      }
                    >
                      Remove asset
                    </button>
                  )}
                  {user.role === "admin" && a.templateId && (
                    <details>
                      <summary className="cursor-pointer text-sm">
                        Operations: edit catalogue classification
                      </summary>
                      <form
                        className="flex gap-2 mt-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void perform(async () => {
                            await api.put(
                              `/research/catalogue/${a.templateId}`,
                              {
                                sector: f.get("sector"),
                                subsector: f.get("subsector"),
                              },
                            );
                            await refresh();
                            setNotice(
                              "Catalogue updated. Remove and re-add this asset to refresh its version before launching.",
                            );
                          });
                        }}
                      >
                        <input
                          className={input}
                          name="sector"
                          aria-label="Catalogue sector"
                          defaultValue={a.sector}
                        />
                        <input
                          className={input}
                          name="subsector"
                          aria-label="Catalogue subsector"
                          defaultValue={a.subsector}
                        />
                        <button className={button} disabled={busy}>
                          Update
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              ))}
            </section>
            <section hidden={designStep !== 2} className={card}>
              <h2 className="text-xl font-semibold">Agent population</h2>
              <p className="text-sm text-muted-foreground">
                Idle and scripted are infrastructure fixtures. Your Python
                strategies appear here when installed by the operator. Inventory
                is allocated per agent per selected asset; adding assets
                increases total endowed wealth unless you adjust allocations.
              </p>
              {draft.groups.map((g, i) => (
                <div key={i} className="border-t border-border pt-4 space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Field label="Group ID">
                      <input
                        className={input}
                        value={g.id}
                        onChange={(e) => patchGroup(i, "id", e.target.value)}
                      />
                    </Field>
                    <Field label="Python strategy">
                      <select
                        className={input}
                        value={g.strategy}
                        onChange={(e) =>
                          patchGroup(i, "strategy", e.target.value)
                        }
                      >
                        {strategies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id}
                            {s.fixture ? " (test fixture)" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Agent count">
                      <input
                        className={input}
                        type="number"
                        min="1"
                        max="100"
                        value={g.count}
                        onChange={(e) =>
                          patchGroup(i, "count", Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {(
                      [
                        "cash",
                        "inventory",
                        "wakeMs",
                        "delayMs",
                        "signalNoise",
                      ] as const
                    ).map((k) => (
                      <Field
                        key={k}
                        label={
                          {
                            cash: "Cash / agent",
                            inventory: "Shares / agent / asset",
                            wakeMs: "Wakeup interval (ms)",
                            delayMs: "Observation delay (ms)",
                            signalNoise: "Signal noise",
                          }[k]
                        }
                      >
                        <input
                          className={input}
                          value={g[k]}
                          onChange={(e) =>
                            patchGroup(
                              i,
                              k,
                              ["cash", "inventory"].includes(k)
                                ? e.target.value
                                : Number(e.target.value),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label="Permitted information">
                    <select
                      className={input}
                      value={g.information ?? "public"}
                      onChange={(e) =>
                        patchGroup(i, "information", e.target.value)
                      }
                    >
                      <option value="public">Public news only</option>
                      <option value="valuation">Noisy valuation only</option>
                      <option value="both">
                        Public news and noisy valuation
                      </option>
                      <option value="none">Book and own account only</option>
                    </select>
                  </Field>
                  <details>
                    <summary className="cursor-pointer">
                      Strategy parameters (JSON)
                    </summary>
                    <textarea
                      key={JSON.stringify(g.parameters)}
                      className={`${input} mt-2 font-mono min-h-24`}
                      defaultValue={JSON.stringify(g.parameters, null, 2)}
                      onBlur={(e) => {
                        try {
                          patchGroup(
                            i,
                            "parameters",
                            JSON.parse(e.target.value),
                          );
                          setError("");
                          invalidParameters.current.delete(i);
                        } catch {
                          invalidParameters.current.add(i);
                          setError("Strategy parameters must be valid JSON");
                        }
                      }}
                    />
                  </details>
                  {draft.groups.length > 1 && (
                    <button
                      className={button}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          groups: draft.groups.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remove group
                    </button>
                  )}
                </div>
              ))}
              <button
                className={button}
                onClick={() =>
                  setDraft({
                    ...draft,
                    groups: [
                      ...draft.groups,
                      group(`g${draft.groups.length + 1}`),
                    ],
                  })
                }
              >
                Add group
              </button>
            </section>
            <section hidden={designStep !== 3} className={card}>
              <h2 className="text-xl font-semibold">Scheduled information</h2>
              <p className="text-sm text-muted-foreground">
                A hidden reference-value shock occurs first; public news is
                released later. Each agent then receives it after its
                observation delay. Prices move only through orders.
              </p>
              {draft.events.map((e, i) => (
                <div
                  key={i}
                  className="grid sm:grid-cols-3 gap-3 border-t border-border pt-4"
                >
                  <Field label="Asset">
                    <select
                      className={input}
                      value={e.assetId}
                      onChange={(x) =>
                        setDraft({
                          ...draft,
                          events: draft.events.map((v, j) =>
                            j === i ? { ...v, assetId: x.target.value } : v,
                          ),
                        })
                      }
                    >
                      {draft.assets.map((a) => (
                        <option key={a.id}>{a.id}</option>
                      ))}
                    </select>
                  </Field>
                  {(
                    [
                      "atMs",
                      "shock",
                      "releaseDelayMs",
                      "signal",
                      "headline",
                    ] as const
                  ).map((k) => (
                    <Field
                      key={k}
                      label={
                        {
                          atMs: "Shock time (ms)",
                          shock: "Fractional value change (0.1 = 10%)",
                          releaseDelayMs: "Public release delay (ms)",
                          signal: "Observed signal (−1 to 1)",
                          headline: "Headline",
                        }[k]
                      }
                    >
                      <input
                        className={input}
                        value={e[k]}
                        onChange={(x) =>
                          setDraft({
                            ...draft,
                            events: draft.events.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    [k]:
                                      k === "headline"
                                        ? x.target.value
                                        : Number(x.target.value),
                                  }
                                : v,
                            ),
                          })
                        }
                      />
                    </Field>
                  ))}
                  <button
                    className={button}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        events: draft.events.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove event
                  </button>
                </div>
              ))}
              <button
                className={button}
                onClick={() =>
                  setDraft({
                    ...draft,
                    events: [
                      ...draft.events,
                      {
                        atMs: Math.floor(draft.durationMs / 2),
                        assetId: draft.assets[0].id,
                        shock: 0.05,
                        releaseDelayMs: 0,
                        headline: "Scheduled announcement",
                        signal: 0.3,
                      },
                    ],
                  })
                }
              >
                Add event
              </button>
            </section>
            <div className="flex justify-between">
              <button
                className={button}
                disabled={designStep === 0}
                onClick={() => setDesignStep((s) => s - 1)}
              >
                Previous step
              </button>
              <button
                className={button}
                disabled={designStep === 3}
                onClick={() => setDesignStep((s) => s + 1)}
              >
                Next step
              </button>
            </div>
          </div>
          <aside className={`${card} h-fit xl:sticky xl:top-6`}>
            <h2 className="font-semibold">Run configuration</h2>
            <p>
              {draft.assets.length} assets ·{" "}
              {draft.groups.reduce((n, g) => n + g.count, 0)} agents
            </p>
            <p className="text-sm">
              Cash:{" "}
              {fmt(
                draft.groups.reduce((n, g) => n + g.count * Number(g.cash), 0),
              )}
            </p>
            <p className="text-sm">
              Duration: {fmt(draft.durationMs / 1000)} simulated seconds
            </p>
            <Field label="Repeated seeds">
              <input
                className={input}
                value={seeds}
                onChange={(e) => setSeeds(e.target.value)}
              />
            </Field>
            <Field label="Optional single-parameter sweep">
              <select
                className={input}
                value={sweep}
                onChange={(e) => setSweep(e.target.value)}
              >
                <option value="none">No sweep</option>
                <option value="count">Agent count</option>
                <option value="wakeMs">Wakeup interval</option>
                <option value="delayMs">Observation delay</option>
                <option value="signalNoise">Signal noise</option>
                <option value="cash">Cash per agent</option>
              </select>
            </Field>
            {sweep !== "none" && (
              <>
                <Field label="Group">
                  <select
                    className={input}
                    value={sweepGroup || draft.groups[0].id}
                    onChange={(e) => setSweepGroup(e.target.value)}
                  >
                    {draft.groups.map((g) => (
                      <option key={g.id}>{g.id}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Comma-separated values">
                  <input
                    className={input}
                    value={sweepValues}
                    onChange={(e) => setSweepValues(e.target.value)}
                  />
                </Field>
              </>
            )}
            <button
              className={`${button} w-full`}
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await save();
                  await refresh();
                  setNotice("Draft saved.");
                })
              }
            >
              Save draft
            </button>
            <button
              className={`${button} w-full bg-primary text-primary-foreground hover:bg-primary/90`}
              disabled={busy}
              onClick={() => void perform(launch)}
            >
              Queue runs
            </button>
            <button
              className={`${button} w-full`}
              onClick={() => exportJson("manifest.json", draft)}
            >
              Export manifest
            </button>
            <p className="text-xs text-muted-foreground">
              At most 10 active runs, 100 agents and 10 assets. Queued runs need
              the Python worker. Changing a draft never changes launched runs.
            </p>
            <h3 className="font-semibold">Saved experiments</h3>
            {experiments.map((e) => (
              <button
                key={e.id}
                className={`${button} text-left w-full`}
                onClick={() => clone(e)}
              >
                {e.title}
              </button>
            ))}
          </aside>
        </div>
      )}
      {tab === "runs" && (
        <section className={card}>
          <h2 className="text-xl font-semibold">Run history</h2>
          {runs.length === 0 ? (
            <p>No runs yet. Design an experiment to begin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "Experiment / run",
                      "Seed",
                      "State",
                      "Logical time",
                      "Actions",
                    ].map((x) => (
                      <th className="text-left p-3" key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr className="border-t border-border" key={r.id}>
                      <td className="p-3">
                        {experiments.find((e) => e.id === r.experiment_id)
                          ?.title ?? "Experiment"}
                        <small className="block text-muted-foreground">
                          {r.id.slice(0, 8)} ·{" "}
                          {new Date(r.created_at).toLocaleString()}
                        </small>
                      </td>
                      <td className="p-3">{r.manifest.seed}</td>
                      <td className="p-3">
                        {r.status}
                        {r.cancel_requested ? " · cancellation requested" : ""}
                      </td>
                      <td className="p-3">
                        {fmt((r.progress.tick ?? 0) / 1000)} s
                      </td>
                      <td className="p-3 space-x-2">
                        <button
                          className={button}
                          onClick={() => void perform(() => inspect(r))}
                        >
                          Inspect
                        </button>
                        {["QUEUED", "RUNNING"].includes(r.status) && (
                          <button
                            className={button}
                            disabled={busy || r.cancel_requested}
                            onClick={() =>
                              void perform(async () => {
                                await api.post(`/research/runs/${r.id}/cancel`);
                                await refresh();
                              })
                            }
                          >
                            Cancel
                          </button>
                        )}
                        {r.status === "COMPLETED" && (
                          <button
                            className={button}
                            disabled={compare.some((c) => c.id === r.id)}
                            onClick={() =>
                              void perform(async () => {
                                const { data } = await api.get(
                                  `/research/runs/${r.id}`,
                                );
                                setCompare((c) => [...c, data]);
                              })
                            }
                          >
                            Compare
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === "results" &&
        (!selected ? (
          <p>Select a run from Run history.</p>
        ) : (
          <div className="space-y-6">
            <section className={card}>
              <div className="flex justify-between flex-wrap gap-3">
                <h2 className="text-xl font-semibold">
                  {selected.status} · seed {selected.manifest.seed}
                </h2>
                <div className="flex gap-2">
                  <button
                    className={button}
                    onClick={() => {
                      setDraft(structuredClone(selected.manifest));
                      setEditing(null);
                      setTitle("Cloned run");
                      setHypothesis("");
                      setTab("design");
                      setDesignStep(0);
                    }}
                  >
                    Clone configuration
                  </button>
                  <button
                    className={button}
                    onClick={() =>
                      exportJson(`run-${selected.id}.json`, selected)
                    }
                  >
                    Export run
                  </button>
                </div>
              </div>
              {selected.error && (
                <p role="alert" className="text-destructive">
                  {selected.error}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {selected.status === "QUEUED"
                  ? "Waiting for the research worker. Start it using the research operations guide."
                  : "Controlled simulated time; viewing this page does not affect ordering."}
              </p>
              {selected.result && (
                <p className="text-xs break-all">
                  Economic hash: {selected.result.economicHash}
                </p>
              )}
              <select
                className={`${input} max-w-xs`}
                aria-label="Chart asset"
                value={chartAsset}
                onChange={(e) => setChartAsset(e.target.value)}
              >
                {selected.manifest.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={points}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="seconds"
                      label={{
                        value: "Simulated seconds",
                        position: "insideBottom",
                        offset: -2,
                      }}
                    />
                    <YAxis domain={["auto", "auto"]} width={65} />
                    <Tooltip
                      contentStyle={{
                        background: "#19191c",
                        border: "1px solid #303034",
                        borderRadius: 4,
                      }}
                    />
                    <Legend verticalAlign="top" />
                    <Line
                      dataKey="reference"
                      name="Hidden reference (observer)"
                      stroke="#b7b7c0"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="mid"
                      name="Two-sided midpoint"
                      stroke="#55c48c"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-muted-foreground">
                Missing midpoint means one side of the book is empty. Reference
                values are model assumptions. These observer plots are never
                delivered to strategies as hidden truth.
              </p>
            </section>
            {selected.result && (
              <>
                <section className={card}>
                  <h2 className="text-xl font-semibold">Measurements</h2>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Mean quoted spread</th>
                          <th>Empty-book sample fraction</th>
                          <th>Reference RMSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selected.result.metrics).map(
                          ([a, m]) => (
                            <tr key={a}>
                              <td className="p-3">{a}</td>
                              <td>{fmt(m.meanSpread)}</td>
                              <td>{fmt(m.emptyBookFraction)}</td>
                              <td>{fmt(m.referenceRmse)}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sample averages, not time-weighted estimates. Spread and
                    RMSE exclude missing two-sided books. Review empty-book
                    fraction alongside them.
                  </p>
                  <h3 className="font-semibold">Cohort marked P&amp;L</h3>
                  {Object.entries(selected.result.cohorts).map(([g, v]) => (
                    <p key={g}>
                      {g}: {fmt(v.pnl)} (initial wealth {fmt(v.initialWealth)},
                      final {fmt(v.finalWealth)})
                    </p>
                  ))}
                </section>
                <section className={card}>
                  <h2 className="text-xl font-semibold">
                    Final book · {chartAsset}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {(["buys", "sells"] as const).map((side) => (
                      <div key={side}>
                        <h3>{side === "buys" ? "Bids" : "Asks"}</h3>
                        {selected
                          .result!.report.books[chartAsset]?.[side].slice(0, 10)
                          .map((l, i) => (
                            <p key={i} className="font-mono text-sm">
                              {l.price} × {l.quantity}
                            </p>
                          ))}
                      </div>
                    ))}
                  </div>
                  <h3 className="font-semibold">
                    Fills ({selected.result.report.trades.length})
                  </h3>
                  {selected.result.report.trades.slice(-20).map((t) => (
                    <p key={t.sequence} className="text-sm font-mono">
                      #{t.sequence} · {t.quantity} @ {t.price} · {t.timestamp}
                    </p>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Export contains the complete recorded fill list and action
                    log.
                  </p>
                </section>
              </>
            )}
          </div>
        ))}
      {tab === "compare" && (
        <section className={card}>
          <h2 className="text-xl font-semibold">Compare completed runs</h2>
          <p className="text-sm text-muted-foreground">
            Add runs from history. Compare compatible configurations and paired
            seed sets; this table does not claim statistical significance.
          </p>
          {compare.length === 0 ? (
            <p>No runs selected.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "Run",
                      "Seed",
                      "Asset",
                      "Spread",
                      "Empty fraction",
                      "RMSE",
                      "",
                    ].map((x, i) => (
                      <th className="p-3 text-left" key={i}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compare.flatMap((r) =>
                    Object.entries(r.result?.metrics ?? {}).map(([a, m]) => (
                      <tr
                        className="border-t border-border"
                        key={`${r.id}-${a}`}
                      >
                        <td className="p-3">
                          {experiments.find((e) => e.id === r.experiment_id)
                            ?.title ?? r.id.slice(0, 8)}
                        </td>
                        <td>{r.manifest.seed}</td>
                        <td>{a}</td>
                        <td>{fmt(m.meanSpread)}</td>
                        <td>{fmt(m.emptyBookFraction)}</td>
                        <td>{fmt(m.referenceRmse)}</td>
                        <td>
                          <button
                            className={button}
                            onClick={() =>
                              setCompare((c) => c.filter((x) => x.id !== r.id))
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            className={button}
            disabled={!compare.length}
            onClick={() => exportJson("comparison.json", compare)}
          >
            Export comparison
          </button>
        </section>
      )}
    </div>
  );
}
