import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface PickedImage {
  /** Local file to show in the chat. */
  uri: string;
  /** Shrunk JPEG to send to Arvo. Not saved with chat history. */
  dataUrl: string;
}

const MAX_SIDE = 1280;

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const longest = Math.max(asset.width || MAX_SIDE, asset.height || MAX_SIDE);
  const context = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return { uri: saved.uri, dataUrl: `data:image/jpeg;base64,${saved.base64}` };
}

/** Lets the user pick up to `limit` pictures. Returns [] if they cancel or deny access. */
export async function pickImages(limit: number): Promise<PickedImage[]> {
  if (limit <= 0) return [];
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Arvo needs access to your photos to attach a picture. You can allow it in Settings.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, limit).map(shrink));
}

/** Takes a photo with the camera. Returns null if cancelled. */
export async function takePhoto(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Arvo needs camera access to take a picture. You can allow it in Settings.");
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  return shrink(result.assets[0]);
}
