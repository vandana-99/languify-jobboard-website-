import JobBoard from "@/components/job-board";
import { getJobFeed } from "@/lib/apify";

export const dynamic = "force-dynamic";
export default async function Home() {
  const feed = await getJobFeed();
  return <JobBoard initialFeed={feed} />;
}
