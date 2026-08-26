import { useEffect, useRef, useState } from "react";
import { Bold, Italic, ImagePlus, Underline, Type } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { STORAGE_PREFIX } from "@/lib/rich-html";

const COLORS = ["#ffffff", "#4da3ff", "#8b5cf6", "#22c55e", "#f97316", "#ef4444", "#facc15"];
const SIZES: { label: string; value: string }[] = [
  { label: "S", value: "2" },
  { label: "M", value: "4" },
  { label: "L", value: "5" },
  { label: "XL", value: "6" },
  { label: "XXL", value: "7" },
];

function cmd(command: string, value?: string) {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand(command, false, value);
}

export function RichEditor({
  value,
  onChange,
  allowImages = false,
  placeholder = "Write your article…",
}: {
  value: string;
  onChange: (html: string) => void;
  allowImages?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = () => onChange(ref.current?.innerHTML ?? "");

  const btn =
    "rounded-lg border border-input px-2.5 py-1.5 text-xs font-bold hover:bg-primary/15 active:scale-95 transition";

  async function uploadImage(file: File) {
    setBusy(true);
    const path = `body/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
    const up = await supabase.storage.from("article-images").upload(path, file, { upsert: true });
    if (up.error) {
      toast.error("Couldn't upload that image");
    } else {
      const signed = await supabase.storage.from("article-images").createSignedUrl(path, 3600);
      ref.current?.focus();
      cmd("insertHTML", `<img src="${signed.data?.signedUrl ?? ""}" data-path="${path}" alt="" style="max-width: 100%" /><br />`);
      // Store a stable reference so the image keeps working after the signed url expires.
      const html = (ref.current?.innerHTML ?? "").replace(
        new RegExp(`src="[^"]*"(\\s+data-path="${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}")`, "g"),
        `src="${STORAGE_PREFIX}${path}"$1`,
      );
      if (ref.current) ref.current.innerHTML = html;
      onChange(html);
      toast.success("Image added");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-input bg-background/60">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-input p-2">
        <button type="button" className={btn} onClick={() => cmd("bold")} aria-label="Bold">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={btn} onClick={() => cmd("italic")} aria-label="Italic">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => cmd("underline")}
          aria-label="Underline"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <span className="mx-1 flex items-center gap-1 text-muted-foreground">
          <Type className="h-3.5 w-3.5" />
        </span>
        {SIZES.map((size) => (
          <button
            key={size.value}
            type="button"
            className={btn}
            onClick={() => cmd("fontSize", size.value)}
          >
            {size.label}
          </button>
        ))}
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Colour ${color}`}
            onClick={() => cmd("foreColor", color)}
            className="h-6 w-6 rounded-full border border-input"
            style={{ background: color }}
          />
        ))}
        {allowImages && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              className={`${btn} flex items-center gap-1 disabled:opacity-60`}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {busy ? "Uploading…" : "Image"}
            </button>
          </>
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={push}
        onBlur={push}
        data-placeholder={placeholder}
        className="rich-body min-h-40 w-full p-3 text-left text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
