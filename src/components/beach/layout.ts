import { useTabBarClearance } from "@/components/ui";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// All beach positions derive from the window size, so the same scene lays out
// on an iPhone SE (667pt) and a Pro Max (932pt). Tappable objects live in the
// sand band between `shoreY` and `groundBottom`, which already stops above the
// floating tab bar.
export function useBeachLayout() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();

  const horizonY = Math.round(H * 0.34); // sea meets sky
  const shoreY = Math.round(H * 0.5); // sand starts (foam line)
  const groundBottom = H - tabClearance; // nothing tappable below this
  const band = groundBottom - shoreY; // height of the sand band for objects

  const palmHeight = Math.min(H * 0.36, 320);
  const polaroidWidth = Math.round(Math.max(92, Math.min(band * 0.42, 140)));

  return {
    W,
    H,
    insets,
    horizonY,
    shoreY,
    groundBottom,
    band,
    palmHeight,
    polaroidWidth,
    // Anchor points (x = centre, y = where the object touches the sand)
    palmLeft: { x: W * 0.13, y: shoreY + band * 0.16 },
    palmRight: { x: W * 0.9, y: shoreY + band * 0.08 },
    sign: { x: W * 0.77, y: shoreY + band * 0.62 },
    polaroid: { x: W * 0.46, y: shoreY + band * 0.1 }, // top of the polaroid
    towel: { x: W * 0.05, y: groundBottom - 62 }, // top-left of the towel
    bottle: { x: W * 0.5, y: shoreY - 62 }, // top-left of bottle + tag (at the waterline)
    radio: { x: W * 0.62, y: groundBottom - 62 }, // top-left of the radio sticker
    campfire: { x: W * 0.24, y: shoreY + band * 0.62 },
    starfish: { x: W * 0.9, y: shoreY + band * 0.36 }, // decoration, tucked under the sign
    writeBottle: { x: W * 0.465, y: groundBottom - 62 }, // top-left; between the towel and the radio
    jar: { x: W * 0.02, y: shoreY + band * 0.45 }, // top-left; open-when jar
    remember: { x: W * 0.02, y: shoreY + 2 }, // top-left; "Remember when…" polaroid at the tide line
    washed: { x: W * 0.72, y: shoreY - 44 }, // top-left; bottles that washed ashore (waterline)
    seaBottles: { y: horizonY + 10, xFrom: W * 0.36, xTo: W * 0.9 }, // drifting bottles far out
    hut: { x: W * 0.62, y: shoreY + 14 },
  };
}

export type BeachLayout = ReturnType<typeof useBeachLayout>;
