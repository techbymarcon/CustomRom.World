const DOTS = [
  { left: 8, size: 4, delay: 0, dur: 2.0 },
  { left: 18, size: 6, delay: 0.6, dur: 2.4 },
  { left: 28, size: 3, delay: 1.1, dur: 1.8 },
  { left: 40, size: 5, delay: 0.3, dur: 2.2 },
  { left: 52, size: 4, delay: 1.4, dur: 2.0 },
  { left: 64, size: 6, delay: 0.8, dur: 2.6 },
  { left: 76, size: 3, delay: 0.2, dur: 1.9 },
  { left: 88, size: 5, delay: 1.0, dur: 2.3 },
];

export function RomButtonParticles({ tone }: { tone: "16" | "17" }) {
  const bg = tone === "17" ? "bg-android-17/70" : "bg-android-16/70";

  return (
    <div className="pointer-events-none absolute inset-0">
      {DOTS.map((d, i) => (
        <span
          key={i}
          className={`particle-rise absolute ${bg}`}
          style={{
            left: `${d.left}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
