import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AndroidCover, RomCover } from "@/components/AndroidCover";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { useSite } from "@/lib/site";
import { createRom, deleteRom, listRoms } from "@/lib/roms.functions";
import { ANDROID_VERSIONS, ROM_NAMES, slugify } from "@/lib/roms";

export const Route = createFileRoute("/devices_/samsung_/$model")({
  head: () => ({
    meta: [
      { title: "Samsung device ROMs — Custom Rom World" },
      {
        name: "description",
        content:
          "Every custom ROM archived for this Samsung Galaxy model, with Android version, download link and installation guide.",
      },
      { property: "og:title", content: "Samsung device ROMs — Custom Rom World" },
      {
        property: "og:description",
        content: "Browse the custom ROMs archived for this Samsung Galaxy model.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Samsung device ROMs — Custom Rom World" },
      {
        name: "twitter:description",
        content: "Browse the custom ROMs archived for this Samsung Galaxy model.",
      },
    ],
  }),
  component: ModelPage,
});

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) =>
      part === "plus" ? "+" : part.length <= 2 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1),
    )
    .join(" ")
    .replace(/ \+/g, "+");
}

function ModelPage() {
  const { model } = Route.useParams();
  const deviceName = titleFromSlug(model);
  const { isAdmin } = useSite();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const romsQuery = useQuery({
    queryKey: ["roms", "samsung", model],
    queryFn: () => listRoms({ data: { brand: "samsung", device_slug: model } }),
  });

  const removeFn = useServerFn(deleteRom);
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("ROM page deleted");
      await queryClient.invalidateQueries({ queryKey: ["roms", "samsung", model] });
    },
  });

  const roms = romsQuery.data?.roms ?? [];

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pb-20 pt-10">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="text-primary">{deviceName}</span> ROMs
          </h1>
          <p className="mt-4 text-lg text-foreground/90">
            pick a rom page to see downloads, guides and details.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/devices/samsung"
              className="inline-block rounded-full border-2 border-primary bg-background/40 px-4 py-2 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              ← All Samsung models
            </Link>
            {isAdmin && (
              <button
                onClick={() => setOpen(true)}
                className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                + New ROM page
              </button>
            )}
          </div>

          <div className="mt-10 grid gap-4">
            {romsQuery.isLoading && <p className="text-muted-foreground">Loading ROMs…</p>}
            {!romsQuery.isLoading && roms.length === 0 && (
              <p className="rounded-3xl border-2 border-primary/50 bg-background/40 p-6 text-muted-foreground backdrop-blur-sm">
                No ROMs archived for this device yet.
              </p>
            )}
            {roms.map((rom) => (
              <div
                key={rom.id}
                className="flex items-center justify-between gap-3 rounded-3xl border-2 border-primary bg-background/40 p-4 text-left backdrop-blur-sm"
              >
                <Link
                  to="/devices/samsung/$model/$rom"
                  params={{ model, rom: rom.slug }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-lg font-bold">{rom.rom_name}</p>
                  <p className="mt-1 text-sm text-primary">{rom.android_version}</p>
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => remove.mutate(rom.id)}
                    className="rounded-full border border-destructive px-3 py-1.5 text-xs font-bold text-destructive"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {open && (
        <RomForm
          model={model}
          deviceName={deviceName}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["roms", "samsung", model] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function RomForm({
  model,
  deviceName,
  onClose,
  onSaved,
}: {
  model: string;
  deviceName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createFn = useServerFn(createRom);
  const navigate = useNavigate();
  const [romName, setRomName] = useState<string>(ROM_NAMES[0]!);
  const [version, setVersion] = useState<string>(ANDROID_VERSIONS[ANDROID_VERSIONS.length - 1]!);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [madeBy, setMadeBy] = useState("");
  const [foundOn, setFoundOn] = useState("");
  const [guide, setGuide] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!downloadUrl.trim() || !madeBy.trim() || !foundOn.trim()) {
      toast.error("Download link, Made by and Found on are required.");
      return;
    }
    setSaving(true);
    const slug = slugify(`${romName}-${version}`);
    const res = await createFn({
      data: {
        brand: "samsung",
        device_slug: model,
        device_name: deviceName,
        slug,
        rom_name: romName,
        android_version: version,
        download_url: downloadUrl.trim(),
        made_by: madeBy.trim(),
        found_on: foundOn.trim(),
        installation_guide: guide.trim() || null,
        additional_info: extra.trim() || null,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.includes("duplicate") ? "That ROM page already exists." : res.error);
      return;
    }
    toast.success("ROM page published");
    onSaved();
    void navigate({ to: "/devices/samsung/$model/$rom", params: { model, rom: slug } });
  };

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-scale-in rounded-3xl border-2 border-primary bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">New ROM page — {deviceName}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        <div className="grid gap-4 text-left">
          <label className="text-sm font-bold">
            ROM tag
            <select
              value={romName}
              onChange={(e) => setRomName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            >
              {ROM_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-bold">
            Android version tag
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            >
              {ANDROID_VERSIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <RomCover romName={romName} />
            <AndroidCover version={version} />
          </div>

          <Field label="Download link" value={downloadUrl} onChange={setDownloadUrl} />
          <Field label="Made by" value={madeBy} onChange={setMadeBy} />
          <Field label="Found on" value={foundOn} onChange={setFoundOn} />

          <label className="text-sm font-bold">
            Installation guide
            <textarea
              value={guide}
              onChange={(e) => setGuide(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            />
          </label>

          <label className="text-sm font-bold">
            Additional info
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            />
          </label>

          <button
            disabled={saving}
            onClick={submit}
            className="rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Publishing…" : "Publish ROM page"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
      />
    </label>
  );
}
