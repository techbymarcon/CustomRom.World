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

          <div className="mt-8 flex flex-col items-center gap-3">
            <a
              href="#devices"
              className="w-full max-w-[19rem] rounded-full border-2 border-primary bg-background/40 py-4 text-lg font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              <EditableText contentKey="cta.devices" defaultValue="Browse Devices" />
            </a>
            <a
              href="#features"
              className="w-full max-w-[19rem] rounded-full border-2 border-primary bg-background/40 py-4 text-lg font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              <EditableText contentKey="cta.features" defaultValue="Explore Features" />
            </a>
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

      </main>
    </div>
  );
}
