import { sanitizeRichHtml } from "@/lib/rich-html";

export function RichContent({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`rich-body ${className}`}
      // Content is admin-authored and sanitized against a strict tag allowlist.
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
    />
  );
}
