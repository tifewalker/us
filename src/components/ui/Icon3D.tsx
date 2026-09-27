import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";

// Microsoft Fluent Emoji 3D (MIT) — see assets/icons3d/LICENSE and DESIGN.md → Icons.
const icons = {
  beach: require("@/assets/icons3d/beach.png"),
  die: require("@/assets/icons3d/die.png"),
  camera: require("@/assets/icons3d/camera.png"),
  loveLetter: require("@/assets/icons3d/love-letter.png"),
  gear: require("@/assets/icons3d/gear.png"),
  shell: require("@/assets/icons3d/shell.png"),
  palm: require("@/assets/icons3d/palm.png"),
  bottle: require("@/assets/icons3d/bottle.png"),
  cake: require("@/assets/icons3d/cake.png"),
  fire: require("@/assets/icons3d/fire.png"),
  star: require("@/assets/icons3d/star.png"),
  moon: require("@/assets/icons3d/moon.png"),
  sun: require("@/assets/icons3d/sun.png"),
  wave: require("@/assets/icons3d/wave.png"),
  sparklingHeart: require("@/assets/icons3d/sparkling-heart.png"),
  gift: require("@/assets/icons3d/gift.png"),
  film: require("@/assets/icons3d/film.png"),
  heart: require("@/assets/icons3d/heart.png"),
  envelope: require("@/assets/icons3d/envelope.png"),
  calendar: require("@/assets/icons3d/calendar.png"),
  hourglass: require("@/assets/icons3d/hourglass.png"),
  sparkles: require("@/assets/icons3d/sparkles.png"),
  radio: require("@/assets/icons3d/radio.png"),
  headphone: require("@/assets/icons3d/headphone.png"),
  musicalNotes: require("@/assets/icons3d/musical-notes.png"),
} as const;

export type Icon3DName = keyof typeof icons;

export function Icon3D({
  name,
  size = 40,
  style,
}: {
  name: Icon3DName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={icons[name]}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
