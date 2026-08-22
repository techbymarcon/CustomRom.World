import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EvoLogo } from "@/components/EvoLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Evolution X — Evolve your Android device" },
      {
        name: "description",
        content:
          "Pixel UI, customization and more. Evolution X is a custom Android ROM bringing a clean Pixel experience with deep personalization.",
      },
      { property: "og:title", content: "Evolution X — Evolve your Android device" },
      {
        property: "og:description",
        content: "Pixel UI, customization & more. We are Evolution X.",
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
          opacity: 0.75,
        }}
      />
      <div
        className="fog-layer"
        style={{
          background:
            "radial-gradient(50% 40% at 40% 65%, var(--fog-b), transparent 70%)",
          transform: `translate3d(${Math.cos(y / 300) * -80}px, ${y * -0.32}px, 0) scale(${1 + y / 2200})`,
          filter: `blur(90px) hue-rotate(${-hueShift * 1.4}deg)`,
          opacity: 0.7,
        }}
      />
      <div
        className="fog-layer"
        style={{
          background:
            "radial-gradient(40% 30% at 70% 90%, var(--fog-a), transparent 75%)",
          transform: `translate3d(${Math.sin(y / 180) * 100}px, ${y * -0.1}px, 0)`,
          filter: `blur(100px) hue-rotate(${hueShift * 2}deg)`,
          opacity: 0.5,
        }}
      />
    </div>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <EvoLogo className="h-[0.95em] w-auto -mb-[0.05em] text-foreground" />
      <span className="font-extrabold italic tracking-tight">volution X</span>
    </span>
  );
}

function Index() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />

      <header className="relative z-10 flex items-center justify-between px-6 pt-8">
        <EvoLogo className="h-14 w-auto text-foreground" />
        <button aria-label="Open menu" className="flex flex-col items-end gap-2 p-2">
          <span className="block h-1.5 w-6 rounded-full bg-foreground" />
          <span className="block h-1.5 w-9 rounded-full bg-foreground" />
          <span className="block h-1.5 w-7 rounded-full bg-foreground" />
        </button>
      </header>

      <main className="relative z-10">
        <section className="px-6 pt-24 text-center">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
            <span className="text-primary">Evolve</span> your Android device
          </h1>

          <p className="mt-12 text-xl leading-snug text-foreground/90">
            Pixel UI, Customization &amp; more.
            <br />
            We are
            <br />
            <Wordmark className="mt-1 text-4xl" />
          </p>

          <div className="mt-14 flex flex-col items-center gap-5">
            <a
              href="#devices"
              className="w-full max-w-[19rem] rounded-full border-2 border-primary bg-background/40 py-5 text-lg font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              Browse Devices
            </a>
            <a
              href="#features"
              className="w-full max-w-[19rem] rounded-full border-2 border-primary bg-background/40 py-5 text-lg font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              Explore Features
            </a>
          </div>
        </section>

        <section id="about" className="px-5 pb-24 pt-24">
          <div className="rounded-4xl border-2 border-primary bg-card/70 px-7 py-12 backdrop-blur-md">
            <h2 className="text-4xl font-extrabold leading-tight">
              <span className="text-primary">About</span>
              <br />
              Evolution X
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-foreground/90">
              Evolution X is a custom Android ROM focused on a clean Pixel experience,
              paired with deep customization. It brings the look and feel of Google
              Pixel devices to a wide range of hardware, with extra features that let
              you shape every part of your interface.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
