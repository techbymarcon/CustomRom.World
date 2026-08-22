export function EvoLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 80"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M6 4h52L44 22H22z" />
      <path d="M20 30h38L46 46H30z" />
      <path d="M6 4l16 18v54L6 58z" />
    </svg>
  );
}
