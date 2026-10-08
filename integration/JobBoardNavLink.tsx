/**
 * Copy into the MAIN Languify platform's sidebar, between Interview wizard and
 * Bookmarks. Supply the verified production origin and existing sidebar class.
 * This component is a handover example; it does not edit the main platform.
 */
export function JobBoardNavLink({ href, className }: { href: string; className?: string }) {
  return (
    <a href={href} className={className}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a20 20 0 0 0 18 0M12 12v3" />
      </svg>
      <span>Job Board</span>
    </a>
  );
}
