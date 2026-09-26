import type { CSSProperties } from "react";

/**
 * Fixed, decorative background: soft colour blobs (static — anything moving behind glass forces every panel to re-blur each frame), a faint grid and a
 * few floating robot illustrations. Everything here is aria-hidden and
 * pointer-events-none; the glass panels above blur it, which is what makes
 * the glassmorphism read.
 *
 * All art is inline SVG, so there are no image requests and it stays crisp
 * at any size. Each robot takes an `id` so its gradient ids stay unique
 * when several are on the page at once.
 */
export default function BotBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Colour blobs */}
      <Blob className="-left-40 -top-40 h-[34rem] w-[34rem]" color="oklch(0.55 0.25 295)" />
      <Blob className="-right-32 top-1/4 h-[30rem] w-[30rem]" color="oklch(0.70 0.16 210)" />
      <Blob className="bottom-[-12rem] left-1/3 h-[32rem] w-[32rem]" color="oklch(0.62 0.22 350)" />
      <Blob className="left-[8%] top-[55%] h-[20rem] w-[20rem]" color="oklch(0.60 0.18 255)" />

      {/* Faint grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Robots */}
      <Float className="bottom-[4%] right-[3%] w-[min(30vw,320px)]" opacity={0.5} tilt="-6deg" dur="10s">
        <Robot id="bot-a" />
      </Float>
      <Float className="left-[2%] top-[10%] hidden w-[190px] md:block" opacity={0.4} tilt="8deg" dur="12s">
        <SupportBot id="bot-b" />
      </Float>
      <Float className="right-[18%] top-[6%] hidden w-[120px] lg:block" opacity={0.3} tilt="10deg" dur="8s">
        <Robot id="bot-c" />
      </Float>
      <Float className="bottom-[6%] left-[4%] w-[min(22vw,170px)]" opacity={0.35} tilt="-10deg" dur="11s">
        <SupportBot id="bot-d" />
      </Float>
    </div>
  );
}

function Blob({ className, color }: { className: string; color: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl ${className}`}
      style={{ background: color, opacity: 0.55 }}
    />
  );
}

function Float({
  className,
  opacity,
  tilt,
  dur,
  children,
}: {
  className: string;
  opacity: number;
  tilt: string;
  dur: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bot-float absolute ${className}`}
      style={{ opacity, ["--tilt" as string]: tilt, ["--dur" as string]: dur } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Full-body robot: antenna, screen face with blinking eyes, chest core. */
export function Robot({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 250" fill="none" className={className ?? "h-auto w-full"}>
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* Antenna */}
      <line x1="100" y1="18" x2="100" y2="46" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="14" r="8" fill={`url(#${id}-glow)`} />

      {/* Ears */}
      <rect x="30" y="72" width="16" height="34" rx="8" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.5" />
      <rect x="154" y="72" width="16" height="34" rx="8" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.5" />

      {/* Head */}
      <rect x="44" y="46" width="112" height="86" rx="28" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
      <rect x="58" y="62" width="84" height="54" rx="20" fill="#0b0830" fillOpacity="0.75" />
      <circle className="bot-eye" cx="82" cy="86" r="9" fill={`url(#${id}-glow)`} />
      <circle className="bot-eye" cx="118" cy="86" r="9" fill={`url(#${id}-glow)`} />
      <path d="M88 103 Q100 111 112 103" stroke={`url(#${id}-glow)`} strokeWidth="4" strokeLinecap="round" />

      {/* Neck */}
      <rect x="88" y="132" width="24" height="12" rx="4" fill="#fff" fillOpacity="0.35" />

      {/* Arms */}
      <rect x="22" y="152" width="22" height="62" rx="11" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.5" transform="rotate(12 33 152)" />
      <rect x="156" y="152" width="22" height="62" rx="11" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.5" transform="rotate(-12 167 152)" />

      {/* Body */}
      <rect x="50" y="144" width="100" height="84" rx="26" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
      <circle cx="100" cy="182" r="17" fill="#0b0830" fillOpacity="0.6" stroke={`url(#${id}-glow)`} strokeWidth="3" />
      <path d="M103 170 L94 184 H102 L97 195 L108 180 H100 Z" fill={`url(#${id}-glow)`} />
      <rect x="70" y="210" width="60" height="6" rx="3" fill="#fff" fillOpacity="0.3" />
    </svg>
  );
}

/** Round support bot with a headset and a chat bubble. */
export function SupportBot({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 220 200" fill="none" className={className ?? "h-auto w-full"}>
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0abfc" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
      </defs>

      {/* Chat bubble */}
      <path
        d="M140 12 h62 a14 14 0 0 1 14 14 v28 a14 14 0 0 1 -14 14 h-38 l-14 14 v-14 h-10 a14 14 0 0 1 -14 -14 v-28 a14 14 0 0 1 14 -14 z"
        fill={`url(#${id}-shell)`}
        stroke="#fff"
        strokeOpacity="0.6"
      />
      <circle cx="158" cy="40" r="5" fill={`url(#${id}-glow)`} />
      <circle cx="175" cy="40" r="5" fill={`url(#${id}-glow)`} />
      <circle cx="192" cy="40" r="5" fill={`url(#${id}-glow)`} />

      {/* Headset band */}
      <path d="M38 104 a62 62 0 0 1 124 0" stroke="#fff" strokeOpacity="0.55" strokeWidth="7" strokeLinecap="round" />

      {/* Head */}
      <circle cx="100" cy="116" r="60" fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
      <rect x="62" y="92" width="76" height="48" rx="22" fill="#0b0830" fillOpacity="0.75" />
      <rect className="bot-eye" x="78" y="106" width="14" height="18" rx="7" fill={`url(#${id}-glow)`} />
      <rect className="bot-eye" x="108" y="106" width="14" height="18" rx="7" fill={`url(#${id}-glow)`} />

      {/* Ear cups + mic */}
      <rect x="28" y="96" width="20" height="38" rx="10" fill={`url(#${id}-glow)`} fillOpacity="0.85" />
      <rect x="152" y="96" width="20" height="38" rx="10" fill={`url(#${id}-glow)`} fillOpacity="0.85" />
      <path d="M40 134 Q46 168 84 168" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <circle cx="88" cy="168" r="6" fill={`url(#${id}-glow)`} />
    </svg>
  );
}

/** Small app mark: a robot face on the accent gradient. */
export function BotMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.4), 0 6px 18px -6px color-mix(in oklab, var(--color-accent-2) 70%, transparent)",
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
        <line x1="12" y1="2.5" x2="12" y2="5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="2.5" r="1.4" fill="#fff" />
        <rect x="4" y="5.5" width="16" height="13" rx="4.5" fill="#fff" fillOpacity="0.95" />
        <circle cx="9" cy="12" r="1.7" fill="#3b1d8f" />
        <circle cx="15" cy="12" r="1.7" fill="#3b1d8f" />
        <path d="M9.5 15.3 Q12 16.8 14.5 15.3" stroke="#3b1d8f" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="2" y="10" width="2" height="4" rx="1" fill="#fff" />
        <rect x="20" y="10" width="2" height="4" rx="1" fill="#fff" />
      </svg>
    </span>
  );
}
