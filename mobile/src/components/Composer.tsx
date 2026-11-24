import { useState } from "react";
import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MAX_IMAGES_PER_MESSAGE } from "../lib/config";
import { pickImages, takePhoto, type PickedImage } from "../lib/images";
import type { ChatImage } from "../lib/store";
import { colors, radius } from "../lib/theme";

interface Props {
  isGenerating: boolean;
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
}

export function Composer({ isGenerating, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const canSend = (text.trim().length > 0 || images.length > 0) && !isGenerating;

  const add = async (source: "library" | "camera") => {
    try {
      if (source === "camera") {
        const photo = await takePhoto();
        if (photo) setImages((prev) => [...prev, photo].slice(0, MAX_IMAGES_PER_MESSAGE));
      } else {
        const picked = await pickImages(MAX_IMAGES_PER_MESSAGE - images.length);
        setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES_PER_MESSAGE));
      }
    } catch (err) {
      Alert.alert("Can't add picture", (err as Error).message);
    }
  };

  const chooseSource = () => {
    if (images.length >= MAX_IMAGES_PER_MESSAGE) {
      Alert.alert("Picture limit", `You can attach up to ${MAX_IMAGES_PER_MESSAGE} pictures per message.`);
      return;
    }
    if (Platform.OS === "web") return void add("library");
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Take photo", "Choose from library", "Cancel"], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) void add("camera");
          if (i === 1) void add("library");
        }
      );
      return;
    }
    Alert.alert("Add a picture", undefined, [
      { text: "Take photo", onPress: () => void add("camera") },
      { text: "Choose from library", onPress: () => void add("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), images.map(({ uri, dataUrl }) => ({ uri, dataUrl })));
    setText("");
    setImages([]);
  };

  return (
    <View style={styles.wrap}>
      {images.length > 0 && (
        <View style={styles.previews}>
          {images.map((img, i) => (
            <View key={img.uri}>
              <Image source={{ uri: img.uri }} style={styles.preview} />
              <Pressable
                style={styles.remove}
                onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                accessibilityLabel="Remove picture"
                hitSlop={6}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <Pressable style={styles.iconButton} onPress={chooseSource} accessibilityLabel="Add a picture" hitSlop={6}>
          <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message Arvo…"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={8000}
        />
        {isGenerating ? (
          <Pressable style={[styles.send, styles.stop]} onPress={onStop} accessibilityLabel="Stop">
            <Ionicons name="square" size={14} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={submit}
            disabled={!canSend}
            accessibilityLabel="Send"
          >
            <Ionicons name="arrow-up" size={19} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    margin: 10,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 8,
  },
  previews: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingTop: 4 },
  preview: { width: 56, height: 56, borderRadius: radius.md },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  iconButton: { padding: 6, paddingBottom: 8 },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    maxHeight: 140,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.35 },
  stop: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
});
