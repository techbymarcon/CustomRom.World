/**
 * Tiny allowlist sanitizer for admin-authored article HTML.
 * Runs without a DOM so it can be used on the server before storing content.
 */

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "p",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "figure",
  "font",
]);

const VOID_TAGS = new Set(["br", "img"]);

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "font-family",
  "width",
  "max-width",
]);

export const STORAGE_PREFIX = "storage://";

function safeUrl(value: string) {
  const v = value.trim();
  if (v.startsWith(STORAGE_PREFIX)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) return v;
  return null;
}

function sanitizeStyle(value: string) {
  const parts: string[] = [];
  for (const decl of value.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/url\(|expression|javascript:/i.test(val)) continue;
    parts.push(`${prop}: ${val}`);
  }
  return parts.join("; ");
}

function sanitizeAttrs(tag: string, raw: string) {
  const out: string[] = [];
  const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(raw))) {
    const name = m[1]!.toLowerCase();
    const value = m[3] ?? m[4] ?? "";
    if (name === "style") {
      const style = sanitizeStyle(value);
      if (style) out.push(`style="${style}"`);
    } else if (name === "color" && tag === "font") {
      if (/^[#\w(),.%\s-]+$/.test(value)) out.push(`color="${value}"`);
    } else if (name === "size" && tag === "font") {
      if (/^\d+$/.test(value)) out.push(`size="${value}"`);
    } else if (name === "alt") {
      out.push(`alt="${value.replace(/"/g, "&quot;")}"`);
    } else if (name === "src" && tag === "img") {
      const url = safeUrl(value);
      if (url) out.push(`src="${url.replace(/"/g, "&quot;")}"`);
    } else if (name === "href" && tag === "a") {
      const url = safeUrl(value);
      if (url) out.push(`href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer"`);
    }
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

export function sanitizeRichHtml(input: string): string {
  if (!input) return "";
  let html = input.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "");

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_all, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const closing = /^<\s*\//.test(_all as string);
    if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    const attrs = sanitizeAttrs(tag, String(rawAttrs ?? ""));
    return VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
  });
}

/** Collect the storage paths referenced by storage:// urls inside the html. */
export function storagePathsInHtml(html: string): string[] {
  const paths = new Set<string>();
  const re = new RegExp(`${STORAGE_PREFIX}([^"'\\s>]+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) paths.add(decodeURIComponent(m[1]!));
  return [...paths];
}

/** Replace storage:// urls with resolved (signed) urls. */
export function resolveStorageUrls(html: string, map: Map<string, string>): string {
  const re = new RegExp(`${STORAGE_PREFIX}([^"'\\s>]+)`, "g");
  return html.replace(re, (all, path) => map.get(decodeURIComponent(String(path))) ?? all);
}
