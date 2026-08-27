import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AndroidCover, RomCover } from "@/components/AndroidCover";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { useSite } from "@/lib/site";
import { deviceNameFromSlug, getBrand } from "@/lib/devices";
import { createRom, deleteRom, listRoms } from "@/lib/roms.functions";
import { listDeviceArticles } from "@/lib/articles.functions";
import { ArticleEditor } from "@/components/ArticleEditor";
import { ANDROID_LOGOS, ANDROID_VERSIONS, ROM_NAMES, ROM_TYPE_LABELS } from "@/lib/roms";
import { normalizeRomFamily, romSlug, romTypeForFamily } from "@/lib/rom-import";

import { RomButtonParticles } from "@/components/RomButtonParticles";

export const Route = createFileRoute("/devices_/$brand_/$model")({
  head: () => ({
    meta: [
      { title: "Device ROMs — Custom Rom World" },
      {
        name: "description",
        content:
          "Every custom ROM archived for this device, with Android version, download link and installation guide.",
      },
      { property: "og:title", content: "Device ROMs — Custom Rom World" },
      {
        property: "og:description",
        content: "Browse the custom ROMs archived for this device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Device ROMs — Custom Rom World" },
      {
        name: "twitter:description",
        content: "Browse the custom ROMs archived for this device.",
      },
    ],
  }),
  component: ModelPage,
});

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) =>
      part === "plus"
        ? "+"
        : part.length <= 2
          ? part.toUpperCase()
          : part[0]!.toUpperCase() + part.slice(1),
    )
    .join(" ")
    .replace(/ \+/g, "+");
}

function ModelPage() {
  const { brand, model } = Route.useParams();
  const brandName = getBrand(brand)?.name ?? titleFromSlug(brand);
  const deviceName = deviceNameFromSlug(brand, model) ?? titleFromSlug(model);
  const { isAdmin } = useSite();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);

  const romsQuery = useQuery({
    queryKey: ["roms", brand, model],
    queryFn: () => listRoms({ data: { brand, device_slug: model } }),
  });

  const articlesQuery = useQuery({
    queryKey: ["articles", brand, model],
    queryFn: () => listDeviceArticles({ data: { brand, device_slug: model } }),
  });
  const articles = articlesQuery.data?.articles ?? [];


  const removeFn = useServerFn(deleteRom);
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("ROM page deleted");
      await queryClient.invalidateQueries({ queryKey: ["roms", brand, model] });
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
              to="/devices/$brand"
              params={{ brand }}
              className="inline-block rounded-full border-2 border-primary bg-background/40 px-4 py-2 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              ← All {brandName} models
            </Link>
            {isAdmin && (
              <button
                onClick={() => setOpen(true)}
                className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                + New ROM page
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setArticleOpen(true)}
                className="rounded-full border-2 border-primary px-4 py-2 text-sm font-bold"
              >
                + New article
              </button>
            )}
          </div>

          {articles.length > 0 && (
            <div className="mt-10 grid gap-4">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  to="/articles/$id"
                  params={{ id: article.id }}
                  className="flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-primary bg-background/40 p-4 text-left backdrop-blur-sm transition-transform hover:scale-[1.01]"
                >
                  {article.cover_image_url && (
                    <img
                      src={article.cover_image_url}
                      alt=""
                      className="h-16 w-16 flex-none rounded-2xl object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{article.title}</span>
                    <span className="mt-0.5 block text-xs text-primary">read article</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 grid gap-4">
            {romsQuery.isLoading && <p className="text-muted-foreground">Loading ROMs…</p>}
            {!romsQuery.isLoading && roms.length === 0 && (
              <p className="rounded-3xl border-2 border-primary/50 bg-background/40 p-6 text-muted-foreground backdrop-blur-sm">
                No ROMs archived for this device yet.
              </p>
            )}
            {roms.map((rom) => {
              const highlight =
                rom.android_version === "Android 17"
                  ? ({ label: "powered by Android 17", tone: "17" } as const)
                  : rom.android_version === "Android 16"
                    ? ({ label: "powered by Android 16", tone: "16" } as const)
                    : null;
              const logo = highlight ? ANDROID_LOGOS[rom.android_version] : undefined;
              const toneText = highlight?.tone === "17" ? "text-android-17" : "text-android-16";
              const toneBorder =
                highlight?.tone === "17" ? "border-android-17" : "border-android-16";

              return (
                <div
                  key={rom.id}
                  className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl border-2 bg-background/40 p-4 text-left backdrop-blur-sm ${
                    highlight ? toneBorder : "border-primary"
                  }`}
                >
                  {highlight && <RomButtonParticles tone={highlight.tone} />}

                  {highlight && logo && (
                    <img
                      src={logo}
                      alt={`${rom.android_version} logo`}
                      className="pointer-events-none absolute right-2 top-2 h-10 w-10 object-contain sm:h-12 sm:w-12"
                    />
                  )}

                  <Link
                    to="/devices/$brand/$model/$rom"
                    params={{ brand, model, rom: rom.slug }}
                    className="relative z-10 min-w-0 flex-1 pr-12"
                  >
                    <p className="truncate text-lg font-bold">
                      {rom.rom_name}
                      {rom.rom_version ? ` ${rom.rom_version}` : ""}
                    </p>
                    <p className={`mt-1 text-sm ${highlight ? toneText : "text-primary"}`}>
                      {rom.android_version}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {rom.rom_type ? ROM_TYPE_LABELS[rom.rom_type] : "ROM"}
                      {rom.official_status ? ` · ${rom.official_status}` : ""}
                      {rom.codename ? ` · ${rom.codename}` : ""}
                    </p>
                    {highlight && (
                      <p className={`mt-0.5 text-xs font-bold ${toneText}`}>{highlight.label}</p>
                    )}

                  </Link>
                  {isAdmin && (
                    <button
                      onClick={() => remove.mutate(rom.id)}
                      className="relative z-10 rounded-full border border-destructive px-3 py-1.5 text-xs font-bold text-destructive"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {open && (
        <RomForm
          brand={brand}
          model={model}
          deviceName={deviceName}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["roms", brand, model] });
            setOpen(false);
          }}
        />
      )}

      {articleOpen && (
        <ArticleEditor
          article={null}
          scope="device"
          brand={brand}
          deviceSlug={model}
          title={`New article — ${deviceName}`}
          onClose={() => setArticleOpen(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["articles", brand, model] });
            setArticleOpen(false);
          }}
        />
      )}
    </div>
  );
}

function RomForm({
  brand,
  model,
  deviceName,
  onClose,
  onSaved,
}: {
  brand: string;
  model: string;
  deviceName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createFn = useServerFn(createRom);
  const navigate = useNavigate();
  const [romName, setRomName] = useState<string>(ROM_NAMES[0]!);
  const [version, setVersion] = useState<string>(ANDROID_VERSIONS[ANDROID_VERSIONS.length - 1]!);
  const [romVersion, setRomVersion] = useState("");
  const [codename, setCodename] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [official, setOfficial] = useState<"" | "official" | "unofficial">("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [madeBy, setMadeBy] = useState("");
  const [foundOn, setFoundOn] = useState("");
  const [guide, setGuide] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!madeBy.trim() || !foundOn.trim()) {
      toast.error("Made by and Found on are required.");
      return;
    }
    if (!downloadUrl.trim() && !sourceUrl.trim()) {
      toast.error("Add a download link or at least the source page URL.");
      return;
    }
    setSaving(true);
    const family = normalizeRomFamily(romName) ?? romName;
    const slug = romSlug(family, romVersion.trim() || null, version);
    const res = await createFn({
      data: {
        brand,
        device_slug: model,
        device_name: deviceName,
        codename: codename.trim() || null,
        slug,
        rom_name: romName,
        rom_version: romVersion.trim() || null,
        android_version: version,
        rom_type: normalizeRomFamily(romName)
          ? romTypeForFamily(normalizeRomFamily(romName)!)
          : "aosp",
        source_url: sourceUrl.trim() || null,
        download_url: downloadUrl.trim() || null,
        made_by: madeBy.trim(),
        found_on: foundOn.trim(),
        official_status: official || null,
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
    void navigate({ to: "/devices/$brand/$model/$rom", params: { brand, model, rom: slug } });
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

          <Field
            label="ROM version (e.g. 7.64 — leave blank if unknown)"
            value={romVersion}
            onChange={setRomVersion}
          />
          <Field label="Device codename (optional)" value={codename} onChange={setCodename} />
          <Field label="Source page URL" value={sourceUrl} onChange={setSourceUrl} />
          <Field label="Download link (optional)" value={downloadUrl} onChange={setDownloadUrl} />
          <Field label="Made by" value={madeBy} onChange={setMadeBy} />
          <Field label="Found on" value={foundOn} onChange={setFoundOn} />

          <label className="text-sm font-bold">
            Official status
            <select
              value={official}
              onChange={(e) => setOfficial(e.target.value as typeof official)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            >
              <option value="">unknown</option>
              <option value="official">official</option>
              <option value="unofficial">unofficial</option>
            </select>
          </label>


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
