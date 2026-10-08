import { getJobFeed } from "@/lib/apify";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET() {
  const feed = await getJobFeed();
  const ok = feed.mode === "live" || feed.mode === "demo";
  return Response.json(feed, {
    status: ok ? 200 : 503,
    headers: {
      // The adapter bounds requests with its short server cache. Avoid another
      // browser/CDN cache delaying fresh task results on Vercel.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
