/** The approved homepage pulse and wordmark. */
export function BrandMark() {
  return <span className="care-brand-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h5l3-7 4 14 3-7h5" />
    </svg>
  </span>;
}
export function BrandIdentity() {
  return <span className="care-brand" lang="en" dir="ltr">
    <BrandMark /><span className="care-wordmark">ChronicCare AI</span>
  </span>;
}
