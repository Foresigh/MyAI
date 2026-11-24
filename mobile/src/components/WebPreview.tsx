import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  /** A full HTML page to show, or */
  html?: string;
  /** a URL to load. */
  uri?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shows a website Arvo wrote, or Snack's player for an Expo app. The page runs
 * in its own WebView, so it can't reach the app's saved chats or settings.
 */
export function WebPreview({ html, uri, style }: Props) {
  return (
    <WebView
      style={[styles.view, style]}
      source={html !== undefined ? { html } : { uri: uri ?? "about:blank" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
    />
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, backgroundColor: "#ffffff" },
});
