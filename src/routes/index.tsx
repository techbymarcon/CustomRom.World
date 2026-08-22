import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EditableImage, EditableText } from "@/components/Editable";
import { MainMenu } from "@/components/MainMenu";
import logoAsset from "@/assets/evo-logo.png.asset.json";
import wordmarkAsset from "@/assets/customrom-world-menu.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Custom Rom World: Find your new Rom!" },
      {
        name: "description",
        content:
          "Customrom.world Is a community driven archive for Custom Roms of all types and of different devices. We aspire to be the biggest Custom Rom archive and an active thread for who's interested!",
      },
      { property: "og:title", content: "Custom Rom World: Find your new Rom!" },
      {
        property: "og:description",
        content:
          "Customrom.world Is a community driven archive for Custom Roms of all types and of different devices. We aspire to be the biggest Custom Rom archive and an active thread for who's interested!",
      },
    ],
  }),
  component: Index,
});

function useScrollProgress() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return y;
}

function Fog() {
  const y = useScrollProgress();
  const hueShift = y * 0.35;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="fog-layer"
        style={{
          background:
            "radial-gradient(45% 35% at 55% 30%, var(--fog-a), transparent 70%)",
          transform: `translate3d(${Math.sin(y / 260) * 60}px, ${y * -0.18}px, 0) scale(${1 + y / 3000})`,
          filter: `blur(70px) hue-rotate(${hueShift}deg)`,
          opacity: 0.4,
        }}
      />
      <div
        className="fog-layer"
        style={{
          background:
            "radial-gradient(50% 40% at 40% 65%, var(--fog-b), transparent 70%)",
          transform: `translate3d(${Math.cos(y / 300) * -80}px, ${y * -0.32}px, 0) scale(${1 + y / 2200})`,
          filter: `blur(90px) hue-rotate(${-hueShift * 1.4}deg)`,
          opacity: 0.38,
        }}
      />
      <div
        className="fog-layer"
        style={{
          background:
            "radial-gradient(40% 30% at 70% 90%, var(--fog-a), transparent 75%)",
          transform: `translate3d(${Math.sin(y / 180) * 100}px, ${y * -0.1}px, 0)`,
          filter: `blur(100px) hue-rotate(${hueShift * 2}deg)`,
          opacity: 0.28,
        }}
      />
    </div>
  );
}

function Index() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />

      <header className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 pt-8 sm:flex sm:flex-wrap sm:justify-between">
        <EditableImage
          contentKey="header.logo"
          defaultSrc={logoAsset.url}
          defaultWidth={88}
          alt="Evolution X logo"
          className="max-w-[24vw] sm:max-w-[6rem] md:max-w-[7rem]"
        />
        <MainMenu />
      </header>

      <main className="relative z-10">
        <section className="px-6 pt-10 text-center">
          <h1 className="animate-fade-in text-5xl font-extrabold leading-[1.05] tracking-tight">
            <EditableText
              contentKey="hero.title.accent"
              defaultValue="Custom Romming"
              defaultColor="oklch(0.55 0.24 264)"
            />{" "}
            <EditableText contentKey="hero.title.rest" defaultValue="made simple" />
          </h1>

          <p className="mt-4 text-xl leading-snug text-foreground/90">
            <EditableText
              contentKey="hero.subtitle"
              defaultValue="find the perfect Rom for your device"
            />
          </p>

          <div className="mt-8 flex animate-fade-in justify-center">
            <EditableImage
              contentKey="hero.wordmark"
              defaultSrc={wordmarkAsset.url}
              defaultWidth={520}
              alt="CustomRom.world by techbymarcon"
              className="max-w-[86vw] sm:max-w-[32rem]"
            />
          </div>

        </section>

        <section id="about" className="px-5 pb-24 pt-24">
          <div className="rounded-4xl border-2 border-primary bg-card/70 px-7 py-12 backdrop-blur-md">
            <h2 className="text-4xl font-extrabold leading-tight">
              <EditableText
                contentKey="about.heading.accent"
                defaultValue="About"
                defaultColor="oklch(0.55 0.24 264)"
              />
              <br />
              <EditableText contentKey="about.heading.rest" defaultValue="Evolution X" />
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-foreground/90">
              <EditableText
                contentKey="about.body"
                defaultValue="Evolution X is a custom Android ROM focused on a clean Pixel experience, paired with deep customization. It brings the look and feel of Google Pixel devices to a wide range of hardware, with extra features that let you shape every part of your interface."
              />
            </p>
          </div>
        </section>

        <section id="devices" className="px-5 pb-24">
          <div className="rounded-4xl border-2 border-primary bg-card/70 px-7 py-12 backdrop-blur-md">
            <h2 className="text-4xl font-extrabold leading-tight">
              <EditableText
                contentKey="devices.heading.accent"
                defaultValue="Browse"
                defaultColor="oklch(0.55 0.24 264)"
              />
              <br />
              <EditableText contentKey="devices.heading.rest" defaultValue="Devices" />
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-foreground/90">
              <EditableText
                contentKey="devices.body"
                defaultValue="Custom ROM builds are organised by device, so you can find exactly what fits your phone. Each device page collects the available ROMs, their Android version and the maintainer behind the build."
              />
            </p>
            <ul className="mt-8 grid gap-3 text-lg text-foreground/90">
              <li className="rounded-2xl border border-primary/40 bg-background/30 px-5 py-4">
                <EditableText contentKey="devices.item.1" defaultValue="Google Pixel series" />
              </li>
              <li className="rounded-2xl border border-primary/40 bg-background/30 px-5 py-4">
                <EditableText contentKey="devices.item.2" defaultValue="Xiaomi, Redmi and POCO" />
              </li>
              <li className="rounded-2xl border border-primary/40 bg-background/30 px-5 py-4">
                <EditableText contentKey="devices.item.3" defaultValue="OnePlus, Samsung and more" />
              </li>
            </ul>
          </div>
        </section>

        <section id="features" className="px-5 pb-24">
          <div className="rounded-4xl border-2 border-primary bg-card/70 px-7 py-12 backdrop-blur-md">
            <h2 className="text-4xl font-extrabold leading-tight">
              <EditableText
                contentKey="features.heading.accent"
                defaultValue="Explore"
                defaultColor="oklch(0.55 0.24 264)"
              />
              <br />
              <EditableText contentKey="features.heading.rest" defaultValue="Features" />
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-foreground/90">
              <EditableText
                contentKey="features.body"
                defaultValue="Custom ROMs go far beyond stock Android. Here is what most of the builds archived here bring to your device."
              />
            </p>
            <ul className="mt-8 grid gap-3 text-lg text-foreground/90">
              <li className="rounded-2xl border border-primary/40 bg-background/30 px-5 py-4">
                <EditableText
                  contentKey="features.item.1"
                  defaultValue="Deep theming: colours, fonts, icons and lock screen layouts"
                />
              </li>
              <li className="rounded-2xl border border-primary/40 bg-background/30 px-5 py-4">
                <EditableText
                  contentKey="features.item.2"
                  defaultValue="Newer Android versions on devices left behind by the manufacturer"
                />
              </li>
              <li className="rounded-2xl border border-primary/40 bg-background/30 px-5 py-4">
                <EditableText
                  contentKey="features.item.3"
                  defaultValue="Less bloat, better battery life and finer control over performance"
                />
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
