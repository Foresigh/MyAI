import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createId } from "../lib/id";
import type { GeneratedImageItem, ImageGenerationSettings } from "../types/image";

const MAX_HISTORY = 30; // data URLs are large; cap to stay well under localStorage quota

interface ImageState {
  history: GeneratedImageItem[];
  addImages: (dataUrls: string[], prompt: string, settings: ImageGenerationSettings) => GeneratedImageItem[];
  removeImage: (id: string) => void;
  clearHistory: () => void;
}

export const useImageStore = create<ImageState>()(
  persist(
    (set) => ({
      history: [],

      addImages: (dataUrls, prompt, settings) => {
        const items: GeneratedImageItem[] = dataUrls.map((dataUrl) => ({
          id: createId(),
          dataUrl,
          prompt,
          settings,
          createdAt: Date.now(),
        }));
        set((state) => ({ history: [...items, ...state.history].slice(0, MAX_HISTORY) }));
        return items;
      },

      removeImage: (id) => {
        set((state) => ({ history: state.history.filter((img) => img.id !== id) }));
      },

      clearHistory: () => set({ history: [] }),
    }),
    { name: "arvo-image-history" }
  )
);
