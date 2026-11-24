import { router } from "expo-router";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../lib/store";
import { colors, radius } from "../lib/theme";

function when(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function ChatsScreen() {
  const app = useApp();

  const confirmDelete = (id: string, title: string) => {
    if (Platform.OS === "web") {
      app.deleteChat(id);
      return;
    }
    Alert.alert("Delete chat?", `"${title}" will be removed from this device.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => app.deleteChat(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.newChat}
        onPress={() => {
          app.newChat();
          router.back();
        }}
      >
        <Ionicons name="create-outline" size={18} color={colors.text} />
        <Text style={styles.newChatText}>New chat</Text>
      </Pressable>
      <FlatList
        data={app.conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>No chats yet. Start one and it will show up here.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, item.id === app.activeId && styles.rowActive]}
            onPress={() => {
              app.openChat(item.id);
              router.back();
            }}
            onLongPress={() => confirmDelete(item.id, item.title)}
          >
            <Ionicons name="chatbubble-outline" size={17} color={colors.textTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.meta}>{when(item.updatedAt)}</Text>
            </View>
            <Pressable onPress={() => confirmDelete(item.id, item.title)} hitSlop={10} accessibilityLabel="Delete chat">
              <Ionicons name="trash-outline" size={17} color={colors.textTertiary} />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  newChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  newChatText: { color: colors.text, fontSize: 15.5, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md },
  rowActive: { backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 15 },
  meta: { color: colors.textTertiary, fontSize: 12.5, marginTop: 2 },
  empty: { color: colors.textTertiary, textAlign: "center", marginTop: 40, fontSize: 14.5 },
});
