import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { useSite } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

function EditorShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-scale-in rounded-3xl border-2 border-primary bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Edit"
      className="absolute -right-2 -top-2 z-20 rounded-full border border-primary bg-card p-1.5 text-primary shadow-lg"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

export function EditableText({
  contentKey,
  defaultValue,
  as: Tag = "span",
  className = "",
  defaultColor,
}: {
  contentKey: string;
  defaultValue: string;
  as?: ElementType;
  className?: string;
  defaultColor?: string;
}) {
  const { content, editMode, save } = useSite();
  const row = content[contentKey];
  const text = row?.text_value ?? defaultValue;
  const color = row?.color ?? defaultColor ?? undefined;

  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [draftColor, setDraftColor] = useState(color ?? "#ffffff");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftText(text);
    setDraftColor(color ?? "#ffffff");
  }, [text, color]);

  const body = (
    <Tag className={className} style={color ? { color } : undefined}>
      {text}
    </Tag>
  );

  if (!editMode) return body;

  return (
    <span className="relative inline-block max-w-full rounded-lg outline-1 outline-dashed outline-primary/60">
      {body}
      <EditBadge onClick={() => setOpen(true)} />
      <EditorShell open={open} onClose={() => setOpen(false)} title="Edit text">
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground"
        />
        <label className="mt-4 flex items-center justify-between text-sm">
          Text colour
          <input
            type="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            className="h-9 w-16 rounded bg-transparent"
          />
        </label>
        <div className="mt-5 flex gap-3">
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await save(contentKey, { text_value: draftText, color: draftColor });
              toast.success("Saved for everyone");
              setSaving(false);
              setOpen(false);
            }}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save for everyone"}
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              await save(contentKey, { text_value: null, color: null });
              toast("Text reset to default");
              setSaving(false);
              setOpen(false);
            }}
            className="rounded-full border border-input px-4 py-2.5 text-sm"
          >
            Reset
          </button>
        </div>
      </EditorShell>
    </span>
  );
}

export function EditableImage({
  contentKey,
  defaultSrc,
  defaultWidth,
  alt,
  className = "",
}: {
  contentKey: string;
  defaultSrc: string;
  defaultWidth: number;
  alt: string;
  className?: string;
}) {
  const { content, editMode, save } = useSite();
  const row = content[contentKey];
  const src = row?.image_url ?? defaultSrc;
  const width = row?.width ?? defaultWidth;

  const [open, setOpen] = useState(false);
  const [draftWidth, setDraftWidth] = useState(width);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraftWidth(width), [width]);

  const img = (
    <img
      src={src}
      alt={alt}
      style={{ width: `min(${width}px, 100%)` }}
      className={`h-auto max-w-full object-contain ${className}`}
    />
  );

  if (!editMode) return img;

  return (
    <span className="relative inline-block rounded-lg outline-1 outline-dashed outline-primary/60">
      {img}
      <EditBadge onClick={() => setOpen(true)} />
      <EditorShell open={open} onClose={() => setOpen(false)} title="Edit image">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="w-full text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            const path = `${contentKey}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
            const upload = await supabase.storage.from("site-images").upload(path, file, {
              upsert: true,
            });
            if (!upload.error) {
              await save(contentKey, { image_url: path });
              toast.success("Image updated for everyone");
            } else {
              toast.error("Upload failed. Try another file.");
            }
            setBusy(false);
            setOpen(false);
          }}
        />
        <label className="mt-5 block text-sm">
          Width: {draftWidth}px
          <input
            type="range"
            min={24}
            max={1200}
            value={draftWidth}
            onChange={(e) => setDraftWidth(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <div className="mt-5 flex gap-3">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await save(contentKey, { width: draftWidth });
              toast.success("Size saved for everyone");
              setBusy(false);
              setOpen(false);
            }}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save for everyone"}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await save(contentKey, { image_url: null, width: null });
              toast("Image reset to default");
              setBusy(false);
              setOpen(false);
            }}
            className="rounded-full border border-input px-4 py-2.5 text-sm"
          >
            Reset
          </button>
        </div>
      </EditorShell>
    </span>
  );
}
