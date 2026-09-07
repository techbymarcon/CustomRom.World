export function CommentAvatar({
  username,
  avatarUrl,
  verified,
}: {
  username: string;
  avatarUrl: string | null;
  verified: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${username} profile picture`}
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[0.65rem] font-extrabold uppercase text-primary">
          {username.slice(0, 1)}
        </span>
      )}
      <span className="text-sm font-bold">{username}</span>
      {verified && (
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" aria-label="Verified" role="img">
          <path
            fill="currentColor"
            d="M12 1.5l2.4 2 3.1-.3 1 3 2.7 1.6-1.1 2.9 1.1 2.9-2.7 1.6-1 3-3.1-.3-2.4 2-2.4-2-3.1.3-1-3L3.8 15.1 4.9 12.2 3.8 9.3 6.5 7.7l1-3 3.1.3z"
          />
          <path fill="hsl(var(--background))" d="M10.9 15.4l-3-3 1.3-1.3 1.7 1.7 4-4 1.3 1.3z" />
        </svg>
      )}
    </span>
  );
}
