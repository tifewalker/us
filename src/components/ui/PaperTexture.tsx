import { Image, StyleSheet } from "react-native";

// Tiled paper grain (assets/textures/paper-grain.png, generated in-repo).
// Absolutely fills its parent; put it first inside a paper-colored surface.
// RN's Image is used on purpose: expo-image has no "repeat" mode.
export function PaperTexture({ opacity = 1 }: { opacity?: number }) {
  return (
    <Image
      source={require("@/assets/textures/paper-grain.png")}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFill, { width: "100%", height: "100%", opacity }]}
    />
  );
}
