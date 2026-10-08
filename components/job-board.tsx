"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, Clock3, ExternalLink, Globe2, GraduationCap, Info, Laptop, LayoutGrid, List, MapPin, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { EMPTY_FILTERS, ROLES, filterJobs, relativeDate, type Job, type JobFeed, type JobFilters } from "@/lib/jobs";

type FilterKey = "roles" | "modes" | "levels" | "types";
const SAVE_KEY = "languify-saved-jobs-v1";
const PAGE_SIZE = 6;
const companyColors: Record<string, string> = { Razorpay: "blue", Deloitte: "black", Swiggy: "orange", Groww: "green", Meesho: "pink", Freshworks: "teal", PhonePe: "purple", "Bain & Company": "red", "Urban Company": "black", CRED: "black", Postman: "orange", Zomato: "red" };

function CompanyMark({ company }: { company: string }) {
  const initials = company === "Razorpay" ? "R" : company === "Deloitte" ? "D." : company.split(/\s+/).slice(0, 2).map(p => p[0]).join("");
  return <span className={`company-mark mark-${companyColors[company] || "blue"}`} aria-hidden="true">{initials}</span>;
}
function timeLabel(value: string | null) {
  if (!value) return "Update time unavailable";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";
}

function FilterGroup({ title, filterKey, options, jobs, filters, onChange }: { title: string; filterKey: FilterKey; options: readonly string[]; jobs: Job[]; filters: JobFilters; onChange: (key: FilterKey, value: string) => void }) {
    const HeadingIcon = { roles: LayoutGrid, modes: Laptop, levels: GraduationCap, types: BriefcaseBusiness }[filterKey];
    return <fieldset className="filter-group"><legend><HeadingIcon size={16} aria-hidden="true" />{title}</legend>{options.map(option => {
      const count = jobs.filter(job => ({ roles: job.role, modes: job.workMode, levels: job.experience, types: job.employmentType })[filterKey] === option).length;
      return <label className="filter-option" key={option}><Checkbox checked={filters[filterKey].includes(option)} onCheckedChange={() => onChange(filterKey, option)} /><span>{option}</span><span className="filter-number">{count}</span></label>;
    })}</fieldset>;
  }

export default function JobBoard({ initialFeed }: { initialFeed: JobFeed }) {
  const [feed, setFeed] = useState(initialFeed);
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [queryInput, setQueryInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [tab, setTab] = useState("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [sort, setSort] = useState("newest");
  const [layout, setLayout] = useState("grid");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Job | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const refreshAbort = useRef<AbortController | null>(null);
  const now = Date.parse(feed.fetchedAt);

  useEffect(() => {
    try { const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); if (Array.isArray(data)) setSaved(data.filter((x): x is string => typeof x === "string").slice(0, 500)); }
    catch { setStorageError(true); }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch { setStorageError(true); }
  }, [saved, storageReady]);

  const refresh = useCallback(async (manual = false) => {
    if (pending.current) return;
    pending.current = true; setRefreshing(true);
    const controller = new AbortController();
    refreshAbort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch("/api/jobs", { cache: "no-store", signal: controller.signal });
      const next = await response.json() as JobFeed;
      if (!Array.isArray(next.jobs) || !["live", "demo", "error", "unconfigured"].includes(next.mode) || !Number.isFinite(Date.parse(next.fetchedAt))) throw new Error("Invalid feed");
      setFeed(previous => {
        if ((next.mode === "error" || next.mode === "unconfigured") && previous.mode === "live") return { ...previous, stale: true, message: next.message };
        return next;
      });
      if (manual && response.ok) toast.message(next.mode === "demo" ? "Preview refreshed. Live listings need a connected feed." : next.stale ? "Showing the latest available feed; it may be out of date." : "You’re viewing the latest available jobs.");
    } catch {
      if (!controller.signal.aborted || !document.hidden) setFeed(previous => ({ ...previous, stale: true, message: "Unable to refresh. Check your connection and try again." }));
    } finally { clearTimeout(timeout); pending.current = false; setRefreshing(false); }
  }, []);
  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); refreshAbort.current?.abort(); };
  }, [refresh]);

  useEffect(() => {
    // Keep an open job drawer in step with the latest successful feed.
    setSelected(current => current ? feed.jobs.find(job => job.id === current.id) ?? null : null);
  }, [feed.jobs]);


  function toggleSave(job: Job) {
    const alreadySaved = saved.includes(job.id);
    if (!alreadySaved && saved.length >= 500) { toast.message("You’ve reached 500 saved jobs. Remove a job to save another."); return; }
    setSaved(previous => alreadySaved ? previous.filter(id => id !== job.id) : [...previous, job.id]);
    toast.message(alreadySaved ? "Job removed from your saved list." : "Job saved on this device.");
  }
  function changeFilter(key: FilterKey, value: string) {
    setFilters(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(v => v !== value) : [...current[key], value] }));
    setPage(1);
  }
  function reset() { setFilters(EMPTY_FILTERS); setQueryInput(""); setLocationInput(""); setPage(1); }
  function doSearch(event: React.FormEvent) { event.preventDefault(); setFilters(current => ({ ...current, query: queryInput, location: locationInput })); setPage(1); }
  const filtered = useMemo(() => {
    const base = tab === "saved" ? feed.jobs.filter(j => saved.includes(j.id)) : feed.jobs;
    const output = filterJobs(base, filters, now);
    if (sort === "company") output.sort((a, b) => a.company.localeCompare(b.company));
    else if (sort === "title") output.sort((a, b) => a.title.localeCompare(b.title));
    else output.sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
    return output;
  }, [feed.jobs, tab, saved, filters, now, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleJobs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filterCount = filters.roles.length + filters.modes.length + filters.levels.length + filters.types.length + (filters.posted !== "any" ? 1 : 0);
  const activeSaved = feed.jobs.filter(j => saved.includes(j.id)).length;
  const hasFilters = filterCount > 0 || !!filters.query || !!filters.location;

  const filterContent = <>
    <div className="filter-heading"><h2><SlidersHorizontal size={17} /> Filters{filterCount > 0 && <span className="count-pill">{filterCount}</span>}</h2><button className="text-button" onClick={reset}>Reset all</button></div>
    <FilterGroup jobs={feed.jobs} filters={filters} onChange={changeFilter} title="Job category" filterKey="roles" options={ROLES.filter(role => role !== "Other" || feed.jobs.some(j => j.role === "Other"))} />
    <FilterGroup jobs={feed.jobs} filters={filters} onChange={changeFilter} title="Work arrangement" filterKey="modes" options={["Remote", "Hybrid", "On-site"]} />
    <FilterGroup jobs={feed.jobs} filters={filters} onChange={changeFilter} title="Experience level" filterKey="levels" options={["Entry level", "Mid level", "Senior level"]} />
    <FilterGroup jobs={feed.jobs} filters={filters} onChange={changeFilter} title="Job type" filterKey="types" options={["Full-time", "Internship", "Part-time", "Contract"]} />
    <div className="filter-group"><span className="filter-label">Date posted</span><Select value={filters.posted} onValueChange={posted => { setFilters(c => ({ ...c, posted })); setPage(1); }}><SelectTrigger className="date-select" aria-label="Date posted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Any time</SelectItem><SelectItem value="1">Past 24 hours</SelectItem><SelectItem value="7">Past 7 days</SelectItem><SelectItem value="30">Past 30 days</SelectItem></SelectContent></Select></div>
  </>;

  return <Tabs value={tab} onValueChange={value => { setTab(value); setPage(1); }} className="jobboard">
    <a href="#job-results" className="skip-link">Skip to job results</a>
    <header className="site-header"><div className="header-inner">
      <span className="board-label">Job Board</span>
      <TabsList className="header-tabs" variant="line" aria-label="Job views"><TabsTrigger value="all"><BriefcaseBusiness />Find jobs</TabsTrigger><TabsTrigger value="saved"><Bookmark />Saved jobs{activeSaved > 0 && <span className="nav-count">{activeSaved}</span>}</TabsTrigger></TabsList>
    </div></header>
    <main className="main-shell">
      <section className="discovery" aria-labelledby="page-title">
        <div className="discovery-heading"><div><p className="eyebrow"><span className="eyebrow-line" />THE NEXT CHAPTER OF YOUR CAREER</p><h1 id="page-title">Find your next <span>opportunity.</span></h1><p className="intro">Explore roles in Product, Consulting, Growth, and beyond.</p></div><span className={`feed-status ${feed.mode === "live" && !feed.stale ? "connected" : "preview"}`}><span className="status-dot" />{feed.mode === "demo" ? "Preview mode" : feed.mode === "live" ? feed.stale ? "Feed delayed" : "Auto-updating feed" : "Feed unavailable"}</span></div>
        <form className="search-bar" onSubmit={doSearch} role="search">
          <label className="search-field"><Search size={21} aria-hidden="true" /><span className="sr-only">Search job title, company, or skill</span><input value={queryInput} onChange={e => setQueryInput(e.target.value)} placeholder="Job title, company, or keyword" />{queryInput && <button type="button" className="input-clear" aria-label="Clear search" onClick={() => { setQueryInput(""); setFilters(c => ({ ...c, query: "" })); setPage(1); }}><X size={15} /></button>}</label>
          <label className="search-field location-field"><MapPin size={20} aria-hidden="true" /><span className="sr-only">Location</span><input value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="City or remote" />{locationInput && <button type="button" className="input-clear" aria-label="Clear location" onClick={() => { setLocationInput(""); setFilters(c => ({ ...c, location: "" })); setPage(1); }}><X size={15} /></button>}</label>
          <Button className="search-button" type="submit">Search jobs<ArrowRight size={17} /></Button>
        </form>
        <div className="quick-searches"><span>Popular searches:</span>{["Product Manager", "Business Analyst", "Intern"].map(term => <button key={term} onClick={() => { setQueryInput(term); setFilters(c => ({ ...c, query: term })); setPage(1); }}>{term}<ArrowUpRight size={12} /></button>)}</div>
      </section>
      <div className="workspace">
        <aside className="filter-sidebar" aria-label="Filter jobs">{filterContent}</aside>
        <section className="results-section" id="job-results" aria-label="Job results">
          <div className="results-toolbar"><div><h2>{tab === "saved" ? "Your saved jobs" : "Explore opportunities"}<span className="result-count">{filtered.length}</span></h2><p>{tab === "saved" ? "Your shortlist, saved on this device." : "Discover a role that fits your next move."}</p></div><Button variant="outline" className="mobile-filter-button" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={16} />Filters{filterCount > 0 ? ` (${filterCount})` : ""}</Button><div className="sort-controls"><span className="sort-label">Sort by:</span><Select value={sort} onValueChange={v => { setSort(v); setPage(1); }}><SelectTrigger aria-label="Sort jobs" className="sort-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="company">Company A–Z</SelectItem><SelectItem value="title">Job title A–Z</SelectItem></SelectContent></Select><div className="view-toggle" aria-label="Results layout"><button aria-label="Grid view" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={17} /></button><button aria-label="List view" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={18} /></button></div></div></div>
          <div className={`feed-note ${feed.stale || feed.mode === "error" ? "feed-warning" : ""}`}><span>{feed.mode === "demo" ? <><Info size={15} /><span><strong>Sample listings.</strong> These are examples, not verified job openings.</span></> : <><Clock3 size={15} /><span>{feed.message || `${feed.stale ? "Last available update" : "Source updated"}: ${timeLabel(feed.sourceUpdatedAt)}`}{feed.mode === "live" && <span className="refresh-hint"> · Checks every minute</span>}</span></>}</span><button onClick={() => void refresh(true)} disabled={refreshing} aria-label="Refresh job feed"><RefreshCw size={14} className={refreshing ? "spinning" : ""} /><span>{refreshing ? "Refreshing" : "Refresh"}</span></button></div>
          {storageError && <p className="inline-notice">Your browser could not save this list. Bookmarks will last for this session only.</p>}
          {hasFilters && <div className="active-filters">{filters.query && <span>“{filters.query}”<button aria-label="Remove search" onClick={() => { setFilters(c => ({ ...c, query: "" })); setQueryInput(""); setPage(1); }}><X size={13} /></button></span>}{filters.location && <span><MapPin size={12} />{filters.location}<button aria-label="Remove location filter" onClick={() => { setFilters(c => ({ ...c, location: "" })); setLocationInput(""); setPage(1); }}><X size={13} /></button></span>}{(["roles", "modes", "levels", "types"] as FilterKey[]).flatMap(key => filters[key].map(value => <span key={key + value}>{value}<button aria-label={`Remove ${value} filter`} onClick={() => changeFilter(key, value)}><X size={13} /></button></span>))}{filters.posted !== "any" && <span>Past {filters.posted} day{filters.posted === "1" ? "" : "s"}<button aria-label="Remove date filter" onClick={() => { setFilters(c => ({ ...c, posted: "any" })); setPage(1); }}><X size={13} /></button></span>}<button className="text-button" onClick={reset}>Clear all</button></div>}
          {feed.truncated && <p className="inline-notice">Showing a limited selection from each source, up to 1,000 records in total.</p>}
          <TabsContent value={tab} className="results-panel">
            <div className={`jobs-grid ${layout === "list" ? "list-layout" : ""}`} aria-live="polite" aria-busy={refreshing}>
              {visibleJobs.map(job => <article className="job-card" key={job.id}>
                <div className="card-top">
                  <CompanyMark company={job.company} />
                  <div className="company-info"><span>{job.company}</span><span className="posted-date">{job.demo ? <><Info size={12} aria-hidden="true" />Sample listing</> : <><Clock3 size={12} aria-hidden="true" />{relativeDate(job.postedAt, now)}</>}</span></div>
                  <button className={`bookmark-button ${saved.includes(job.id) ? "is-saved" : ""}`} aria-label={`${saved.includes(job.id) ? "Unsave" : "Save"} ${job.title} at ${job.company}`} aria-pressed={saved.includes(job.id)} onClick={() => toggleSave(job)}><Bookmark size={19} fill={saved.includes(job.id) ? "currentColor" : "none"} /></button>
                </div>
                <h3 className="job-title"><button onClick={() => setSelected(job)}>{job.title}</button></h3>
                <div className="job-location">
                  <span className="job-city"><MapPin size={15} aria-hidden="true" /><span>{job.location}</span></span>
                  {job.workMode !== "Not specified" && <span className={`work-mode work-${job.workMode.toLowerCase()}`}>{job.workMode === "Remote" ? <Globe2 size={13} aria-hidden="true" /> : job.workMode === "Hybrid" ? <Laptop size={13} aria-hidden="true" /> : <Building2 size={13} aria-hidden="true" />}{job.workMode}</span>}
                </div>
                <div className="job-tags"><span className={`role-tag role-${job.role.toLowerCase()}`}>{job.role}</span>{job.employmentType !== "Not specified" && <span><BriefcaseBusiness size={12} aria-hidden="true" />{job.employmentType}</span>}{job.experience !== "Not specified" && <span><GraduationCap size={13} aria-hidden="true" />{job.experience}</span>}</div>
                <div className="job-skills">{job.skills.length ? <><span className="skills-label">Key skills</span><span>{job.skills.slice(0, 3).join(" · ")}</span></> : <span>View listing for role requirements</span>}</div>
                <div className="card-footer">
                  <div className="salary"><span className="salary-value">{job.salary || "Salary not disclosed"}</span><span>{job.demo ? "Illustrative compensation" : `Via ${job.source}`}</span></div>
                  {job.demo ? (
                    <Button variant="outline" className="details-button" aria-label={`Preview ${job.title} at ${job.company}`} onClick={() => setSelected(job)}>Preview job<ArrowRight size={16} aria-hidden="true" /></Button>
                  ) : job.listingUrl ? (
                    <Button asChild variant="outline" className="details-button"><a href={job.listingUrl} aria-label={`View ${job.title} at ${job.company} on ${job.source}`}>View job<ArrowUpRight size={16} aria-hidden="true" /></a></Button>
                  ) : <Button variant="outline" className="details-button" disabled>Link unavailable</Button>}
                </div>
              </article>)}
            </div>
            {!visibleJobs.length && <Empty className="jobs-empty"><EmptyHeader><EmptyMedia variant="icon">{tab === "saved" ? <Bookmark /> : <Search />}</EmptyMedia><EmptyTitle>{feed.mode === "error" ? "Jobs couldn’t load" : feed.mode === "unconfigured" ? "New opportunities are on their way" : tab === "saved" && !hasFilters ? "Your next move, saved for later" : "No jobs match these filters"}</EmptyTitle><EmptyDescription>{feed.mode === "error" ? "The job source is temporarily unavailable. Try refreshing in a moment." : feed.mode === "unconfigured" ? "Please check back soon for the latest openings." : tab === "saved" && !hasFilters ? "Tap the bookmark on a job to add it here. Only jobs in the current feed appear in your shortlist." : "Try another keyword, location, or a broader set of filters."}</EmptyDescription></EmptyHeader><Button onClick={() => { if (feed.mode === "error" || feed.mode === "unconfigured") void refresh(true); else { reset(); if (tab === "saved") setTab("all"); } }}>{feed.mode === "error" || feed.mode === "unconfigured" ? "Try again" : hasFilters ? "Clear filters" : "Explore jobs"}</Button></Empty>}
          </TabsContent>
          {filtered.length > 0 && <div className="results-bottom"><span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} {feed.mode === "demo" ? "sample " : ""}jobs</span><Pagination className="job-pagination"><PaginationContent><PaginationItem><Button variant="outline" size="icon" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></Button></PaginationItem>{Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - currentPage) <= 1).map((p, index, all) => <PaginationItem key={p}>{index > 0 && p - all[index - 1] > 1 && <span className="pagination-gap">…</span>}<Button variant={p === currentPage ? "default" : "ghost"} size="icon" aria-label={`Page ${p}`} aria-current={p === currentPage ? "page" : undefined} onClick={() => setPage(p)}>{p}</Button></PaginationItem>)}<PaginationItem><Button variant="outline" size="icon" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></Button></PaginationItem></PaginationContent></Pagination></div>}
        </section>
      </div>
    </main>
    <Sheet open={mobileFilters} onOpenChange={setMobileFilters}><SheetContent side="left" className="mobile-filter-sheet"><SheetHeader><SheetTitle>Refine your search</SheetTitle><SheetDescription>Choose the roles and working style that fit you.</SheetDescription></SheetHeader><div className="mobile-filter-content">{filterContent}</div><Button className="mobile-show-results" onClick={() => setMobileFilters(false)}>Show {filtered.length} jobs</Button></SheetContent></Sheet>
    <Sheet open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><SheetContent className="job-detail-sheet">{selected && <><SheetHeader className="detail-heading"><CompanyMark company={selected.company} /><span className="detail-company">{selected.company}</span><SheetTitle className="detail-title">{selected.title}</SheetTitle><SheetDescription>{selected.location} · {selected.workMode}</SheetDescription></SheetHeader><div className="detail-body">{selected.demo && <div className="sample-disclaimer"><Info size={17} /><span>This is a sample listing. Applications are unavailable.</span></div>}<div className="detail-facts"><div><BriefcaseBusiness size={17} /><span>Job type<strong>{selected.employmentType}</strong></span></div><div><GraduationCap size={19} /><span>Experience<strong>{selected.experience}</strong></span></div><div><Building2 size={17} /><span>Work arrangement<strong>{selected.workMode}</strong></span></div><div><Globe2 size={17} /><span>Compensation<strong>{selected.salary || "Not disclosed"}</strong></span></div></div><h3>About the role</h3><p className="job-description">{selected.description}</p>{selected.skills.length > 0 && <><h3>Skills</h3><div className="detail-skills">{selected.skills.map(skill => <span key={skill}>{skill}</span>)}</div></>}<p className="source-note">{selected.demo ? "All details shown are illustrative." : `Posted ${relativeDate(selected.postedAt, now).toLowerCase()} · Source: ${selected.source}. Confirm availability and details on the original posting.`}</p></div><div className="detail-actions"><Button variant="outline" onClick={() => toggleSave(selected)}><Bookmark size={17} fill={saved.includes(selected.id) ? "currentColor" : "none"} />{saved.includes(selected.id) ? "Saved" : "Save job"}</Button>{selected.url && !selected.demo ? <Button asChild><a href={selected.url} target="_blank" rel="noopener noreferrer">Apply on source<ExternalLink size={16} /></a></Button> : <Button disabled>Sample listing</Button>}</div></>}</SheetContent></Sheet>
    <Toaster theme="light" position="bottom-center" closeButton toastOptions={{ duration: 4000 }} />
  </Tabs>;
}
