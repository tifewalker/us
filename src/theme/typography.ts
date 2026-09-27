import {
  Caveat_500Medium,
  Caveat_700Bold,
} from "@expo-google-fonts/caveat";
import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from "@expo-google-fonts/fraunces";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import type { TextStyle } from "react-native";

// Passed to useFonts() in the root layout. Keys are the fontFamily names.
export const fontAssets = {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Caveat_500Medium,
  Caveat_700Bold,
};

export const fonts = {
  heading: "Fraunces_600SemiBold",
  headingItalic: "Fraunces_600SemiBold_Italic",
  italic: "Fraunces_400Regular_Italic",
  body: "Nunito_400Regular",
  bodySemiBold: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold",
  bodyExtraBold: "Nunito_800ExtraBold",
  hand: "Caveat_700Bold",
  handMedium: "Caveat_500Medium",
} as const;

// Mirrors DESIGN.md → Type → Scale.
export const type = {
  display: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 48, letterSpacing: -0.5 },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36 },
  titleItalic: { fontFamily: fonts.italic, fontSize: 30, lineHeight: 36 },
  heading: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  headingItalic: { fontFamily: fonts.headingItalic, fontSize: 22, lineHeight: 28 },
  bodyLarge: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: fonts.bodyExtraBold, fontSize: 16, lineHeight: 20 },
  small: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  hand: { fontFamily: fonts.hand, fontSize: 26, lineHeight: 28 },
  handSmall: { fontFamily: fonts.handMedium, fontSize: 20, lineHeight: 22 },
} satisfies Record<string, TextStyle>;
export type TypeToken = keyof typeof type;
