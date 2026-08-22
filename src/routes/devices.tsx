import { createFileRoute } from "@tanstack/react-router";

import { EditableText } from "@/components/Editable";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";

const BRANDS = [
  "Google Pixel",
  "Samsung",
  "Sony",
  "Motorola",
  "Poco",
  "Xiaomi",
  "Redmi",
  "OnePlus",
  "Nothing",
  "Asus",
];

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Devices by Brand — Custom Rom World" },
      {
        name: "description",
        content:
          "Pick your phone brand — Pixel, Samsung, Xiaomi, OnePlus and more — and browse the devices and custom ROMs archived on Custom Rom World.",
      },
      { property: "og:title", content: "Devices by Brand — Custom Rom World" },
      {
        property: "og:description",
        content:
          "Pick your phone brand — Pixel, Samsung, Xiaomi, OnePlus and more — and browse the devices and custom ROMs archived on Custom Rom World.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://customrom.world/devices" },
      { name: "twitter:title", content: "Devices by Brand — Custom Rom World" },
      {
        name: "twitter:description",
        content: "Choose your phone brand and see the available devices and their custom ROMs.",
      },
    ],
    links: [{ rel: "canonical", href: "https://customrom.world/devices" }],
  }),

  component: DevicesPage,
});

function DevicesPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pt-10">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <EditableText contentKey="devices.title.prefix" defaultValue="What " as="span" />
            <span className="text-primary">
              <EditableText contentKey="devices.title.brand" defaultValue="brand" as="span" />
            </span>
            <EditableText contentKey="devices.title.middle" defaultValue=" is your " as="span" />
            <span className="text-primary">
              <EditableText contentKey="devices.title.device" defaultValue="device" as="span" />
            </span>
            <EditableText contentKey="devices.title.suffix" defaultValue="?" as="span" />
          </h1>

          <p className="mt-4 text-lg text-foreground/90 sm:text-xl">
            <EditableText
              contentKey="devices.subtitle"
              defaultValue="pick your brand and see the available devices and their roms."
              as="span"
            />
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {BRANDS.map((brand) => (
              <button
                key={brand}
                disabled
                className="rounded-full border-2 border-primary bg-background/40 px-4 py-4 text-base font-bold text-foreground backdrop-blur-sm transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
              >
                {brand}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
