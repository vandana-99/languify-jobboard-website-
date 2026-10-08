import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

// Load server modules in isolation without a web server or real Apify requests.
function moduleUrl(path, imports = {}) {
  let source = stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), "utf8"));
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
async function api() {
  const jobs = moduleUrl("../lib/jobs.ts");
  const demo = moduleUrl("../lib/demo-jobs.ts", { "./jobs": jobs });
  const feed = moduleUrl("../lib/apify.ts", { "./jobs": jobs, "./demo-jobs": demo }) + `#${crypto.randomUUID()}`;
  return import(moduleUrl("../app/api/jobs/route.ts", { "@/lib/apify": feed }));
}
function environment(t, values) {
  const keys = ["APIFY_TOKEN", "APIFY_TASK_ID", "APIFY_TASK_IDS", "APIFY_DATASET_ID", "DEMO_MODE", "VERCEL_ENV"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) {
    if (key in values) process.env[key] = values[key];
    else delete process.env[key];
  }
  t.after(() => { for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  } });
}

test("Vercel production serves an unavailable state until Apify is configured", async t => {
  environment(t, { VERCEL_ENV: "production" });
  const upstream = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network call"); });
  const { GET } = await api();
  const response = await GET();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const feed = await response.json();
  assert.equal(feed.mode, "unconfigured");
  assert.deepEqual(feed.jobs, []);
  assert.equal(upstream.mock.callCount(), 0);
});

test("later successful task runs replace the feed without a redeploy and failures retain the last result", async t => {
  environment(t, { APIFY_TOKEN: "unit-test-token", APIFY_TASK_ID: "task-test", VERCEL_ENV: "production" });
  let now = Date.parse("2026-09-09T12:00:00Z");
  let version = 1;
  let unavailable = false;
  t.mock.method(Date, "now", () => now);
  const upstream = t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.apify.com");
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.headers.Authorization, "Bearer unit-test-token");
    if (unavailable) return Response.json({ debug: "private-upstream-details" }, { status: 503 });
    if (url.pathname === "/v2/actor-tasks/task-test/runs/last") {
      assert.equal(url.searchParams.get("status"), "SUCCEEDED");
      return Response.json({ data: { status: "SUCCEEDED", defaultDatasetId: `dataset-${version}`, finishedAt: new Date(now).toISOString() } });
    }
    assert.equal(url.pathname, `/v2/datasets/dataset-${version}/items`);
    return Response.json([{
      title: `Product Manager ${version}`, companyName: "Example Company", location: "India",
      link: `https://www.linkedin.com/jobs/view/${1234567890 + version}/`, postedAt: "2026-09-09",
    }], { headers: { "x-apify-pagination-total": "1" } });
  });
  const { GET } = await api();
  const first = await (await GET()).json();
  assert.equal(first.mode, "live");
  assert.equal(first.jobs[0].title, "Product Manager 1");
  assert.equal(JSON.stringify(first).includes("unit-test-token"), false);

  version = 2;
  now += 31_000;
  const updatedResponse = await GET();
  assert.equal(updatedResponse.headers.get("Cache-Control"), "no-store");
  const updated = await updatedResponse.json();
  assert.equal(updated.jobs.length, 1);
  assert.equal(updated.jobs[0].title, "Product Manager 2");
  assert.notEqual(updated.jobs[0].id, first.jobs[0].id);
  assert.equal(upstream.mock.callCount(), 4);

  unavailable = true;
  now += 31_000;
  const stale = await (await GET()).json();
  assert.equal(stale.mode, "live");
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.jobs, updated.jobs);
  assert.ok(stale.message.includes("could not refresh"));
  assert.equal(JSON.stringify(stale).includes("private-upstream-details"), false);
});

test("multiple tasks merge original source links, deduplicate, and let healthy sources update independently", async t => {
  environment(t, { APIFY_TOKEN: "unit-test-token", APIFY_TASK_IDS: "linkedin-task, naukri-task, linkedin-task", APIFY_TASK_ID: "ignored-task", VERCEL_ENV: "production" });
  let now = Date.parse("2026-10-05T10:00:00Z");
  let version = 1;
  let naukriUnavailable = false;
  t.mock.method(Date, "now", () => now);
  const linkedIn = () => ({ title: `Product Manager ${version}`, companyName: "Example", link: `https://www.linkedin.com/jobs/view/${1000000000 + version}/`, postedAt: new Date(now).toISOString() });
  t.mock.method(globalThis, "fetch", async input => {
    const url = new URL(input);
    if (url.pathname.includes("/actor-tasks/")) {
      const task = url.pathname.split("/")[3];
      assert.ok(["linkedin-task", "naukri-task"].includes(task));
      if (task === "naukri-task" && naukriUnavailable) return Response.json({ secret: "private-upstream-details" }, { status: 503 });
      return Response.json({ data: { status: "SUCCEEDED", defaultDatasetId: task, finishedAt: new Date(now).toISOString() } });
    }
    const rows = url.pathname.includes("linkedin-task") ? [linkedIn()] : [
      linkedIn(),
      { title: "Business Analyst", companyName: "Example", jobUrl: "https://www.naukri.com/job-listings-business-analyst-12345", postedAt: "2026-10-05" },
    ];
    return Response.json(rows, { headers: { "x-apify-pagination-total": String(rows.length) } });
  });
  const { GET } = await api();
  const initial = await (await GET()).json();
  assert.equal(initial.mode, "live");
  assert.equal(initial.stale, false);
  assert.equal(initial.jobs.length, 2);
  assert.deepEqual(initial.jobs.map(job => job.source).sort(), ["LinkedIn", "Naukri"]);
  assert.ok(initial.jobs.find(job => job.source === "Naukri").listingUrl.startsWith("https://www.naukri.com/job-listings-"));

  naukriUnavailable = true;
  version = 2;
  now += 31_000;
  const partial = await (await GET()).json();
  assert.equal(partial.mode, "live");
  assert.equal(partial.stale, true);
  assert.ok(partial.jobs.some(job => job.title === "Product Manager 2"));
  assert.ok(partial.jobs.some(job => job.source === "Naukri"));
  assert.equal(partial.sourceUpdatedAt, initial.sourceUpdatedAt);
  assert.match(partial.message, /Some job sources/);
  assert.equal(JSON.stringify(partial).includes("unit-test-token"), false);
  assert.equal(JSON.stringify(partial).includes("private-upstream-details"), false);

  now += 3_600_000;
  const expiredFallback = await (await GET()).json();
  assert.equal(expiredFallback.jobs.length, 1);
  assert.equal(expiredFallback.jobs[0].title, "Product Manager 2");
  assert.equal(expiredFallback.stale, true);
});

test("a cold partial outage returns available jobs, while total failure returns a labelled 503", async t => {
  environment(t, { APIFY_TOKEN: "unit-test-token", APIFY_TASK_IDS: "healthy, unavailable", VERCEL_ENV: "production" });
  let allUnavailable = false;
  t.mock.method(globalThis, "fetch", async input => {
    const url = new URL(input);
    if (allUnavailable || url.pathname.includes("unavailable")) return new Response(null, { status: 503 });
    if (url.pathname.includes("actor-tasks")) return Response.json({ data: { status: "SUCCEEDED", defaultDatasetId: "healthy-data", finishedAt: new Date().toISOString() } });
    return Response.json([{ title: "Designer", companyName: "Example", url: "https://careers.example.com/jobs/designer" }]);
  });
  const first = await api();
  const response = await first.GET();
  assert.equal(response.status, 200);
  const feed = await response.json();
  assert.equal(feed.stale, true);
  assert.equal(feed.jobs.length, 1);

  allUnavailable = true;
  const cold = await api();
  const failure = await cold.GET();
  assert.equal(failure.status, 503);
  const error = await failure.json();
  assert.equal(error.mode, "error");
  assert.deepEqual(error.jobs, []);
});

test("multiple sources share a bounded total record budget", async t => {
  environment(t, { APIFY_TOKEN: "unit-test-token", APIFY_TASK_IDS: "one,two,three", VERCEL_ENV: "production" });
  const rawCounts = new Map();
  t.mock.method(globalThis, "fetch", async input => {
    const url = new URL(input);
    const source = url.pathname.split("/")[3];
    if (url.pathname.includes("actor-tasks")) return Response.json({ data: { status: "SUCCEEDED", defaultDatasetId: source, finishedAt: new Date().toISOString() } });
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    assert.ok(limit > 0 && limit <= 100);
    rawCounts.set(source, (rawCounts.get(source) || 0) + limit);
    return Response.json(Array.from({ length: limit }, (_, i) => ({ title: "Designer", companyName: "Example", jobUrl: `https://careers.example.com/jobs/${source}-${offset + i}` })), { headers: { "x-apify-pagination-total": "2000" } });
  });
  const { GET } = await api();
  const feed = await (await GET()).json();
  assert.equal(feed.truncated, true);
  assert.equal(feed.jobs.length, 999);
  assert.deepEqual([...rawCounts.values()], [333, 333, 333]);
});

test("invalid or excessive task configuration makes no upstream calls", async t => {
  environment(t, { APIFY_TOKEN: "unit-test-token", APIFY_TASK_IDS: "one,two,three,four,five,six", VERCEL_ENV: "production" });
  const upstream = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  const { GET } = await api();
  assert.equal((await GET()).status, 503);
  process.env.APIFY_TASK_IDS = "https://console.apify.com/tasks/test";
  assert.equal((await GET()).status, 503);
  assert.equal(upstream.mock.callCount(), 0);
});
