import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getMyRomRating, getRomRating, rateRom } from "@/lib/reviews.functions";
import { useSite } from "@/lib/site";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"
        className={filled ? "fill-primary" : "fill-transparent"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function RomRating({ romId }: { romId: string }) {
  const { session } = useSite();
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ["rom-rating", romId],
    queryFn: () => getRomRating({ data: { rom_id: romId } }),
  });

  const mine = useQuery({
    queryKey: ["rom-rating-mine", romId, session?.user.id ?? null],
    queryFn: () => getMyRomRating({ data: { rom_id: romId } }),
    enabled: Boolean(session),
  });

  const rateFn = useServerFn(rateRom);
  const rate = useMutation({
    mutationFn: (rating: number) => rateFn({ data: { rom_id: romId, rating } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Thanks for the rating!");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rom-rating", romId] }),
        queryClient.invalidateQueries({ queryKey: ["rom-rating-mine", romId] }),
      ]);
    },
    onError: () => toast.error("Couldn't save your rating"),
  });

  const average = summary.data?.average ?? 0;
  const count = summary.data?.count ?? 0;
  const myRating = mine.data?.rating ?? 0;

  return (
    <section className="mt-6 rounded-3xl border-2 border-primary bg-background/40 p-5 text-left backdrop-blur-sm">
      <h2 className="text-xl font-extrabold text-primary">Rating</h2>

      <div className="mt-3 flex items-center gap-3 text-primary">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} filled={n <= Math.round(average)} />
          ))}
        </div>
        <span className="text-sm font-bold text-foreground/90">
          {count ? `${average.toFixed(1)} / 5 · ${count} ${count === 1 ? "vote" : "votes"}` : "no votes yet"}
        </span>
      </div>

      {session ? (
        <div className="mt-4">
          <p className="text-sm font-bold">{myRating ? "Your rating" : "Rate this ROM"}</p>
          <div className="mt-1 flex text-primary">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={rate.isPending}
                onClick={() => rate.mutate(n)}
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                className="transition-transform hover:scale-110 disabled:opacity-60"
              >
                <Star filled={n <= myRating} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Sign in to rate this ROM.</p>
      )}
    </section>
  );
}
