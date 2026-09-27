import { Alert, Platform, type AlertButton } from "react-native";

// react-native-web ships Alert.alert as an empty stub, so on the web app every
// error alert (wrong password, failed upload, …) silently did nothing. This
// replaces it on web with the browser's own dialogs (work in the installed
// iPhone web app too): one button → window.alert, two or more →
// window.confirm (OK runs the first non-cancel button, Cancel the cancel one).
// Imported once, for its side effect, from the root layout.
if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    const list = buttons ?? [];
    if (list.length <= 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    const cancel = list.find((b) => b.style === "cancel");
    const action = list.find((b) => b.style !== "cancel") ?? list[list.length - 1];
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}

export {};
