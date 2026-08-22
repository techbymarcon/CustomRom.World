import logoAsset from "@/assets/customrom-world-menu.png.asset.json";

export function EvoLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="CustomRom.world logo"
      className={`w-auto object-contain ${className}`}
    />
  );
}
