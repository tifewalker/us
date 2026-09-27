import { skies, skyForHour, skyKeyframes, type SkyName } from "@/theme";

export type TimeOverride = "auto" | SkyName;

// Representative hour for each dev-panel override.
export const OVERRIDE_HOURS: Record<SkyName, number> = {
  dawn: 6.5,
  day: 12,
  goldenHour: 17.8,
  dusk: 19.6,
  night: 23,
};

export function localHour(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

// Sky gradient (3 stops) for any hour, blended smoothly between keyframes.
export function skyAt(hour: number): [string, string, string] {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < skyKeyframes.length - 1; i++) {
    const a = skyKeyframes[i];
    const b = skyKeyframes[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const t = b.hour === a.hour ? 0 : (h - a.hour) / (b.hour - a.hour);
      const ease = t * t * (3 - 2 * t); // smoothstep
      const A = skies[a.sky];
      const B = skies[b.sky];
      return [mix(A[0], B[0], ease), mix(A[1], B[1], ease), mix(A[2], B[2], ease)];
    }
  }
  const n = skies.night;
  return [n[0], n[1], n[2]];
}

// 0 in full daylight → 1 at deep night (drives stars, lights, scene dimming).
export function nightFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 21 || h < 4.5) return 1;
  if (h >= 4.5 && h < 7) return 1 - (h - 4.5) / 2.5;
  if (h >= 18.5 && h < 21) return (h - 18.5) / 2.5;
  return 0;
}

// Sun is up 6:00–19:30, moon the rest of the time. Returns the body and how
// far along its arc it is (0 = rising on the left, 1 = setting on the right).
export function celestial(hour: number): { body: "sun" | "moon"; t: number } {
  const h = ((hour % 24) + 24) % 24;
  const rise = 6;
  const set = 19.5;
  if (h >= rise && h < set) return { body: "sun", t: (h - rise) / (set - rise) };
  const nightLen = 24 - set + rise;
  const since = h >= set ? h - set : h + 24 - set;
  return { body: "moon", t: since / nightLen };
}

export function timeName(hour: number): SkyName {
  return skyForHour(((hour % 24) + 24) % 24);
}

export function greeting(hour: number, firstName?: string | null) {
  const h = ((hour % 24) + 24) % 24;
  const part =
    h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 21 ? "evening" : "night";
  return firstName ? `Good ${part}, ${firstName}` : `Good ${part}`;
}
