# Languify Job Board — Technical Handover

**Status as of 6 October 2026: the current application passes its local Next.js production build and thirteen Apify checks. Deploying the current source was blocked by Vercel account access (403). The live feed and public launch remain pending.**

## Intended experience

Users select **Job Board** in Languify's existing sidebar, open the Vercel-hosted job board, browse automatically refreshed job results, and select **View job** to visit that exact listing on LinkedIn, Naukri, or the configured source platform. Based on the supplied dashboard reference, place **Job Board** between **Interview wizard** and **Bookmarks**, using the existing sidebar styling and an outline briefcase icon. The proposed address is `https://jobs.languify.in/`; it has not been configured. A verified Vercel production domain can be used instead.

Freshness comes from two separate actions: Apify periodically collects jobs, and the dashboard reads the latest completed collection. Opening or refreshing the dashboard does not start a scraper run.

## What is ready and what remains

| Area | Current status | Engineering follow-up |
| --- | --- | --- |
| Dashboard and branding | Responsive layout, restrained cards, Job Board title; duplicate logo, preparation CTA and Powered by footer removed | Review the current source on desktop and mobile |
| Discovery | Implemented: search, location, category, work arrangement, experience, job type, date filters, sorting and pagination | Check against the agreed production job mix |
| Saved jobs | Implemented in browser storage | Device-local; there is no account sync |
| View job | Direct link to the original posting; job titles also open a description drawer | Verify several current source listings in the deployed app |
| Apify adapter | Server-side; accepts up to five saved tasks, merges and deduplicates their output | Supply scheduled task IDs and a private API token; validate each actor's output |
| Source coverage | LinkedIn mapping checked against the owner's export; generic source mapping and Naukri links covered by synthetic checks | Select a Naukri actor and validate its real output before enabling it; the LinkedIn actor does not scrape Naukri |
| Automatic refresh | Implemented: every 60 seconds while visible, on return to the tab and reconnection | Verify replacement results after a later successful task run |
| Apify schedule | Not configured or verified in this project | Create and enable the approved schedule |
| Vercel hosting | Current source deployment attempted on 6 October; creation rejected with 403 for workspace `product-8646`. No new deployment created | Reconnect Vercel with access to that workspace, deploy the verified source, and confirm READY |
| Languify integration | Copyable sidebar component included; the main platform itself has not been edited | Configure the domain and add **Job Board** in the main sidebar |
| Verification | Next.js production build and thirteen focused Apify checks passed on 6 October, including multiple sources and partial failures | Deployed live-data and browser acceptance checks remain pending |

The owner supplied a 20-job JSON export from `curious_coder/linkedin-jobs-scraper`. All 20 records mapped successfully and preserved the original LinkedIn URL. The test data contains Product roles in India, all Full-time. Structured salary and direct employer application URL fields were empty; one title supplied an explicit On-site label. This validates the format, not present-day vacancy availability or a live API connection. The uploaded export is not embedded as the website's live feed.

## Files and ownership

Share `languify-jobboard-vercel.zip` with the engineering team. It contains application source, branding assets, the dependency lockfile, `vercel.json`, `.env.example`, tests, this handover, and `README.md`. It excludes dependencies, generated builds, Git credentials and actual API tokens.

Import this source into a **Languify-owned repository** and link that repository to the intended Vercel project. The preview created in this session used uploaded source files; a continuous Git deployment workflow has not been configured by this work. The current internal source repository should not be assumed accessible to every developer. Do not hand over temporary repository credentials.

The bundle retains the removal of the **Back to Languify** header button. The 5 October update adds multiple task feeds and the sidebar integration example. The 6 October update removes the Case Master AI promotion, duplicate Languify wordmark, and Powered by footer from the deployed application source to match the frontend review. Use the complete current source bundle as the implementation reference.

| File | Purpose |
| --- | --- |
| `components/job-board.tsx` | UI, browser polling, filters, device-local bookmarks and direct listing links |
| `integration/JobBoardNavLink.tsx` | Copyable main-platform sidebar link with an outline briefcase icon; supply the verified job board URL |
| `lib/apify.ts` | Server-only retrieval of the latest successful task dataset, cache and failure handling |
| `lib/jobs.ts` | Source-field mapping, URL checks, dates, deduplication and filtering |
| `app/page.tsx` | Dynamic initial feed retrieval |
| `app/api/jobs/route.ts` | Same-origin feed endpoint |
| `app/layout.tsx` | Metadata, favicon and current no-index setting |
| `vercel.json` | Next.js deployment settings |
| `.env.example` | Configuration names with empty credential placeholders |
| `tests/apify-*.test.mjs` | Normalization and feed contract checks |

## Access and decisions to provide

| Required input | Owner | What to supply or decide |
| --- | --- | --- |
| Source repository | Engineering | A Languify-owned repo with appropriate team access |
| Vercel project | Vercel account owner | Access to manage deployments, environment variables and domains |
| Apify account | Apify account owner | Access to the selected actor, saved task, its results and scheduling |
| API credential | Apify owner / engineering | Configure privately as a server-side Vercel secret |
| Main website | Website engineering owner | Access to edit Languify's navigation and release that change |
| Domain DNS | Domain administrator | Access to create the `jobs` record under `languify.in` |
| Job coverage | Product owner | Roles, locations, experience levels, job types and result volume |
| Freshness and spend | Product / account owner | Scrape frequency and an acceptable recurring Apify budget |
| Public URL | Product / engineering | Confirm `jobs.languify.in` or a main-site path |

The current test search is only for Product Manager roles in India. Production collection must cover the agreed roles and locations. Use `APIFY_TASK_ID` for one source or `APIFY_TASK_IDS` for up to five comma-separated task IDs. The plural variable takes priority. One server token must have access to all selected tasks.

### Adding Naukri or another platform

Each platform needs an appropriate Apify actor and its own saved task. No Naukri actor has been selected or connected yet. The existing LinkedIn actor collects LinkedIn listings only. Capture a real sample from every additional actor and map it in `lib/jobs.ts` if its fields differ from these accepted fields:

| Field | Accepted keys / format |
| --- | --- |
| Job title | `title`, `jobTitle`, `positionName`, `position` |
| Company | `companyName`, string `company`, `organizationName`, or `company.name` / `hiringOrganization.name` |
| Original listing URL | Absolute HTTP(S) `jobUrl`, `jobLink`, `link`, or `url`; retain the specific job page |
| Location | `location`, `jobLocation`, `locationName`, `formattedLocation`, or supported address object |
| Posting date | Absolute ISO date in `postedAt`, `publishedAt`, `publishedDate`, `datePosted`, `postedTime`, or milliseconds in `postedAtTimestamp` |
| Description | `descriptionText`, `description`, `jobDescription`, `descriptionHtml` |

Title, company, and a valid listing/application URL are required. Missing optional fields remain unknown. Source names are inferred from the original link's hostname. **View job** uses the original listing URL; the details drawer can use an employer application link. Relative URLs and relative dates from a new actor need a source-specific conversion before enabling that task. Successful synthetic Naukri link checks do not establish compatibility with an unselected Naukri actor.

## Configure Apify

1. Open [`curious_coder/linkedin-jobs-scraper`](https://apify.com/curious_coder/linkedin-jobs-scraper) in the owner's Apify account and save the agreed input as a task named **Languify Jobs**. See [Apify tasks](https://docs.apify.com/actors/running/tasks).
2. Capture that saved task's ID and URL. The actor name and a downloaded JSON file do not identify an automatically updating task feed.
3. Complete a successful run **of the saved task**. The prior manual actor run does not establish that the new task has a successful run.
4. Configure the task's recurring schedule in Apify and enable it. Apify documents that new schedules start disabled. See [Apify scheduling](https://docs.apify.com/actors/running/schedules).
5. Use the approved scrape interval and result limit. The prior 20-result run was a connection test, not an agreed production coverage or cost limit.
6. Repeat for each additional platform. Each saved task must have a successful run and an enabled schedule before it is added to `APIFY_TASK_IDS`.

The owner's test input was:

```json
{
  "urls": [],
  "keywords": "Product Manager",
  "location": "India",
  "datePosted": "pastMonth",
  "limitPerSource": 20,
  "scrapeCompany": false,
  "splitByLocation": false
}
```

The dashboard replaces the feed with the newest successful snapshot; it does not accumulate earlier runs. To retain a rolling month, each snapshot should cover that intended window. A scrape of only the last 24 hours would replace the older results.

## Configure and deploy to Vercel

The source includes both the existing Sites review pipeline and a Next.js pipeline for Vercel. **Use the Vercel commands below.**

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Project root | Folder containing `package.json` and `vercel.json` |
| Node.js | A version satisfying `package.json`: `>=22.13.0` |
| Install command | `npm ci` |
| Build command | `npm run build:vercel` |
| Output directory | `.next` |
| Local development | `npm run dev:vercel` |
| Focused checks | `npm run test:apify` |

The locked application uses Next.js 16.2.6 and React 19.2.6. The default `npm run build` is the Sites/Vinext pipeline; Vercel's override is already in `vercel.json`. Upload source or connect the repo; do not upload the Sites build as a Vercel build.

Set these environment variables for Preview and Production as appropriate, then redeploy:

| Variable | Value | Required for automatic updates? |
| --- | --- | --- |
| `APIFY_TOKEN` | Private token able to read the task/run/dataset; mark Sensitive | Yes |
| `APIFY_TASK_ID` | One saved task ID, not the full console URL | Use this or `APIFY_TASK_IDS` |
| `APIFY_TASK_IDS` | Comma-separated saved task IDs, up to five; takes priority over `APIFY_TASK_ID` | Use for multiple platforms |
| `DEMO_MODE` | `false` | Set explicitly for live-data verification |
| `APIFY_DATASET_ID` | Optional fixed dataset ID; leave unset for normal task mode | No |

Store the token only on the server, without a `NEXT_PUBLIC_` prefix. Share access or use the team's secret manager rather than circulating the token in a handover document. See [Vercel sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables). A fixed dataset ID cannot follow future runs that create different datasets; task mode takes priority when both are supplied.

**Failed deployment:** [Deployment inspector](https://vercel.com/product-8646/languify-jobboard/Adt2eC7kdVhcD3k61EYAT4pi4xKC)

Deployment `dpl_Adt2eC7kdVhcD3k61EYAT4pi4xKC` was submitted on 9 September. Its status on 5 October is **ERROR**, with code `module_not_found` and message `Command "npm run build:vercel" exited with 1`. Vercel reports its target as production. Project ID: `prj_ZRdkNztPx4V8U7OiThIKKjJGbZ79`, name: `languify-jobboard`, scope: `product-8646`. The current connection can read this status but receives a 403 when requesting build logs; it lists no accessible teams. There is no verified working Vercel URL to add to the main platform yet.

A fresh deployment of the complete updated source was attempted on 6 October against this same project. Vercel rejected creation with **403 Forbidden** and stated that the connection must re-authenticate with access to scope `product-8646`. This attempt did not create a new deployment. Restore access through the Vercel connection using an account authorized for this workspace, then deploy the current source and inspect its terminal state. The old remote build's exact missing module remains unestablished; this package does not claim to fix that historical failure.

On 6 October, dependency installation completed successfully and the updated application passed `npm run build:vercel` (including TypeScript), the Sites build, and all thirteen `npm run test:apify` checks. The project environment-variable list was empty, including no hidden production variables. No Apify token or saved task ID is configured. Production suppresses demo fallback. Live API retrieval and hosted browser acceptance cannot be completed until account access and configuration are supplied.

## Connect the main Languify website

For the proposed subdomain, add `jobs.languify.in` in the Vercel project's domain settings. The DNS administrator should use the exact project-specific CNAME value Vercel displays, then confirm domain verification and HTTPS. See [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Once the deployed live feed is verified, add this link between **Interview wizard** and **Bookmarks** in the main platform's sidebar, reusing its existing link classes:

```html
<a href="https://jobs.languify.in/">Job Board</a>
```

For a React integration, copy `integration/JobBoardNavLink.tsx` into the main platform and pass the verified production URL as `href` and the existing sidebar link style as `className`. It uses a normal anchor so clicking navigates to the separately hosted board in the same tab. Include it in the platform's mobile navigation too. This example is not mounted in the job board itself and does not change the main platform remotely.

The main platform supplies Languify's surrounding navigation and logo. The job board has no duplicate logo, Case Master AI promotion, Powered by footer, or **Back to Languify** header button. If the team selects `languify.in/jobs`, assess the main host's routing and the application's root-relative API and asset URLs; a subpath integration needs its own routing validation. No iframe is required for a separate domain link.

The current app has no Languify account or SSO integration. Saved jobs are local to a browser and show only listings still present in the current feed. Any account-based access or cross-device saved jobs would be additional work.

## Refresh behavior and practical limits

- The initial page reads the latest successful task run. The browser polls every 60 seconds while visible; the server uses a 30-second in-memory cache. Typical freshness is the scrape interval, plus scrape duration, plus up to roughly 90 seconds and request time for an already-open page. This is near-real-time polling of collected results.
- No Vercel cron or webhook is required for this implementation; collection is scheduled in Apify. More website visitors do not launch more paid scrapes.
- `/api/jobs` returns `Cache-Control: no-store`; live/demo responses are 200, and unavailable/error responses are 503. Confirm `mode: "live"`, not just HTTP 200.
- Retrieval is bounded to 1,000 raw records divided equally across the configured tasks (rounded down per task), at most 100 per request, one shared 20-second timeout and 4 MB per response. For two sources this is 500 records each; for three it is 333 each. It deduplicates canonical listing URLs across sources and drops explicitly expired/closed records. It does not merge different platforms' URLs for the same vacancy or independently verify that every posting still accepts applicants.
- A failing task does not prevent healthy tasks from updating. A warm instance can keep that task's last successful snapshot for one hour; repeated failures do not reset this limit. Partial feeds are marked delayed. If no source can be read and none has a usable cached snapshot, the endpoint returns an error rather than sample results.
- The displayed update timestamp is the oldest available source timestamp; it does not let one fresh task conceal another delayed task. Unknown timestamps are marked delayed.
- A source timestamp older than one hour is labelled stale. Reconcile this threshold with the agreed scrape schedule.
- Refresh failures preserve results in an already-open page; a warm server can retain its last good feed for up to an hour. There is no durable backup store across cold starts and no historical job database. Persistent availability/history would need additional storage.
- Sample listings do not replace a failed live feed. Missing structured salaries and dates stay unknown.

## Launch acceptance

Engineering should complete these checks before enabling the main-site link:

1. The Vercel deployment is READY, and `/api/jobs` returns `mode: "live"` with the intended tasks' normalized results, including each configured platform.
2. After a later successful run of each saved task, a new dataset reaches an open page without uploading JSON or redeploying.
3. Several **View job** buttons open the matching original posting, including after refreshing, filtering and pagination.
4. Search, date/category filters, grid/list views, mobile layout and local bookmarks work with actual production data. No browser QA was performed in this session.
5. An unavailable source or missing configuration produces the documented unavailable/stale state and does not expose credentials or invent live results.
6. **Job Board** appears in the correct place in the main sidebar and mobile navigation; its verified domain and HTTPS work. The removed **Back to Languify** button is absent.
7. Review `robots: { index: false, follow: false }` in `app/layout.tsx` for the production indexing decision; it currently prevents normal search indexing.

The product owner supplies coverage, freshness, budget and URL decisions. Engineering can create the saved task, configure credentials, set up the schedule, deploy, and complete the website integration with the access above. The product owner does not need to finish the Apify setup before handing over this package.
