export function AdminExpandChevron({ open }: { open: boolean }) {
  return (
    <span className="trends-models-chevron" aria-hidden>
      <span className="trends-models-chevron-label">
        {open ? "Collapse" : "Expand"}
      </span>
      <svg
        className="trends-models-chevron-icon"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {open ? <path d="M3 10.5 8 5.5l5 5" /> : <path d="M3 5.5 8 10.5l5-5" />}
      </svg>
    </span>
  );
}
