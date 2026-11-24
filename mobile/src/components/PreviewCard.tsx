import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useEffect, useState, type ReactNode } from "react";
import { ActionSheetIOS, Alert, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { expoSnackUrl } from "../lib/snack";
import { colors, radius } from "../lib/theme";
import { WebPreview } from "./WebPreview";

export type PreviewKind = "website" | "app";
type View_ = "preview" | "code";

interface Props {
  kind: PreviewKind;
  language: string;
  code: string;
  /** Renders the highlighted code block. */
  renderCode: () => ReactNode;
}

function titleFor(kind: PreviewKind, code: string): string {
  if (kind === "website") {
    const title = code.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
    const h1 = code.match(/<h1[^>]*>([^<]{1,80})<\/h1>/i)?.[1]?.trim();
    return title || h1 || "Website";
  }
  const name = code.match(/export\s+default\s+function\s+([A-Z]\w*)/)?.[1];
  if (name && name !== "App") return name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return "Expo app";
}

const SEGMENT = 44;

/** Icon-only Preview/Code switch whose raised thumb slides to the chosen side. */
function ViewToggle({ value, onChange }: { value: View_; onChange: (v: View_) => void }) {
  const [position] = useState(() => new Animated.Value(value === "code" ? 1 : 0));

  useEffect(() => {
    Animated.timing(position, {
      toValue: value === "code" ? 1 : 0,
      duration: 180,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [value, position]);

  const options: { id: View_; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "preview", label: "Preview", icon: "eye-outline" },
    { id: "code", label: "Code", icon: "code-slash" },
  ];

  return (
    <View style={styles.toggle} role="tablist" aria-label="View">
      <Animated.View
        style={[
          styles.toggleThumb,
          { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, SEGMENT] }) }] },
        ]}
      />
      {options.map((o) => {
        const active = value === o.id;
        return (
          <Pressable
            key={o.id}
            style={styles.toggleButton}
            onPress={() => onChange(o.id)}
            role="tab"
            aria-selected={active}
            aria-label={o.label}
          >
            <Ionicons name={o.icon} size={18} color={active ? colors.text : colors.textTertiary} />
          </Pressable>
        );
      })}
    </View>
  );
}

function PreviewPanel({ kind, language, code, title, renderCode, onClose }: Props & { title: string; onClose: () => void }) {
  const [view, setView] = useState<View_>("preview");
  const [copied, setCopied] = useState(false);
  const insets = useSafeAreaInsets();

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.panel, { paddingTop: insets.top }]}>
        <View style={styles.panelHeader}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close preview" style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.panelTitle} numberOfLines={1}>
            {title}
          </Text>
          <ViewToggle value={view} onChange={setView} />
          <Pressable onPress={copy} hitSlop={8} accessibilityLabel="Copy code" style={styles.headerButton}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={19} color={colors.textSecondary} />
          </Pressable>
          {kind === "app" && (
            <Pressable
              onPress={() => Linking.openURL(expoSnackUrl(language, code))}
              hitSlop={8}
              accessibilityLabel="Run in Expo Snack"
              style={styles.headerButton}
            >
              <Ionicons name="open-outline" size={19} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={[styles.panelBody, { paddingBottom: view === "code" ? insets.bottom : 0 }]}>
          {view === "preview" ? (
            kind === "website" ? (
              <WebPreview html={code} />
            ) : (
              <WebPreview uri={expoSnackUrl(language, code, true)} style={{ backgroundColor: colors.code }} />
            )
          ) : (
            <View style={styles.panelCode}>{renderCode()}</View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** A card for a website or Expo app Arvo wrote: icon, name, Open and more options. */
export function PreviewCard(props: Props) {
  const { kind, language, code, renderCode } = props;
  const [open, setOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const title = titleFor(kind, code);

  const actions: { label: string; run: () => void }[] = [
    { label: showCode ? "Hide code" : "View code", run: () => setShowCode((v) => !v) },
    { label: "Copy code", run: () => void Clipboard.setStringAsync(code) },
    ...(kind === "app" ? [{ label: "Run in Expo Snack", run: () => void Linking.openURL(expoSnackUrl(language, code)) }] : []),
  ];

  const showMore = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...actions.map((a) => a.label), "Cancel"], cancelButtonIndex: actions.length, title },
        (i) => actions[i]?.run()
      );
      return;
    }
    if (Platform.OS === "web") {
      // Alerts don't show on web, so the menu just toggles the code there.
      setShowCode((v) => !v);
      return;
    }
    Alert.alert(title, undefined, [...actions.map((a) => ({ text: a.label, onPress: a.run })), { text: "Cancel", style: "cancel" as const }]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Pressable style={styles.thumb} onPress={() => setOpen(true)} accessibilityLabel={`Open ${title}`}>
          <Ionicons name={kind === "website" ? "globe-outline" : "phone-portrait-outline"} size={34} color={colors.textTertiary} />
        </Pressable>
        <View style={styles.footer}>
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{kind === "website" ? "Website · HTML" : "App · Expo"}</Text>
          </View>
          <Pressable style={styles.openButton} onPress={() => setOpen(true)}>
            <Text style={styles.openText}>Open</Text>
          </Pressable>
          <Pressable style={styles.moreButton} onPress={showMore} accessibilityLabel="More options" hitSlop={6}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      {showCode && renderCode()}
      {open && <PreviewPanel {...props} title={title} onClose={() => setOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  thumb: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  meta: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  subtitle: { color: colors.textTertiary, fontSize: 12.5, marginTop: 1 },
  openButton: { backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 8 },
  openText: { color: colors.text, fontSize: 14, fontWeight: "500" },
  moreButton: { padding: 6 },
  panel: { flex: 1, backgroundColor: colors.bg },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: { padding: 6 },
  panelTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600", marginHorizontal: 4 },
  panelBody: { flex: 1 },
  panelCode: { flex: 1, padding: 10 },
  toggle: {
    flexDirection: "row",
    padding: 3,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  toggleThumb: {
    position: "absolute",
    top: 3,
    left: 3,
    width: SEGMENT,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleButton: { width: SEGMENT, height: 32, alignItems: "center", justifyContent: "center" },
});
