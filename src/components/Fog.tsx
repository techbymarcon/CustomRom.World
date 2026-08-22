import { useEffect, useState } from "react";

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

export function Fog() {
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
