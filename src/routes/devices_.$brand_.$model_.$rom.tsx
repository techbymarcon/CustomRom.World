import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AndroidCover, RomCover } from "@/components/AndroidCover";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { RomComments } from "@/components/RomComments";
import { RomRating } from "@/components/RomRating";

import { getRom } from "@/lib/roms.functions";
import { ROM_TYPE_LABELS } from "@/lib/roms";


export const Route = createFileRoute("/devices_/$brand_/$model_/$rom")({
  head: () => ({
    meta: [
      { title: "Custom ROM page — Custom Rom World" },
      {
        name: "description",
        content:
          "ROM details, download link, installation guide and additional info for this custom ROM.",
      },
      { property: "og:title", content: "Custom ROM page — Custom Rom World" },
      {
        property: "og:description",
        content: "ROM details, download link and installation guide for this device.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Custom ROM page — Custom Rom World" },
      {
        name: "twitter:description",
        content: "ROM details, download link and installation guide for this device.",
      },
    ],
  }),
  component: RomPage,
});

function Bubble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border-2 border-primary bg-background/40 p-5 text-left backdrop-blur-sm">
      <h2 className="text-xl font-extrabold text-primary">{title}</h2>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

function RomPage() {
  const { brand, model, rom: romSlug } = Route.useParams();
  const query = useQuery({
    queryKey: ["rom", brand, model, romSlug],
    queryFn: () => getRom({ data: { brand, device_slug: model, slug: romSlug } }),
  });
  const rom = query.data?.rom ?? null;
  const uploader = query.data?.uploader ?? null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pb-20 pt-10">
        <div className="mx-auto max-w-2xl text-center">
          {query.isLoading && <p className="text-muted-foreground">Loading ROM…</p>}
          {!query.isLoading && !rom && (
            <p className="rounded-3xl border-2 border-primary/50 bg-background/40 p-6 backdrop-blur-sm">
              This ROM page doesn&apos;t exist.
            </p>
          )}

          {rom && (
            <>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="rounded-full border-2 border-primary bg-background/40 px-3 py-1 text-sm font-bold backdrop-blur-sm">
                  {rom.android_version}
                </span>
                <span className="rounded-full border-2 border-primary bg-background/40 px-3 py-1 text-sm font-bold backdrop-blur-sm">
                  {rom.rom_name}
                  {rom.rom_version ? ` ${rom.rom_version}` : ""}
                </span>
                {rom.rom_type && (
                  <span className="rounded-full border-2 border-primary/60 bg-background/40 px-3 py-1 text-sm font-bold backdrop-blur-sm">
                    {ROM_TYPE_LABELS[rom.rom_type]}
                  </span>
                )}
                {rom.official_status && (
                  <span className="rounded-full border-2 border-primary/60 bg-background/40 px-3 py-1 text-sm font-bold capitalize backdrop-blur-sm">
                    {rom.official_status}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                <span className="text-primary">
                  {rom.rom_name}
                  {rom.rom_version ? ` ${rom.rom_version}` : ""}
                </span>{" "}
                for {rom.device_name}
                {rom.codename ? ` (${rom.codename})` : ""}
              </h1>

              {uploader && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-primary/60 bg-background/40 px-3 py-1.5 backdrop-blur-sm">
                  {uploader.avatar_url ? (
                    <img
                      src={uploader.avatar_url}
                      alt={`${uploader.username} profile picture`}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-extrabold uppercase text-primary">
                      {uploader.username.slice(0, 1)}
                    </span>
                  )}
                  <span className="text-sm font-bold">{uploader.username}</span>
                  {uploader.verified && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-primary"
                      aria-label="Verified"
                      role="img"
                    >
                      <path
                        fill="currentColor"
                        d="M12 1.5l2.4 2 3.1-.3 1 3 2.7 1.6-1.1 2.9 1.1 2.9-2.7 1.6-1 3-3.1-.3-2.4 2-2.4-2-3.1.3-1-3L3.8 15.1 4.9 12.2 3.8 9.3 6.5 7.7l1-3 3.1.3z"
                      />
                      <path
                        fill="hsl(var(--background))"
                        d="M10.9 15.4l-3-3 1.3-1.3 1.7 1.7 4-4 1.3 1.3z"
                      />
                    </svg>
                  )}
                </div>
              )}


              <div className="mt-6 grid grid-cols-2 gap-4">
                <RomCover romName={rom.rom_name} />
                <AndroidCover version={rom.android_version} />
              </div>

              {rom.download_url ? (
                <a
                  href={rom.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block w-full rounded-full bg-primary px-6 py-3 text-base font-extrabold text-primary-foreground"
                >
                  Download
                </a>
              ) : rom.source_url ? (
                <a
                  href={rom.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block w-full rounded-full border-2 border-primary bg-background/40 px-6 py-3 text-base font-extrabold backdrop-blur-sm"
                >
                  View downloads on source page
                </a>
              ) : null}

              <Bubble title="ROM details">
                <ul className="grid gap-1.5">
                  <li>
                    <span className="font-bold">Custom Rom Name:</span> {rom.rom_name}
                  </li>
                  <li>
                    <span className="font-bold">ROM Version:</span>{" "}
                    {rom.rom_version ?? "unknown"}
                  </li>
                  <li>
                    <span className="font-bold">Android Version:</span> {rom.android_version}
                  </li>
                  <li>
                    <span className="font-bold">Type:</span>{" "}
                    {rom.rom_type ? ROM_TYPE_LABELS[rom.rom_type] : "unknown"}
                  </li>
                  <li>
                    <span className="font-bold">Codename:</span> {rom.codename ?? "unknown"}
                  </li>
                  <li>
                    <span className="font-bold">Status:</span> {rom.official_status ?? "unknown"}
                  </li>
                  <li>
                    <span className="font-bold">Made by:</span> {rom.made_by}
                  </li>
                  <li>
                    <span className="font-bold">Found on:</span> {rom.found_on}
                  </li>
                  {rom.source_url && (
                    <li className="truncate">
                      <span className="font-bold">Source:</span>{" "}
                      <a
                        href={rom.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {rom.source_url}
                      </a>
                    </li>
                  )}
                </ul>
              </Bubble>

              <RomRating romId={rom.id} />

              <RomComments romId={rom.id} />





              {rom.installation_guide && (
                <Bubble title="Installation Guide">{rom.installation_guide}</Bubble>
              )}
              {rom.additional_info && (
                <Bubble title="Additional Info">{rom.additional_info}</Bubble>
              )}
            </>
          )}

          <div className="mt-8">
            <Link
              to="/devices/$brand/$model"
              params={{ brand, model }}
              className="inline-block rounded-full border-2 border-primary bg-background/40 px-4 py-2 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              ← Back to device
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
