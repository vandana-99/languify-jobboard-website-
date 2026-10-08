import { demoJobs } from "./demo-jobs";
import { absoluteDate, normalizeJobs, type JobFeed } from "./jobs";

const API = "https://api.apify.com/v2";
const CACHE_MS = 30_000;
const MAX_ROWS = 1000;
const MAX_TASKS = 5;
const STALE_MS = 3_600_000;
type Source = { kind: "task" | "dataset"; id: string };
type Snapshot = { jobs: JobFeed["jobs"]; sourceUpdatedAt: string | null; truncated: boolean; fetchedAt: number };
let cache: { key: string; expires: number; value: JobFeed; sources: Map<string, Snapshot> } | null = null;
let inFlight: { key: string; promise: Promise<JobFeed> } | null = null;

function emptyFeed(mode: JobFeed["mode"], message: string | null): JobFeed {
  return { jobs: [], mode, fetchedAt: new Date().toISOString(), sourceUpdatedAt: null, stale: false, truncated: false, message };
}

async function apifyJson(path: string, token: string, signal: AbortSignal): Promise<{ body: unknown; total: number | null }> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal, cache: "no-store", redirect: "error",
  });
  if (!response.ok) throw new Error(`Apify returned HTTP ${response.status}`);
  // Bound each response to keep arbitrary actor output within runtime memory limits.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Apify returned an empty response");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4_000_000) { await reader.cancel(); throw new Error("Apify response exceeded size limit"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const totalHeader = response.headers.get("x-apify-pagination-total");
  const total = totalHeader === null ? null : Number(totalHeader);
  return { body: JSON.parse(new TextDecoder().decode(bytes)), total: total !== null && Number.isFinite(total) ? total : null };
}

async function readSource(token: string, source: Source, maxRows: number, signal: AbortSignal): Promise<Snapshot> {
  let datasetId = source.id;
  let sourceUpdatedAt: string | null = null;
  if (source.kind === "task") {
    const { body } = await apifyJson(`/actor-tasks/${encodeURIComponent(source.id)}/runs/last?status=SUCCEEDED`, token, signal);
    const run = (body as { data?: { defaultDatasetId?: string; finishedAt?: string; status?: string } }).data;
    if (!run?.defaultDatasetId || run.status !== "SUCCEEDED") throw new Error("No completed Apify task run");
    datasetId = run.defaultDatasetId;
    sourceUpdatedAt = absoluteDate(run.finishedAt);
  } else {
    const { body } = await apifyJson(`/datasets/${encodeURIComponent(datasetId)}`, token, signal);
    sourceUpdatedAt = absoluteDate((body as { data?: { modifiedAt?: string } }).data?.modifiedAt);
  }
  if (!/^[a-zA-Z0-9_~.-]+$/.test(datasetId)) throw new Error("Invalid dataset identifier");
  const jobs = new Map<string, JobFeed["jobs"][number]>();
  let truncated = false;
  for (let offset = 0; offset < maxRows; offset += 100) {
    const limit = Math.min(100, maxRows - offset);
    const { body, total } = await apifyJson(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&desc=true&offset=${offset}&limit=${limit}`, token, signal);
    if (!Array.isArray(body)) throw new Error("Apify dataset is not an array");
    for (const job of normalizeJobs(body.slice(0, limit))) if (!jobs.has(job.id)) jobs.set(job.id, job);
    if (body.length > limit) { truncated = true; break; }
    if (body.length < limit || total !== null && offset + body.length >= total) break;
    if (offset + limit >= maxRows) truncated = true;
  }
  return { jobs: [...jobs.values()], sourceUpdatedAt, truncated, fetchedAt: Date.now() };
}

async function readFeed(token: string, sources: Source[], key: string): Promise<JobFeed> {
  const signal = AbortSignal.timeout(20_000);
  // One bounded request window; divide the record budget fairly between sources.
  const outcomes = await Promise.allSettled(sources.map(source => readSource(token, source, Math.floor(MAX_ROWS / sources.length), signal)));
  const now = Date.now();
  const snapshots = new Map<string, Snapshot>();
  let failures = 0;
  outcomes.forEach((outcome, index) => {
    const sourceKey = `${sources[index].kind}:${sources[index].id}`;
    if (outcome.status === "fulfilled") snapshots.set(sourceKey, outcome.value);
    else {
      failures++;
      const previous = cache?.key === key ? cache.sources.get(sourceKey) : undefined;
      // Retrying must not reset the age of a failed source's last good result.
      if (previous && now - previous.fetchedAt < STALE_MS) snapshots.set(sourceKey, previous);
    }
  });
  // Never return upstream error bodies, task IDs or credentials to the browser.
  if (!snapshots.size) return emptyFeed("error", "We couldn’t load the job feed. Please try again shortly.");
  const values = [...snapshots.values()];
  const jobs = new Map<string, JobFeed["jobs"][number]>();
  const sorted = values.flatMap(value => value.jobs).sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
  for (const job of sorted) if (!jobs.has(job.id)) jobs.set(job.id, job);
  // Show the oldest source update so a fresh source cannot hide a delayed one.
  const sourceUpdatedAt = values.every(value => value.sourceUpdatedAt !== null)
    ? new Date(Math.min(...values.map(value => Date.parse(value.sourceUpdatedAt!)))).toISOString() : null;
  const feed: JobFeed = {
    jobs: [...jobs.values()], mode: "live", fetchedAt: new Date(now).toISOString(), sourceUpdatedAt,
    stale: failures > 0 || sourceUpdatedAt === null || now - Date.parse(sourceUpdatedAt) > STALE_MS,
    truncated: values.some(value => value.truncated),
    message: failures ? sources.length === 1
      ? "The feed could not refresh. Showing the last available listings."
      : "Some job sources could not refresh. Showing available listings; some may be delayed."
      : sourceUpdatedAt === null ? "Source update time is unavailable." : null,
  };
  cache = { key, expires: now + CACHE_MS, value: feed, sources: snapshots };
  return feed;
}

export async function getJobFeed(): Promise<JobFeed> {
  const token = process.env.APIFY_TOKEN?.trim() || "";
  const taskList = process.env.APIFY_TASK_IDS?.trim() || "";
  const task = process.env.APIFY_TASK_ID?.trim() || "";
  const dataset = process.env.APIFY_DATASET_ID?.trim() || "";
  if (!token && !taskList && !task && !dataset && process.env.DEMO_MODE !== "false" && process.env.VERCEL_ENV !== "production") {
    return { ...emptyFeed("demo", null), jobs: demoJobs };
  }
  const tasks = [...new Set((taskList || task).split(",").map(id => id.trim()).filter(Boolean))];
  const sources: Source[] = tasks.length ? tasks.map(id => ({ kind: "task", id })) : !taskList && dataset ? [{ kind: "dataset", id: dataset }] : [];
  if (!token || !sources.length || sources.length > MAX_TASKS || !sources.every(source => /^[a-zA-Z0-9_~.-]+$/.test(source.id))) {
    return emptyFeed("unconfigured", "Job listings are not available yet. Please check back soon.");
  }
  const key = JSON.stringify([token, sources]);
  if (cache?.key === key && cache.expires > Date.now()) return cache.value;
  if (inFlight?.key === key) return inFlight.promise;
  const promise = readFeed(token, sources, key);
  inFlight = { key, promise };
  try { return await promise; } finally { if (inFlight?.promise === promise) inFlight = null; }
}
