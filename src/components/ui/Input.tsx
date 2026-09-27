import { colors, radius, space, type as typeScale } from "@/theme";
import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & { label?: string };

// Paper-style text field: recessed paperDeep well, ink text, ocean focus edge.
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, style, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[typeScale.label, styles.label]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          typeScale.body,
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          style,
        ]}
      />
    </View>
  );
});

export const inputStyles = StyleSheet.create({
  field: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
});

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: { color: colors.inkSoft, marginBottom: space.xs, marginLeft: space.xs },
  input: { ...inputStyles.field, color: colors.ink },
  multiline: { minHeight: 110, textAlignVertical: "top", paddingTop: space.md },
  focused: { borderColor: colors.sky, backgroundColor: colors.warmWhite },
});
