export const ROLES = ["Product", "Consulting", "Growth", "Business", "Design", "Other"] as const;
export type Role = (typeof ROLES)[number];
export type Job = {
  id: string; title: string; company: string; location: string; workMode: string;
  companyLogo?: string | null;
  employmentType: string; experience: string; role: Role; salary: string | null;
  description: string; skills: string[]; postedAt: string | null;
  url: string | null; listingUrl: string | null; source: string; demo: boolean;
};
export type JobFeed = {
  jobs: Job[]; mode: "demo" | "live" | "error" | "unconfigured";
  fetchedAt: string; sourceUpdatedAt: string | null; stale: boolean;
  truncated: boolean; message: string | null;
};
type Row = Record<string, unknown>;
const record = (x: unknown): Row => x && typeof x === "object" && !Array.isArray(x) ? x as Row : {};
export function plainText(value: unknown, limit = 15000): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).slice(0, 60000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, limit);
}
function pick(row: Row, keys: string[], limit = 500): string {
  for (const key of keys) { const value = plainText(row[key], limit); if (value) return value; }
  return "";
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2500) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "[::1]" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || !host.includes(".")) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|trk|trackingId|refId)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}
function companyLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || !safeUrl(value)) return null;

  // Preserve the original image URL, including its signed parameters.
  return new URL(value).protocol === "https:" ? value.trim() : null;
}
export function absoluteDate(value: unknown): string | null {
  // Relative dates must not move forward every time the feed refreshes.
  // The selected LinkedIn actor also supplies Unix milliseconds.
  if (typeof value === "number" || typeof value === "string" && /^\d{13}$/.test(value)) {
    const time = Number(value);
    return Number.isFinite(time) && time >= 1_000_000_000_000 && time < 10_000_000_000_000
      ? new Date(time).toISOString() : null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function pickDate(row: Row, keys: string[]): string | null {
  for (const key of keys) { const value = absoluteDate(row[key]); if (value) return value; }
  return null;
}
function pickUrl(row: Row, keys: string[]): string | null {
  for (const key of keys) { const value = safeUrl(row[key]); if (value) return value; }
  return null;
}
function jobIdentity(url: string): string {
  const parsed = new URL(url);
  if (/(^|\.)linkedin\.com$/.test(parsed.hostname)) {
    // Search position, tracking parameters and title slugs can change between runs.
    const id = parsed.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1];
    if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
  }
  return url;
}
function inferRole(title: string, explicit: string): Role {
  if (/design|ux|ui\b/i.test(explicit || title)) return "Design";
  if (/product|\bpm\b/i.test(explicit || title)) return "Product";
  if (/consult|advisory/i.test(explicit || title)) return "Consulting";
  if (/growth|marketing|acquisition/i.test(explicit || title)) return "Growth";
  if (/business|strategy|operation|founder|entrepreneur|\beir\b|analyst/i.test(explicit || title)) return "Business";
  return "Other";
}
function salaryText(row: Row): string | null {
  const direct = pick(row, ["salary", "salaryText", "salaryInfo", "salaryDescription", "compensation"]);
  if (direct) return direct;
  if (Array.isArray(row.salaryInfo)) {
    const amounts = [...new Set(row.salaryInfo.slice(0, 4).map(value => plainText(value, 120)).filter(Boolean))];
    // Preserve the source currency and period; never label an unknown amount as LPA.
    if (amounts.length) return amounts.join(amounts.length === 2 ? " – " : "; ");
  }
  const data = record(row.salary || row.baseSalary), value = record(data.value);
  const min = value.minValue ?? data.min ?? data.minValue, max = value.maxValue ?? data.max ?? data.maxValue;
  const currency = plainText(data.currency || row.salaryCurrency, 10);
  const unit = plainText(value.unitText || data.period || data.interval, 20);
  if (typeof min !== "number" && typeof max !== "number") return null;
  const amounts = [min, max].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return `${currency ? currency + " " : ""}${amounts.map(n => n.toLocaleString("en-IN")).join("–")}${unit ? " / " + unit.toLowerCase() : ""}`;
}
export function normalizeJob(input: unknown, now = Date.now()): Job | null {
  const row = record(input);
  if (row.isExpired === true || row.isClosed === true || row.isActive === false || /^(closed|expired|inactive)$/i.test(pick(row, ["status"]))) return null;
  const expires = pickDate(row, ["validThrough", "expirationDate", "expiresAt", "expireAt"]);
  if (expires && Date.parse(expires) <= now) return null;
  const title = pick(row, ["title", "jobTitle", "positionName", "position"], 240);
  const companyData = record(row.company || row.hiringOrganization);
  const company = pick(row, ["companyName", "company", "organizationName"], 150) || pick(companyData, ["name"], 150);
  const listingUrl = pickUrl(row, ["jobUrl", "jobLink", "link", "url"]);
  const url = pickUrl(row, ["applyUrl", "applicationUrl"]) || listingUrl;
  if (!title || !company || !url) return null;
  const loc = record(row.location || row.jobLocation), address = record(loc.address);
  const location = pick(row, ["location", "jobLocation", "locationName", "formattedLocation"], 200)
    || pick(loc, ["name", "displayName"], 200)
    || [address.addressLocality, address.addressRegion, address.addressCountry].map(v => plainText(v, 80)).filter(Boolean).join(", ") || "Not specified";
  const workplaces = Array.isArray(row.workplaceTypes)
    ? row.workplaceTypes.map(value => plainText(value, 80)).filter(Boolean).join(" ")
    : plainText(row.workplaceTypes, 240);
  const mode = pick(row, ["workMode", "workplaceType", "locationType", "remoteType", "jobLocationType"]) || workplaces;
  // Some public LinkedIn results put the arrangement in a title tag instead.
  // Read standalone tags, without treating e.g. "Hybrid Cloud" as a work mode.
  const titleMode = title.match(/(?:^|[([|,·]|\s[-–—]\s)\s*(on[ -]?site|remote|hybrid)\s*(?=$|[)\]|,·]|\s[-–—]\s)/i)?.[1];
  const modeContext = mode || titleMode || location;
  const workMode = /hybrid/i.test(modeContext) ? "Hybrid"
    : /remote|telecommute/i.test(modeContext) ? "Remote"
    : /on.?site|office/i.test(modeContext) ? "On-site"
    : row.isRemote === true || row.workRemoteAllowed === true ? "Remote"
    : row.isRemote === false ? "On-site" : "Not specified";
  const rawType = Array.isArray(row.employmentType) ? row.employmentType.join(" ") : pick(row, ["employmentType", "contractType", "jobType"]);
  const employmentType = /intern/i.test(rawType || title) ? "Internship" : /part[ _-]?time/i.test(rawType) ? "Part-time" : /contract|freelance|temporary/i.test(rawType) ? "Contract" : /full[ _-]?time/i.test(rawType) ? "Full-time" : "Not specified";
  const seniority = pick(row, ["experienceLevel", "seniorityLevel", "experience", "experienceRequired"]);
  const experience = /intern|entry|fresher|junior|graduate/i.test(seniority || title) ? "Entry level" : /senior|lead|head|director|executive|principal/i.test(seniority || title) ? "Senior level" : /mid|associate|intermediate/i.test(seniority || title) ? "Mid level" : "Not specified";
  const skillsInput = row.skills || row.tags || row.keySkills;
  const skills = (Array.isArray(skillsInput) ? skillsInput : typeof skillsInput === "string" ? skillsInput.split(",") : [])
    .map(s => typeof s === "object" ? pick(record(s), ["name", "skill"]) : plainText(s, 60)).filter(Boolean).slice(0, 10);
  const host = new URL(listingUrl || url).hostname.replace(/^www\./, "");
  const source = /(^|\.)linkedin\.com$/.test(host) ? "LinkedIn" : /(^|\.)naukri\.com$/.test(host) ? "Naukri" : /(^|\.)indeed\.com$/.test(host) ? "Indeed" : host;
  return {
    id: jobIdentity(listingUrl || url), title, company, location, workMode, employmentType, experience,
    companyLogo: companyLogoUrl(row.companyLogo),
    role: inferRole(title, pick(row, ["category", "department", "roleCategory"])), salary: salaryText(row),
    description: pick(row, ["descriptionText", "description", "jobDescription", "descriptionHtml"], 15000) || "See the original job posting for the full description and application requirements.",
    skills, postedAt: pickDate(row, ["postedAtTimestamp", "postedAt", "publishedAt", "publishedDate", "datePosted", "postedTime"]),
    url, listingUrl: listingUrl || url, source, demo: false,
  };
}
export function normalizeJobs(rows: unknown[], now = Date.now()): Job[] {
  const unique = new Map<string, Job>();
  for (const row of rows) { const job = normalizeJob(row, now); if (job && !unique.has(job.id)) unique.set(job.id, job); }
  return [...unique.values()].sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
}
export type JobFilters = { query: string; location: string; roles: string[]; modes: string[]; levels: string[]; types: string[]; posted: string };
export const EMPTY_FILTERS: JobFilters = { query: "", location: "", roles: [], modes: [], levels: [], types: [], posted: "any" };
export function filterJobs(jobs: Job[], filters: JobFilters, now: number): Job[] {
  const query = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const location = filters.location.trim().toLowerCase();
  const cutoff = filters.posted === "any" ? 0 : now - Number(filters.posted) * 86400000;
  return jobs.filter(job => {
    const text = [job.title, job.company, job.role, ...job.skills].join(" ").toLowerCase();
    return query.every(word => text.includes(word)) && (!location || `${job.location} ${job.workMode}`.toLowerCase().includes(location))
      && (!filters.roles.length || filters.roles.includes(job.role)) && (!filters.modes.length || filters.modes.includes(job.workMode))
      && (!filters.levels.length || filters.levels.includes(job.experience)) && (!filters.types.length || filters.types.includes(job.employmentType))
      && (!cutoff || !!job.postedAt && Date.parse(job.postedAt) >= cutoff);
  });
}
export function relativeDate(date: string | null, now: number): string {
  if (!date) return "Date not listed";
  const days = Math.floor(Math.max(0, now - Date.parse(date)) / 86400000);
  return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
}
