/** The project's X handle — the account exists (x.com/AuraHomes_fun) and the
 *  hackathon judges weigh an ACTIVE one, so following comes before sharing. */
export const X_HANDLE = "AuraHomes_fun";

/** The follow web intent. A true one-click auto-follow needs OAuth and a
 *  server — impossible from a static site — so this opens X's own pre-filled
 *  follow dialog: one click here, one confirm there. The same honest shape
 *  as the STAR_URL login?return_to journey in StoryChrome. */
export const FOLLOW_INTENT = `https://twitter.com/intent/follow?screen_name=${X_HANDLE}`;

const SHARE_URL = "https://aurahomes.fun/";
const SHARE_TEXT = "Design your eco home. Find the land. Manage the build with Aura Homes.";

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
      <a
        className="aura-follow"
        href={FOLLOW_INTENT}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Follow @${X_HANDLE} on X`}
      >
        Follow @{X_HANDLE}
      </a>
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
