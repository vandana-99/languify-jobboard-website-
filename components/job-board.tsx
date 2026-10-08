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

function CompanyMark({ company, logo }: { company: string; logo?: string | null }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const imageUrl = logo && logo !== failedLogo ? logo : null;
  const initials = company === "Razorpay" ? "R" : company === "Deloitte" ? "D." : company.split(/\s+/).slice(0, 2).map(p => p[0]).join("");
  return <span className={`company-mark ${imageUrl ? "mark-logo" : `mark-${companyColors[company] || "blue"}`}`} aria-hidden="true">
    {imageUrl ? <img key={imageUrl} src={imageUrl} alt="" width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedLogo(imageUrl)} /> : initials}
  </span>;
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
