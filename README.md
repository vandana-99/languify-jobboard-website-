# Languify Job Board

A responsive, one-page job discovery dashboard for Languify.

For engineering takeover, start with [TECH_HANDOVER.md](TECH_HANDOVER.md): current status, account access, configuration, deployment steps and launch checks.

The page is designed to sit inside Languify's navigation. It shows a **Job Board** title, with the duplicate page logo, Case Master AI promotion and Powered by footer removed. Original brand assets remain available for future standalone use.

## Current review version

- Languify blue styling and a responsive desktop/mobile layout.
- Keyword and location search; category, work arrangement, experience, job type and date filters.
- Newest, company and title sorting; grid/list views and pagination.
- Job details drawer and bookmarks stored on this device.
- **View job** opens the original listing directly in the same tab. Clicking a job title opens its description drawer. Samples use **Preview job** and have no application links.
- Clearly labelled sample jobs. Sample salaries and openings are illustrative; applications are disabled for samples.

As of 6 October 2026, the Next.js production build and thirteen focused Apify checks pass, including multiple task feeds, original source URLs and partial outages. A fresh deployment of the complete current source was attempted on 6 October, but Vercel rejected creation with **403 Forbidden**: the connected account must re-authenticate with access to the `product-8646` workspace. No new deployment was created. The earlier [Vercel deployment](https://vercel.com/product-8646/languify-jobboard/Adt2eC7kdVhcD3k61EYAT4pi4xKC) is confirmed **ERROR** (`module_not_found`); the current connection also cannot read its build logs. There is no verified working Vercel URL yet. See the handover for exact hosting and live-feed status.

Authenticated Apify retrieval, production deployment, the custom domain, and the main-site navigation link are still pending. Until Apify is configured, the preview uses the labelled sample feed. Samples do not have real application links.

## Apify connection

A server-side feed adapter is implemented in `lib/apify.ts`; it is dormant without configuration. It reads completed Apify datasets from up to five saved tasks, merges and deduplicates their listings, never launches paid scraper runs from public requests, and does not expose the API token to the browser. The browser checks `/api/jobs` every 60 seconds and on return to the tab. Job-source refresh frequency and scraper execution time determine actual freshness; this is polling, not instantaneous push delivery.

The selected scraper is [`curious_coder/linkedin-jobs-scraper`](https://apify.com/curious_coder/linkedin-jobs-scraper). Its documented fields are mapped in `lib/jobs.ts`, including salary arrays, millisecond posting timestamps, workplace labels and expiration dates. The original `listingUrl` is kept separately from the application `url`: **View job** follows the listing, while **Apply on source** in the details drawer can lead directly to the employer. A valid employer URL is the fallback if no usable listing URL was supplied. LinkedIn job IDs preserve bookmarks and remove duplicates across changed search URLs. Standalone work arrangement tags in job titles are used when the structured workplace fields are missing.

The owner's export `dataset_linkedin-jobs-scraper_2026-09-09_04-51-13-142.json` was validated against the mapper on 9 September 2026. All 20 records were accepted with unique job identities, company, title, location, posting date, description, and a usable LinkedIn URL. All were Product roles and Full-time. At the export timestamp, 10 matched Past 7 days and all 20 matched Past 30 days. The structured salary and direct employer application URL fields were empty for all records; the board therefore keeps salary unknown and links applicants to LinkedIn. One job has an explicit On-site title tag; the other 19 have no mapped work arrangement. Salaries or workplace details may still appear inside the full descriptions; the mapper does not infer them from prose. An exported file validates formatting and filters, not current vacancy availability or a live API connection. The original export is not embedded in the website.

To activate the feed:

1. Obtain the owner's saved Task link or Dataset link for this actor, plus access to its results. The public actor name identifies the scraper, not the owner's selected searches or listings.
2. Configure `APIFY_TOKEN` as a secret server environment variable and `APIFY_TASK_ID` as the saved task's ID. For multiple platforms, set `APIFY_TASK_IDS` to a comma-separated list of up to five saved task IDs; it overrides the singular variable. Alternatively, set `APIFY_DATASET_ID` for a fixed dataset. Task mode takes precedence and tracks the latest successful runs automatically; a fixed dataset does not follow future runs that create new datasets.
3. Verify authenticated API retrieval against the validated export, set `DEMO_MODE=false`, and publish the configured dashboard after checking the feed. The owner completed a manual 20-job test run; no API token or account connection has been supplied yet, and no scraper run or schedule has been started by the dashboard.

The dashboard displays the latest completed snapshot, rather than accumulating separate runs. For a rolling month of jobs, the actor's `datePosted` filter supports `pastMonth`; a last-24-hours-only scrape will not preserve earlier listings in this board. Apify task scheduling determines when the source is refreshed. The dashboard's 60-second polling only picks up results that have already been scraped.

Run the focused Apify checks with `npm run test:apify`.

The adapter divides a total budget of 1,000 raw records equally across configured sources, deduplicates canonical job URLs, drops explicitly closed/expired listings, and treats missing salaries/dates as unknown. It does not independently verify whether a job is still accepting applicants. Healthy tasks continue updating when another fails, with a delayed-feed notice. A warm server instance can retain each source's last successful snapshot for up to one hour; repeated failures do not renew that window. There is no durable database yet, and samples never replace a broken live feed.

Naukri and other platforms each require an appropriate actor and saved task. The supplied LinkedIn actor does not collect Naukri. Validate a real sample against `lib/jobs.ts` for every new actor; the handover lists accepted fields. Naukri URL handling is checked using synthetic records, not an active Naukri integration.

## Development

The current workspace uses the included Sites build pipeline (`npm run build`) for its private review URL. Vercel uses the installed Next.js runtime through `vercel.json`: `npm ci`, `npm run build:vercel`, and `.next` output. For local Next.js development use `npm run dev:vercel`; for a built local server use `npm run start:vercel`. The Sites build output must not be uploaded directly to Vercel.

`DEMO_MODE=false` disables demo fallback. Vercel production also disables it automatically. No secrets are included in source.

## Continuous updates on Vercel

1. Save the validated search as an Apify task. Schedule that task in Apify so collection continues independently of website visits or website deployments. The schedule is not configured by this repository. Choose the scrape interval and result limit with the owner before activating recurring billable runs; the 20-job input was only a connection test.
2. Connect the source repository to a Vercel project. `vercel.json` selects Next.js and the correct build without replacing the Sites review workflow.
3. In Vercel Project Settings → Environment Variables, add `APIFY_TOKEN` as Sensitive, plus `APIFY_TASK_ID` or `APIFY_TASK_IDS`, and `DEMO_MODE=false` for the intended deployment environment. Redeploy after adding or changing environment variables. `.env.example` contains only empty placeholders.
4. Validate one completed task run through the deployed API. The server follows that task's latest successful dataset automatically, so a new scrape does not require replacing a dataset ID, uploading JSON, or redeploying the site.

An open dashboard checks every 60 seconds, and immediately when its tab becomes visible or the browser comes back online. The API uses `no-store` for browser/CDN caching and a 30-second in-memory server cache to bound repeated Apify reads. Allow the scrape interval, scrape duration, and up to roughly 90 seconds plus network/request time for the new snapshot to reach an already-open page. This is automatic polling of scraped data, not an instantaneous LinkedIn event stream or a guarantee of uninterrupted updates.

Source timestamps and stale/error messages remain visible. On a failed refresh, an already-open page keeps its last received listings; a warm server can also retain its last good feed for up to an hour. There is no durable backup store across Vercel cold starts. An open job drawer follows refreshed data and closes if its listing is absent from a successful replacement snapshot. Search filters and bookmarks remain in place during updates.

No Vercel cron route is needed: Apify handles scheduling, while Vercel serves the page and reads completed data. Increasing scrape frequency consumes more Apify credits. A fixed exported JSON file or a dataset from a one-off run cannot keep itself updated.

## Connect to languify.in

The proposed public address is `https://jobs.languify.in/`. This domain has not been configured, and the main website's navigation has not been edited.

1. Deploy this project to Vercel with the Apify environment variables above.
2. In the Vercel project's Settings → Domains, add `jobs.languify.in`. Add the project-specific CNAME shown by Vercel to the current DNS provider and wait for a valid configuration. Use the value displayed for this project, not a guessed DNS target. See [Vercel's custom domain instructions](https://vercel.com/docs/domains/working-with-domains/add-a-domain).
3. Add **Job Board** below **Interview wizard** and above **Bookmarks** in Languify's existing sidebar, plus its mobile navigation, once the domain and feed work. Reuse the existing menu styling. `integration/JobBoardNavLink.tsx` provides a copyable React component with an outline briefcase icon, or use:

```html
<a href="https://jobs.languify.in/">Job Board</a>
```

The main platform supplies the surrounding Languify navigation and branding. The job board server reads the latest completed task results when a visitor opens the page, subject to the 30-second server cache. The open page then refreshes automatically. Each real job's **View job** link takes the visitor straight to its source listing.

Publishing at `languify.in/jobs` instead would require routing changes in the main website's hosting setup; those files and hosting details are not available in this project.

## References

- [Apify API authentication](https://docs.apify.com/api/v2)
- [Latest successful task run](https://docs.apify.com/api/v2/actor-task-runs-last-get)
- [Apify schedules](https://docs.apify.com/actors/running/schedules)
- [Vercel function routes](https://vercel.com/docs/functions/functions-api-reference)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
