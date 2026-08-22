import { createFileRoute, Link } from "@tanstack/react-router";

import { EditableText } from "@/components/Editable";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";

const SERIES: { title: string; models: string[] }[] = [
  {
    title: "GALAXY S",
    models: [
      "Galaxy S",
      "Galaxy S Plus",
      "Galaxy S2",
      "Galaxy S2 Plus",
      "Galaxy S3",
      "Galaxy S3 Mini",
      "Galaxy S4",
      "Galaxy S4 Mini",
      "Galaxy S4 Active",
      "Galaxy S4 Zoom",
      "Galaxy S5",
      "Galaxy S5 Mini",
      "Galaxy S5 Active",
      "Galaxy S5 Sport",
      "Galaxy S6",
      "Galaxy S6 Edge",
      "Galaxy S6 Edge+",
      "Galaxy S6 Active",
      "Galaxy S7",
      "Galaxy S7 Edge",
      "Galaxy S7 Active",
      "Galaxy S8",
      "Galaxy S8+",
      "Galaxy S8 Active",
      "Galaxy S9",
      "Galaxy S9+",
      "Galaxy S10e",
      "Galaxy S10",
      "Galaxy S10+",
      "Galaxy S10 5G",
      "Galaxy S10 Lite",
      "Galaxy S20",
      "Galaxy S20+",
      "Galaxy S20 Ultra",
      "Galaxy S20 FE",
      "Galaxy S20 FE 5G",
      "Galaxy S21",
      "Galaxy S21+",
      "Galaxy S21 Ultra",
      "Galaxy S21 FE",
      "Galaxy S22",
      "Galaxy S22+",
      "Galaxy S22 Ultra",
      "Galaxy S23",
      "Galaxy S23+",
      "Galaxy S23 Ultra",
      "Galaxy S23 FE",
      "Galaxy S24",
      "Galaxy S24+",
      "Galaxy S24 Ultra",
      "Galaxy S24 FE",
      "Galaxy S25",
      "Galaxy S25+",
      "Galaxy S25 Ultra",
      "Galaxy S25 Edge",
      "Galaxy S25 FE",
      "Galaxy S26",
      "Galaxy S26+",
      "Galaxy S26 Ultra",
    ],
  },
  {
    title: "GALAXY NOTE",
    models: [
      "Galaxy Note",
      "Galaxy Note II",
      "Galaxy Note 3",
      "Galaxy Note 3 Neo",
      "Galaxy Note 4",
      "Galaxy Note Edge",
      "Galaxy Note 5",
      "Galaxy Note 7",
      "Galaxy Note FE",
      "Galaxy Note 8",
      "Galaxy Note 9",
      "Galaxy Note 10",
      "Galaxy Note 10+",
      "Galaxy Note 10+ 5G",
      "Galaxy Note 20",
      "Galaxy Note 20 Ultra",
      "Galaxy Note 20 Ultra 5G",
    ],
  },
  {
    title: "GALAXY Z FOLD",
    models: [
      "Galaxy Fold",
      "Galaxy Z Fold2",
      "Galaxy Z Fold3",
      "Galaxy Z Fold4",
      "Galaxy Z Fold5",
      "Galaxy Z Fold6",
      "Galaxy Z Fold6 Special Edition",
      "Galaxy Z Fold7",
      "Galaxy Z Fold8",
    ],
  },
  {
    title: "GALAXY Z FLIP",
    models: [
      "Galaxy Z Flip",
      "Galaxy Z Flip 5G",
      "Galaxy Z Flip3",
      "Galaxy Z Flip4",
      "Galaxy Z Flip5",
      "Galaxy Z Flip6",
      "Galaxy Z Flip7",
      "Galaxy Z Flip7 FE",
      "Galaxy Z Flip8",
    ],
  },
  {
    title: "GALAXY A",
    models: [
      "Galaxy A3",
      "Galaxy A5",
      "Galaxy A7",
      "Galaxy A8",
      "Galaxy A8+",
      "Galaxy A9",
      "Galaxy A9 Pro",
      "Galaxy A3 (2017)",
      "Galaxy A5 (2017)",
      "Galaxy A7 (2017)",
      "Galaxy A6",
      "Galaxy A6+",
      "Galaxy A8 (2018)",
      "Galaxy A8+ (2018)",
      "Galaxy A8 Star",
      "Galaxy A9 (2018)",
      "Galaxy A10",
      "Galaxy A10e",
      "Galaxy A10s",
      "Galaxy A20",
      "Galaxy A20e",
      "Galaxy A20s",
      "Galaxy A30",
      "Galaxy A30s",
      "Galaxy A40",
      "Galaxy A50",
      "Galaxy A50s",
      "Galaxy A60",
      "Galaxy A70",
      "Galaxy A70s",
      "Galaxy A80",
      "Galaxy A90 5G",
      "Galaxy A01",
      "Galaxy A01 Core",
      "Galaxy A11",
      "Galaxy A21",
      "Galaxy A21s",
      "Galaxy A31",
      "Galaxy A41",
      "Galaxy A51",
      "Galaxy A51 5G",
      "Galaxy A71",
      "Galaxy A71 5G",
      "Galaxy A02",
      "Galaxy A02s",
      "Galaxy A12",
      "Galaxy A22",
      "Galaxy A22 5G",
      "Galaxy A32",
      "Galaxy A32 5G",
      "Galaxy A42 5G",
      "Galaxy A52",
      "Galaxy A52 5G",
      "Galaxy A52s 5G",
      "Galaxy A72",
      "Galaxy A03",
      "Galaxy A03 Core",
      "Galaxy A03s",
      "Galaxy A13",
      "Galaxy A13 5G",
      "Galaxy A23",
      "Galaxy A23 5G",
      "Galaxy A33 5G",
      "Galaxy A53 5G",
      "Galaxy A73 5G",
      "Galaxy A04",
      "Galaxy A04e",
      "Galaxy A04s",
      "Galaxy A14",
      "Galaxy A14 5G",
      "Galaxy A24",
      "Galaxy A34 5G",
      "Galaxy A54 5G",
      "Galaxy A05",
      "Galaxy A05s",
      "Galaxy A15",
      "Galaxy A15 5G",
      "Galaxy A25 5G",
      "Galaxy A16",
      "Galaxy A16 5G",
      "Galaxy A35 5G",
      "Galaxy A55 5G",
      "Galaxy A06",
      "Galaxy A06 5G",
      "Galaxy A26 5G",
      "Galaxy A36 5G",
      "Galaxy A56 5G",
      "Galaxy A07",
      "Galaxy A17",
      "Galaxy A27",
      "Galaxy A37",
      "Galaxy A57",
    ],
  },
];

export const Route = createFileRoute("/devices_/samsung")({
  head: () => ({
    meta: [
      { title: "Samsung Galaxy Devices — Custom Rom World" },
      {
        name: "description",
        content:
          "Browse every Samsung Galaxy device — S, Note, Z Fold, Z Flip and A series — and find the custom ROMs archived on Custom Rom World.",
      },
      { property: "og:title", content: "Samsung Galaxy Devices — Custom Rom World" },
      {
        property: "og:description",
        content:
          "Browse every Samsung Galaxy device — S, Note, Z Fold, Z Flip and A series — and find the custom ROMs archived on Custom Rom World.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://customrom.world/devices/samsung" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Samsung Galaxy Devices — Custom Rom World" },
      {
        name: "twitter:description",
        content: "Pick your Samsung Galaxy model and see the available custom ROMs.",
      },
    ],
    links: [{ rel: "canonical", href: "https://customrom.world/devices/samsung" }],
  }),

  component: SamsungPage,
});

function SamsungPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pb-20 pt-10">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <EditableText contentKey="samsung.title.prefix" defaultValue="Pick your " as="span" />
            <span className="text-primary">
              <EditableText contentKey="samsung.title.brand" defaultValue="Samsung" as="span" />
            </span>
            <EditableText contentKey="samsung.title.suffix" defaultValue=" device" as="span" />
          </h1>

          <p className="mt-4 text-lg text-foreground/90 sm:text-xl">
            <EditableText
              contentKey="samsung.subtitle"
              defaultValue="choose your model and see the available roms."
              as="span"
            />
          </p>

          <div className="mt-6">
            <Link
              to="/devices"
              className="inline-block rounded-full border-2 border-primary bg-background/40 px-4 py-2 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              ← All brands
            </Link>
          </div>

          {SERIES.map((series) => (
            <div key={series.title} className="mt-12">
              <h2 className="text-2xl font-extrabold tracking-widest text-primary">
                {series.title}
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {series.models.map((model) => (
                  <button
                    key={model}
                    disabled
                    className="rounded-full border-2 border-primary bg-background/40 px-3 py-3 text-sm font-bold text-foreground backdrop-blur-sm transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
