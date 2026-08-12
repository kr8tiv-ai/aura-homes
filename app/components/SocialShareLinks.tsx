const SHARE_URL = "https://aurahomes.fun/";
const SHARE_TEXT = "Design the home. Find the land. Build it for real with Aura Homes.";

const encodedUrl = encodeURIComponent(SHARE_URL);
const encodedText = encodeURIComponent(SHARE_TEXT);

const channels = [
  {
    label: "X",
    href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
  },
  {
    label: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  },
  {
    label: "Telegram",
    href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
  },
] as const;

export default function SocialShareLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`aura-share${compact ? " aura-share-compact" : ""}`}>
      <span>Share Aura</span>
      <div>
        {channels.map((channel) => (
          <a
            key={channel.label}
            href={channel.href}
            target="aura-share"
            rel="noopener noreferrer"
            aria-label={`Share Aura Homes on ${channel.label}`}
          >
            {channel.label}
          </a>
        ))}
      </div>
    </div>
  );
}
