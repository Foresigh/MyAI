import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { expoSnackUrl, isExpoApp } from "../lib/snack";
import { colors, mono, radius } from "../lib/theme";

type Block = { type: "code"; language: string; code: string } | { type: "text"; text: string };

function splitBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const fence = /```([\w+-]*)[^\n]*\n([\s\S]*?)(```|$)/g;
  let last = 0;
  for (const match of content.matchAll(fence)) {
    const index = match.index ?? 0;
    if (index > last) blocks.push({ type: "text", text: content.slice(last, index) });
    blocks.push({ type: "code", language: match[1] ?? "", code: match[2].replace(/\n$/, "") });
    last = index + match[0].length;
  }
  if (last < content.length) blocks.push({ type: "text", text: content.slice(last) });
  return blocks;
}

/** Renders **bold** and `code` inside a line. */
function Inline({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <Text style={[styles.text, style]}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={i} style={styles.inlineCode}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function TextBlock({ text }: { text: string }) {
  const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
  return (
    <View style={styles.textBlock}>
      {lines.map((line, i) => {
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) return <Inline key={i} text={heading[2]} style={styles.heading} />;
        const bullet = line.match(/^\s*([-*•]|\d+\.)\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>{/\d/.test(bullet[1]) ? bullet[1] : "•"}</Text>
              <View style={{ flex: 1 }}>
                <Inline text={bullet[2]} />
              </View>
            </View>
          );
        }
        if (/^\s*(---|\*\*\*)\s*$/.test(line)) return <View key={i} style={styles.rule} />;
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        return <Inline key={i} text={line} />;
      })}
    </View>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const expo = isExpoApp(language, code);
  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{language || "code"}</Text>
        <View style={styles.codeActions}>
          {expo && (
            <Pressable style={styles.codeButton} onPress={() => Linking.openURL(expoSnackUrl(language, code))}>
              <Ionicons name="phone-portrait-outline" size={13} color={colors.accent} />
              <Text style={[styles.codeButtonText, { color: colors.accent }]}>Run in Snack</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.codeButton}
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={13} color={colors.textSecondary} />
            <Text style={styles.codeButtonText}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={styles.code}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <View>
      {splitBlocks(content).map((block, i) =>
        block.type === "code" ? (
          <CodeBlock key={i} language={block.language} code={block.code} />
        ) : (
          <TextBlock key={i} text={block.text} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  textBlock: { gap: 4 },
  text: { color: colors.text, fontSize: 15.5, lineHeight: 23 },
  bold: { fontWeight: "700" },
  heading: { fontSize: 17, fontWeight: "700", marginTop: 6 },
  inlineCode: { fontFamily: mono, fontSize: 14, backgroundColor: colors.elevated, color: colors.text },
  bulletRow: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  bulletMark: { color: colors.textSecondary, fontSize: 15.5, lineHeight: 23, minWidth: 14 },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  codeWrap: {
    marginVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.code,
    overflow: "hidden",
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  codeLang: { color: colors.textTertiary, fontFamily: mono, fontSize: 12 },
  codeActions: { flexDirection: "row", gap: 4 },
  codeButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3 },
  codeButtonText: { color: colors.textSecondary, fontSize: 12 },
  code: { fontFamily: mono, fontSize: 13, lineHeight: 19, color: colors.text, padding: 12 },
});
