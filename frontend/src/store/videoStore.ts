import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GeneratedVideoItem } from "../types/video";

const MAX_HISTORY = 50;

interface VideoState {
  history: GeneratedVideoItem[];
  addJob: (item: GeneratedVideoItem) => void;
  updateJob: (id: string, updates: Partial<GeneratedVideoItem>) => void;
  removeJob: (id: string) => void;
  clearHistory: () => void;
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set) => ({
      history: [],

      addJob: (item) => {
        set((state) => ({ history: [item, ...state.history].slice(0, MAX_HISTORY) }));
      },

      updateJob: (id, updates) => {
        set((state) => ({
          history: state.history.map((job) => (job.id === id ? { ...job, ...updates } : job)),
        }));
      },

      removeJob: (id) => {
        set((state) => ({ history: state.history.filter((job) => job.id !== id) }));
      },

      clearHistory: () => set({ history: [] }),
    }),
    { name: "arvo-video-history" }
  )
);
