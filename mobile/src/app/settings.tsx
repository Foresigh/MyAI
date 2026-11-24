import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PLAN_NAMES } from "../lib/api";
import { WEB_URL } from "../lib/config";
import { useApp } from "../lib/store";
import { colors, radius } from "../lib/theme";

export default function SettingsScreen() {
  const app = useApp();
  const [draft, setDraft] = useState(app.settings.email);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = async () => {
    const email = draft.trim().toLowerCase();
    setChecking(true);
    setNote(null);
    app.updateSettings({ email });
    const plan = await app.refreshPlan(email);
    setChecking(false);
    setNote(
      plan === "free"
        ? "Saved. This email is on the Free plan."
        : `Saved. This email is on the ${PLAN_NAMES[plan]} plan.`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 24 }} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.label}>Your plan</Text>
        <View style={styles.planRow}>
          <Text style={styles.planName}>{PLAN_NAMES[app.settings.plan]}</Text>
          {app.settings.plan === "free" && <Text style={styles.hint}>Arvo 1.0 · 40 messages a day</Text>}
        </View>
        {WEB_URL ? (
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/pricing`)}>
            <Text style={styles.link}>See plans and upgrade</Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>Upgrade on the Arvo website, then enter the same email below.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.hint}>Paid plans are linked to your email. Enter the email you subscribed with.</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="you@example.com"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          onSubmitEditing={() => void save()}
        />
        <Pressable style={styles.button} onPress={() => void save()} disabled={checking}>
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
        </Pressable>
        {note && <Text style={styles.note}>{note}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>About</Text>
        <Text style={styles.hint}>Arvo was made by Kayi Berisa. Chats are saved on this device only.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { gap: 8 },
  label: { color: colors.textTertiary, fontSize: 12.5, fontWeight: "600", textTransform: "uppercase" },
  planRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  planName: { color: colors.text, fontSize: 22, fontWeight: "700" },
  hint: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  input: {
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 15.5, fontWeight: "600" },
  note: { color: colors.success, fontSize: 14 },
});
