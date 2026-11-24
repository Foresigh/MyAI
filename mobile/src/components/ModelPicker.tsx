import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ArvoModel } from "../lib/api";
import { colors, radius } from "../lib/theme";

interface Props {
  visible: boolean;
  models: ArvoModel[];
  selectedId: string;
  onSelect: (id: string) => void;
  onLocked: (model: ArvoModel) => void;
  onClose: () => void;
}

export function ModelPicker({ visible, models, selectedId, onSelect, onLocked, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Choose a model</Text>
          {models.map((m) => {
            const selected = m.id === selectedId;
            return (
              <Pressable
                key={m.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => (m.locked ? onLocked(m) : (onSelect(m.id), onClose()))}
              >
                <View style={{ flex: 1, opacity: m.locked ? 0.55 : 1 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  <Text style={styles.description}>{m.description}</Text>
                </View>
                {m.locked ? (
                  <View style={styles.badge}>
                    <Ionicons name="lock-closed" size={11} color={colors.accent} />
                    <Text style={styles.badgeText}>{m.required_plan}</Text>
                  </View>
                ) : selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
          {models.length === 0 && <Text style={styles.description}>{"Couldn't load models. Check your connection."}</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-start", paddingTop: 90, padding: 16 },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 4,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: { color: colors.textTertiary, fontSize: 12.5, fontWeight: "600", padding: 8, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md },
  rowSelected: { backgroundColor: colors.accentSoft },
  name: { color: colors.text, fontSize: 15.5, fontWeight: "600" },
  description: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: colors.accent, fontSize: 11.5, fontWeight: "600" },
});
