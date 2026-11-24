import { router, Stack } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import { ModelPicker } from "../components/ModelPicker";
import { fetchModels, type ArvoModel } from "../lib/api";
import { WEB_URL } from "../lib/config";
import { useApp } from "../lib/store";
import { colors, radius } from "../lib/theme";
import { useChat } from "../lib/useChat";

const SUGGESTIONS = [
  "Build me a landing page for a coffee shop",
  "Make an Expo app for a to-do list",
  "Explain this error in my code",
  "Plan a study schedule for this week",
];

export default function ChatScreen() {
  const app = useApp();
  const { send, retryLast, stop, isGenerating } = useChat();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [models, setModels] = useState<ArvoModel[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { email, plan, selectedModel } = app.settings;
  const messages = app.activeConversation?.messages ?? [];

  // Reload models when the email or plan changes, since that decides which unlock.
  useEffect(() => {
    if (!app.ready) return;
    let cancelled = false;
    fetchModels(email).then((data) => {
      if (cancelled) return;
      setModels(data.models);
      const usable = data.models.filter((m) => !m.locked);
      if (usable.length && !usable.some((m) => m.id === selectedModel)) {
        app.updateSettings({ selectedModel: (usable.find((m) => m.id === data.default) ?? usable[0]).id });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.ready, email, plan]);

  const activeModel = models.find((m) => m.id === selectedModel);

  const showLocked = (model: ArvoModel) => {
    const message = `${model.name} is included with the ${model.required_plan} plan and above.`;
    const buttons: { text: string; onPress?: () => void; style?: "cancel" }[] = [{ text: "OK", style: "cancel" }];
    if (WEB_URL) buttons.push({ text: "See plans", onPress: () => Linking.openURL(`${WEB_URL}/pricing`) });
    else buttons.push({ text: "Settings", onPress: () => router.push("/settings") });
    Alert.alert("Upgrade to use this model", `${message} Upgrade on the Arvo website, then enter your email in Settings.`, buttons);
  };

  if (!app.ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable style={styles.modelButton} onPress={() => setPickerOpen(true)} accessibilityLabel="Choose model">
              <Text style={styles.modelName}>{activeModel?.name ?? "Arvo"}</Text>
              <Ionicons name="chevron-down" size={15} color={colors.textSecondary} />
            </Pressable>
          ),
          headerTitleAlign: "center",
          headerLeft: () => (
            <Pressable onPress={() => router.push("/chats")} hitSlop={10} accessibilityLabel="Chats" style={styles.headerIcon}>
              <Ionicons name="menu" size={23} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <Pressable onPress={app.newChat} hitSlop={10} accessibilityLabel="New chat" style={styles.headerIcon}>
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => router.push("/settings")} hitSlop={10} accessibilityLabel="Settings" style={styles.headerIcon}>
                <Ionicons name="person-circle-outline" size={24} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Arvo</Text>
            <Text style={styles.welcomeSubtitle}>Build. Code. Create.</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.suggestion} onPress={() => void send(s, [])}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardDismissMode="interactive"
            renderItem={({ item, index }) => (
              <MessageBubble message={item} isLast={index === messages.length - 1} onRetry={() => void retryLast()} />
            )}
          />
        )}
        <View style={{ paddingBottom: Math.max(insets.bottom - 6, 0) }}>
          <Composer isGenerating={isGenerating} onSend={(t, imgs) => void send(t, imgs)} onStop={stop} />
        </View>
      </KeyboardAvoidingView>

      <ModelPicker
        visible={pickerOpen}
        models={models}
        selectedId={selectedModel}
        onSelect={(id) => app.updateSettings({ selectedModel: id })}
        onLocked={showLocked}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerIcon: { paddingHorizontal: 6 },
  modelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  welcomeTitle: { color: colors.text, fontSize: 34, fontWeight: "800" },
  welcomeSubtitle: { color: colors.textSecondary, fontSize: 16, marginBottom: 20 },
  suggestions: { width: "100%", maxWidth: 480, gap: 10 },
  suggestion: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
  },
  suggestionText: { color: colors.textSecondary, fontSize: 14.5 },
});
