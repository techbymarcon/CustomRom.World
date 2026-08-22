import logoAsset from "@/assets/evo-logo.png.asset.json";

export function EvoLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Evolution X logo"
      className={`w-auto object-contain ${className}`}
    />
  );
}
