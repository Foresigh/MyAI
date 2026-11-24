import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

interface Props {
  html?: string;
  uri?: string;
  style?: StyleProp<ViewStyle>;
}

/** Browser version of WebPreview (WebView doesn't run on web), using a sandboxed iframe. */
export function WebPreview({ html, uri, style }: Props) {
  return (
    <View style={[styles.view, style]}>
      {html !== undefined ? (
        // No allow-same-origin: the page can't read the app's storage.
        <iframe title="Preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals" style={frame} />
      ) : (
        // Snack runs on its own domain, so it is isolated from the app anyway.
        <iframe
          title="Preview"
          src={uri}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          style={frame}
        />
      )}
    </View>
  );
}

const frame = { border: "none", width: "100%", height: "100%", background: "#ffffff" } as const;

const styles = StyleSheet.create({
  view: { flex: 1, backgroundColor: "#ffffff" },
});
