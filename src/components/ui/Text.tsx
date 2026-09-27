import { colors, type as typeScale, type TypeToken } from "@/theme";
import { Text, type TextProps } from "react-native";

type Props = TextProps & { color?: string; center?: boolean };

function make(defaultToken: TypeToken, defaultColor: string) {
  return function ThemedText({
    style,
    color,
    center,
    variant,
    ...rest
  }: Props & { variant?: TypeToken }) {
    return (
      <Text
        {...rest}
        style={[
          typeScale[variant ?? defaultToken],
          { color: color ?? defaultColor },
          center && { textAlign: "center" },
          style,
        ]}
      />
    );
  };
}

// Fraunces — headings & emotional moments. variant: display | title | titleItalic | heading | headingItalic
export const Title = make("title", colors.inkOcean);
// Nunito — all UI text. variant: bodyLarge | body | bodyStrong | label | small | button
export const Body = make("body", colors.ink);
// Caveat — ONLY handwritten captions & personal notes. variant: hand | handSmall
export const Handwritten = make("hand", colors.ink);
