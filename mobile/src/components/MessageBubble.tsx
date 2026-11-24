import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChatMessage } from "../lib/store";
import { colors, radius } from "../lib/theme";
import { Markdown } from "./Markdown";

interface Props {
  message: ChatMessage;
  isLast: boolean;
  onRetry: () => void;
}

export function MessageBubble({ message, isLast, onRetry }: Props) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          {message.images && message.images.length > 0 && (
            <View style={styles.images}>
              {message.images.map((img, i) => (
                <Image key={i} source={{ uri: img.uri }} style={styles.image} />
              ))}
            </View>
          )}
          {!!message.content && (
            <Text selectable style={styles.userText}>
              {message.content}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (message.error) {
    return (
      <View style={styles.errorBox}>
        <Ionicons name="warning-outline" size={16} color={colors.danger} />
        <Text style={styles.errorText}>{message.content}</Text>
        {isLast && (
          <Pressable onPress={onRetry} hitSlop={8} accessibilityLabel="Try again">
            <Ionicons name="refresh" size={17} color={colors.danger} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.assistant}>
      {message.pending && !message.content ? (
        <ActivityIndicator color={colors.accent} style={{ alignSelf: "flex-start", marginVertical: 6 }} />
      ) : (
        <Markdown content={message.content} />
      )}
      {!message.pending && !!message.content && (
        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={async () => {
              await Clipboard.setStringAsync(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={colors.textTertiary} />
            <Text style={styles.actionText}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
          {isLast && (
            <Pressable style={styles.action} onPress={onRetry}>
              <Ionicons name="refresh" size={14} color={colors.textTertiary} />
              <Text style={styles.actionText}>Regenerate</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: "flex-end", marginVertical: 6 },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  userText: { color: colors.text, fontSize: 15.5, lineHeight: 22 },
  images: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  image: { width: 140, height: 140, borderRadius: radius.md },
  assistant: { marginVertical: 8 },
  actions: { flexDirection: "row", gap: 14, marginTop: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { color: colors.textTertiary, fontSize: 12.5 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: 12,
    marginVertical: 8,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 14.5, lineHeight: 20 },
});
