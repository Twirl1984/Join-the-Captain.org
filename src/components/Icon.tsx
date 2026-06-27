// Schlanke Outline-Icons im Tabler-Stil (stroke-basiert, dependency-frei).
// Keys entsprechen den icon_key-Werten in der DB.

import type { CSSProperties } from "react";

type IconName =
  | "compass" | "anchor" | "microphone" | "clock" | "discord" | "bulb"
  | "robot" | "thumb-up" | "flag" | "send" | "shield-check" | "hammer"
  | "ruler" | "external-link" | "arrow-right" | "heart" | "info-circle"
  | "inbox" | "checklist" | "cloud" | "map-2" | "photo" | "apps" | "star"
  | "check" | "x" | "shield" | "wallet" | "users" | "play" | "rss" | "menu";

// icon_key aus der DB → Icon-Name.
export function iconForKey(key: string | null | undefined): IconName {
  const map: Record<string, IconName> = {
    "map-2": "map-2", checklist: "checklist", cloud: "cloud", photo: "photo",
    apps: "apps", wallet: "wallet", shield: "shield", anchor: "anchor",
    compass: "compass",
  };
  return (key && map[key]) || "apps";
}

const PATHS: Record<IconName, string> = {
  compass: "M8 16l2-6 6-2-2 6-6 2zM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  anchor: "M12 9v12M5 12a7 7 0 0 0 14 0M3 12h2m14 0h2M12 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  microphone: "M9 2h6v9a3 3 0 0 1-6 0zM5 10a7 7 0 0 0 14 0M12 17v4M8 21h8",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  discord: "M8 9a14 14 0 0 1 8 0M7 16a18 18 0 0 0 10 0M9 12h.01M15 12h.01M7 16c-1-4-1-8 1-11l3 1h2l3-1c2 3 2 7 1 11l-2 2-1-2M9 18l-2 2",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10c-1 1-1 2-1 3H9c0-1 0-2-1-3a6 6 0 0 1 4-10z",
  robot: "M12 2v3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM9 13h.01M15 13h.01M9 17h6M3 13v3M21 13v3",
  "thumb-up": "M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 1.5H7",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  send: "M10 14l11-11M21 3l-7 18-4-7-7-4z",
  "shield-check": "M12 3l8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6zM9 12l2 2 4-4",
  hammer: "M11 12l-6 6a2 2 0 0 0 3 3l6-6M13 9l4-4M13 9l3 3 5-5-3-3zM13 9l-2-2",
  ruler: "M5 19L19 5l-3-3L2 16zM8 8l2 2M11 5l2 2M5 11l2 2",
  "external-link": "M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M14 4h6v6M20 4L10 14",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  heart: "M12 20l-7-7a4 4 0 0 1 7-3 4 4 0 0 1 7 3z",
  "info-circle": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8h.01M11 12h1v4h1",
  inbox: "M4 4h16v16H4zM4 13h4l2 3h4l2-3h4",
  checklist: "M9 6h11M9 12h11M9 18h11M4 5l1 1 2-2M4 11l1 1 2-2M4 17l1 1 2-2",
  cloud: "M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A4 4 0 0 1 17 18z",
  "map-2": "M9 4l6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14",
  photo: "M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4M9 9h.01",
  apps: "M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z",
  star: "M12 3l2.5 6 6.5.5-5 4 1.5 6.5L12 16l-5.5 4L8 13.5l-5-4 6.5-.5z",
  check: "M5 12l5 5 9-11",
  x: "M6 6l12 12M18 6L6 18",
  shield: "M12 3l8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6z",
  wallet: "M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h.01",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 3 6",
  play: "M7 4v16l13-8z",
  rss: "M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2M4 11a9 9 0 0 1 9 9M4 5a15 15 0 0 1 15 15",
  menu: "M4 7h16M4 12h16M4 17h16",
};

export function Icon({
  name,
  size = 20,
  className,
  style,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
