import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { getBrand } from "@/lib/devices";
import { slugify } from "@/lib/roms";

export const Route = createFileRoute("/devices_/$brand")({
  loader: ({ params }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    return { name: brand.name, slug: brand.slug };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Devices";
    const title = `${name} Devices — Custom Rom World`;
    const description = `Browse every ${name} device archived on Custom Rom World and find the custom ROMs available for it.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
      links: loaderData
        ? [{ rel: "canonical", href: `https://customrom.world/devices/${loaderData.slug}` }]
        : [],
    };
  },
  notFoundComponent: BrandNotFound,
  component: BrandPage,
});

function BrandNotFound() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />
      <main className="relative z-10 px-6 pt-16 text-center">
        <h1 className="text-3xl font-extrabold">Brand not found</h1>
        <Link
          to="/devices"
          className="mt-6 inline-block rounded-full border-2 border-primary bg-background/40 px-4 py-2 text-sm font-bold backdrop-blur-sm"
        >
          ← All brands
        </Link>
      </main>
    </div>
  );
}

function BrandPage() {
  const { brand: brandSlug } = Route.useParams();
  const brand = getBrand(brandSlug)!;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pb-20 pt-10">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Pick your <span className="text-primary">{brand.name}</span> device
          </h1>

          <p className="mt-4 text-lg text-foreground/90 sm:text-xl">
            choose your model and see the available roms.
          </p>

          <div className="mt-6">
            <Link
              to="/devices"
              className="inline-block rounded-full border-2 border-primary bg-background/40 px-4 py-2 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-primary/15"
            >
              ← All brands
            </Link>
          </div>

          {brand.series.map((series) => (
            <div key={series.title} className="mt-12">
              <h2 className="text-2xl font-extrabold tracking-widest text-primary">
                {series.title}
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {series.models.map((model) => (
                  <Link
                    key={model}
                    to="/devices/$brand/$model"
                    params={{ brand: brand.slug, model: slugify(model) }}
                    className="rounded-full border-2 border-primary bg-background/40 px-3 py-3 text-sm font-bold text-foreground backdrop-blur-sm transition-colors hover:bg-primary/15 sm:text-base"
                  >
                    {model}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
