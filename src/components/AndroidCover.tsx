import { ANDROID_LOGOS } from "@/lib/roms";

const PARTICLES = [
  { left: 6, size: 5, delay: 0, dur: 1.6 },
  { left: 14, size: 8, delay: 0.5, dur: 2.1 },
  { left: 22, size: 4, delay: 0.9, dur: 1.4 },
  { left: 30, size: 7, delay: 0.2, dur: 1.9 },
  { left: 38, size: 5, delay: 1.2, dur: 1.7 },
  { left: 46, size: 9, delay: 0.7, dur: 2.3 },
  { left: 54, size: 4, delay: 0.1, dur: 1.5 },
  { left: 62, size: 6, delay: 1.0, dur: 2.0 },
  { left: 70, size: 5, delay: 0.4, dur: 1.6 },
  { left: 78, size: 8, delay: 1.4, dur: 2.2 },
  { left: 86, size: 4, delay: 0.8, dur: 1.5 },
  { left: 94, size: 6, delay: 0.3, dur: 1.8 },
];

export function AndroidCover({ version }: { version: string }) {
  const logo = ANDROID_LOGOS[version];

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-primary bg-background/50 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle-rise absolute bg-primary/70"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex h-full w-full items-center justify-center p-6">
        {logo ? (
          <img src={logo} alt={`${version} logo`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-center text-xl font-extrabold text-primary">{version}</span>
        )}
      </div>

      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-primary bg-background/70 px-3 py-1 text-xs font-bold tracking-wide">
        {version}
      </span>
    </div>
  );
}

export function RomCover({ romName }: { romName: string }) {
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-primary bg-background/50 p-6 text-center backdrop-blur-sm">
      <span className="text-2xl font-extrabold leading-tight text-primary sm:text-3xl">
        {romName}
      </span>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-primary bg-background/70 px-3 py-1 text-xs font-bold tracking-wide">
        Custom ROM
      </span>
    </div>
  );
}
