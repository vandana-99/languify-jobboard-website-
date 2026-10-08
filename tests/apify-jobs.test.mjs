import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FILTERS, filterJobs, normalizeJob, normalizeJobs } from "../lib/jobs.ts";

// Synthetic records using the selected actor's documented output fields.
// https://apify.com/curious_coder/linkedin-jobs-scraper
const now = Date.parse("2026-09-08T12:00:00Z");
const listing = {
  id: "1234567890",
  title: "Product Manager",
  companyName: "Example Company",
  link: "https://www.linkedin.com/jobs/view/product-manager-at-example-1234567890?trackingId=first&position=1&pageNum=0",
  location: "Bengaluru, Karnataka, India",
  salaryInfo: ["₹18,00,000/year", "₹24,00,000/year"],
  postedAt: "2026-09-08",
  postedAtTimestamp: Date.parse("2026-09-08T06:30:00Z"),
  descriptionHtml: "<p>Build useful products.</p><script>untrusted()</script><p>Work with customers.</p>",
  seniorityLevel: "Associate",
  employmentType: "Full-time",
  workplaceTypes: ["Hybrid"],
};

test("LinkedIn output preserves salary, location, description and job filters", () => {
  const job = normalizeJob(listing, now);
  assert.ok(job);
  assert.equal(job.salary, "₹18,00,000/year – ₹24,00,000/year");
  assert.equal(job.location, listing.location);
  assert.equal(job.postedAt, "2026-09-08T06:30:00.000Z");
  assert.equal(job.description, "Build useful products.\nWork with customers.");
  assert.equal(job.source, "LinkedIn");
  assert.equal(job.demo, false);
  assert.equal(filterJobs([job], {
    ...EMPTY_FILTERS, query: "product", location: "Bengaluru", roles: ["Product"],
    modes: ["Hybrid"], levels: ["Mid level"], types: ["Full-time"], posted: "1",
  }, now).length, 1);
});

test("date filters use absolute timestamps without moving relative dates forward", () => {
  const recent = normalizeJob({ ...listing, postedAt: "6 hours ago", postedAtTimestamp: String(listing.postedAtTimestamp) }, now);
  const older = normalizeJob({ ...listing, postedAt: "2 days ago", postedAtTimestamp: now - 2 * 86400000 }, now);
  const unknown = normalizeJob({ ...listing, postedAt: "6 hours ago", postedAtTimestamp: null }, now);
  assert.equal(recent.postedAt, "2026-09-08T06:30:00.000Z");
  assert.equal(unknown.postedAt, null);
  assert.deepEqual(filterJobs([recent, older, unknown], { ...EMPTY_FILTERS, posted: "1" }, now), [recent]);
  assert.equal(normalizeJob({ ...listing, postedAtTimestamp: "invalid" }, now).postedAt, "2026-09-08T00:00:00.000Z");
});

test("the actor's expiration field removes expired jobs", () => {
  assert.equal(normalizeJob({ ...listing, expireAt: now - 1 }, now), null);
  assert.equal(normalizeJob({ ...listing, expireAt: "2026-09-08T12:00:00Z" }, now), null);
  assert.ok(normalizeJob({ ...listing, expireAt: now + 86400000 }, now));
});

test("duplicate LinkedIn listings retain their identity when tracking and apply links change", () => {
  const first = { ...listing, applyUrl: "https://careers.example.com/apply/role-one?utm_source=linkedin" };
  const second = {
    ...listing, link: "https://in.linkedin.com/jobs/view/1234567890/?position=8&pageNum=2",
    applyUrl: "https://careers.example.com/apply/role-one?session=different",
  };
  const jobs = normalizeJobs([first, second], now);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, "https://www.linkedin.com/jobs/view/1234567890/");
  assert.equal(jobs[0].source, "LinkedIn");
  assert.equal(jobs[0].url, "https://careers.example.com/apply/role-one");
  assert.equal(jobs[0].listingUrl, "https://www.linkedin.com/jobs/view/product-manager-at-example-1234567890?position=1&pageNum=0");
  const nextRun = normalizeJobs([second], now);
  assert.equal(nextRun[0].id, jobs[0].id);
});

test("explicit workplace labels take priority over the remote permission flag", () => {
  assert.equal(normalizeJob({ ...listing, workRemoteAllowed: true }, now).workMode, "Hybrid");
  assert.equal(normalizeJob({ ...listing, workplaceTypes: ["On-site"], workRemoteAllowed: true }, now).workMode, "On-site");
  assert.equal(normalizeJob({ ...listing, workplaceTypes: ["Remote"] }, now).workMode, "Remote");
  assert.equal(normalizeJob({ ...listing, workplaceTypes: [], workRemoteAllowed: true }, now).workMode, "Remote");
  assert.equal(normalizeJob({ ...listing, workplaceTypes: [], workRemoteAllowed: false }, now).workMode, "Not specified");
});

test("work arrangement tags from the real export remain available to filters", () => {
  const row = { ...listing, title: "Product Manager (Jaipur | On-site | 4-5 YOE)", workplaceTypes: undefined };
  const job = normalizeJob(row, now);
  assert.equal(job.workMode, "On-site");
  assert.equal(filterJobs([job], { ...EMPTY_FILTERS, modes: ["On-site"] }, now).length, 1);
  assert.equal(normalizeJob({ ...row, workplaceTypes: ["Hybrid"] }, now).workMode, "Hybrid");
  assert.equal(normalizeJob({ ...row, title: "Product Manager - Remote" }, now).workMode, "Remote");
  assert.equal(normalizeJob({ ...row, title: "Product Manager (Hybrid Cloud)" }, now).workMode, "Not specified");
});

test("missing pay stays unknown and an unsafe application link falls back to the listing", () => {
  const job = normalizeJob({ ...listing, salaryInfo: [], applyUrl: "javascript:alert(1)" }, now);
  assert.equal(job.salary, null);
  assert.ok(job.url.startsWith("https://www.linkedin.com/jobs/view/"));
  assert.equal(job.listingUrl, job.url);
  const employerOnly = normalizeJob({ ...listing, link: "javascript:alert(1)", applyUrl: "https://careers.example.com/jobs/product-manager" }, now);
  assert.equal(employerOnly.listingUrl, "https://careers.example.com/jobs/product-manager");
  assert.equal(normalizeJob({ ...listing, applyUrl: "javascript:alert(1)", link: "http://localhost/private" }, now), null);
});
