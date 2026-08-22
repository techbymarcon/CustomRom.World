import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AndroidCover, RomCover } from "@/components/AndroidCover";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { getRom } from "@/lib/roms.functions";

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
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                <span className="text-primary">{rom.rom_name}</span> for {rom.device_name}
              </h1>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <RomCover romName={rom.rom_name} />
                <AndroidCover version={rom.android_version} />
              </div>

              <a
                href={rom.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block w-full rounded-full bg-primary px-6 py-3 text-base font-extrabold text-primary-foreground"
              >
                Download
              </a>

              <Bubble title="ROM details">
                <ul className="grid gap-1.5">
                  <li>
                    <span className="font-bold">Custom Rom Name:</span> {rom.rom_name}
                  </li>
                  <li>
                    <span className="font-bold">Android Version:</span> {rom.android_version}
                  </li>
                  <li>
                    <span className="font-bold">Made by:</span> {rom.made_by}
                  </li>
                  <li>
                    <span className="font-bold">Found on:</span> {rom.found_on}
                  </li>
                </ul>
              </Bubble>

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
