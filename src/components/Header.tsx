import { EditableImage } from "@/components/Editable";
import { MainMenu } from "@/components/MainMenu";
import logoAsset from "@/assets/evo-logo.png.asset.json";

export function Header() {
  return (
    <header className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 pt-8 sm:flex sm:flex-wrap sm:justify-between">
      <EditableImage
        contentKey="header.logo"
        defaultSrc={logoAsset.url}
        defaultWidth={88}
        alt="Custom Rom World logo"
        className="max-w-[24vw] sm:max-w-[6rem] md:max-w-[7rem]"
      />
      <MainMenu />
    </header>
  );
}
