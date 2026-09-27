// Stable pseudo-random numbers from a string (e.g. a memory id), so decorative
// rotations are random-looking but identical on every render.
export function seededUnit(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000; // 0..1
}

// −max..max
export function seededTilt(seed: string, max: number, salt = 0): number {
  return (seededUnit(seed, salt) * 2 - 1) * max;
}
