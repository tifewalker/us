import { colors, space } from "@/theme";
import { useState } from "react";
import { Pressable, StyleSheet, View, type TextInputProps } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Input } from "./Input";

// A password field with an eye button to show / hide what you typed.
export function PasswordInput({ label, ...rest }: Omit<TextInputProps, "secureTextEntry"> & { label?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Input
        label={label}
        {...rest}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.field, rest.style]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        hitSlop={8}
        style={[styles.eye, label ? styles.eyeWithLabel : null]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M2 12 C5 6.5 8.5 4.5 12 4.5 C15.5 4.5 19 6.5 22 12 C19 17.5 15.5 19.5 12 19.5 C8.5 19.5 5 17.5 2 12 Z" stroke={colors.inkSoft} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
          <Circle cx={12} cy={12} r={3.2} stroke={colors.inkSoft} strokeWidth={1.8} fill="none" />
          {!visible && <Path d="M4 20 L20 4" stroke={colors.inkSoft} strokeWidth={1.8} strokeLinecap="round" />}
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingRight: 52 },
  // the Input wrap has marginBottom space.md; the field is 52 tall
  eye: { position: "absolute", right: space.md, bottom: space.md, height: 52, justifyContent: "center" },
  eyeWithLabel: {},
});
