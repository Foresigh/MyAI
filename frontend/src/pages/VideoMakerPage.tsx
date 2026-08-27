import { useRef, useState } from "react";
import { Sparkles, TriangleAlert } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { PromptComposer } from "../components/common/PromptComposer";
import { VideoSettingsPanel } from "../components/video/VideoSettingsPanel";
import { VideoResultCard } from "../components/video/VideoResultCard";
import { VideoHistoryGrid } from "../components/video/VideoHistoryGrid";
import { startVideoGeneration, pollVideoUntilDone } from "../lib/videoApi";
import { ChatApiError } from "../lib/api";
import { createId } from "../lib/id";
import { useVideoStore } from "../store/videoStore";
import type { GeneratedVideoItem, VideoGenerationSettings } from "../types/video";
import styles from "../components/video/VideoMaker.module.css";

const DEFAULT_SETTINGS: VideoGenerationSettings = {
  aspectRatio: "16:9",
  duration: 5,
  quality: "standard",
};

export function VideoMakerPage() {
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<VideoGenerationSettings>(DEFAULT_SETTINGS);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<GeneratedVideoItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const history = useVideoStore((s) => s.history);
  const addJob = useVideoStore((s) => s.addJob);
  const updateJob = useVideoStore((s) => s.updateJob);
  const removeJob = useVideoStore((s) => s.removeJob);

  const isGenerating = currentItem?.status === "pending" || currentItem?.status === "processing";

  const runGeneration = async (
    generationPrompt: string,
    generationSettings: VideoGenerationSettings,
    generationReference: string | null
  ) => {
    setError(null);
    const localId = createId();
    const placeholder: GeneratedVideoItem = {
      id: localId,
      jobId: "",
      status: "pending",
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      prompt: generationPrompt,
      settings: generationSettings,
      createdAt: Date.now(),
    };
    setCurrentItem(placeholder);
    addJob(placeholder);

    abortRef.current = new AbortController();

    try {
      const started = await startVideoGeneration({
        prompt: generationPrompt,
        ...generationSettings,
        referenceImage: generationReference,
      });
      updateJob(localId, { jobId: started.jobId, status: started.status });
      setCurrentItem((prev) => (prev ? { ...prev, jobId: started.jobId, status: started.status } : prev));

      const final = await pollVideoUntilDone(
        started.jobId,
        (update) => {
          const patch = {
            status: update.status,
            videoUrl: update.videoUrl,
            thumbnailUrl: update.thumbnailUrl,
            progress: update.progress,
          };
          updateJob(localId, patch);
          setCurrentItem((prev) => (prev ? { ...prev, ...patch } : prev));
        },
        abortRef.current.signal
      );

      if (final.status === "failed") {
        updateJob(localId, { status: "failed", error: final.error ?? "Video generation failed." });
        setCurrentItem((prev) => (prev ? { ...prev, status: "failed", error: final.error ?? undefined } : prev));
      }
    } catch (err) {
      const message = err instanceof ChatApiError ? err.message : "Video generation failed.";
      setError(message);
      updateJob(localId, { status: "failed", error: message });
      setCurrentItem((prev) => (prev ? { ...prev, status: "failed", error: message } : prev));
    }
  };

  const handleGenerate = () => void runGeneration(prompt, settings, referenceImage);
  const handleClear = () => setPrompt("");

  const handleRegenerate = (item: GeneratedVideoItem) => {
    setPrompt(item.prompt);
    setSettings(item.settings);
    void runGeneration(item.prompt, item.settings, referenceImage);
  };

  const handleCreateVariation = (item: GeneratedVideoItem) => {
    void runGeneration(item.prompt, item.settings, referenceImage);
  };

  const handleDelete = (id: string) => {
    removeJob(id);
    if (currentItem?.id === id) setCurrentItem(null);
  };

  return (
    <div className={styles.page}>
      <TopBar title="Video Maker" />
      <div className={styles.content}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <PromptComposer
              value={prompt}
              onChange={setPrompt}
              onGenerate={handleGenerate}
              onClear={handleClear}
              isGenerating={isGenerating}
              placeholder="Create a cinematic aerial shot of a futuristic city at sunset..."
              generateLabel="Generate video"
            />

            {error && (
              <div className={styles.errorBanner}>
                <TriangleAlert size={15} />
                {error}
              </div>
            )}

            <div className={styles.resultSection}>
              <h3 className={styles.sectionTitle}>Result</h3>
              {currentItem ? (
                <VideoResultCard
                  item={currentItem}
                  onRegenerate={handleRegenerate}
                  onDelete={handleDelete}
                  onCreateVariation={handleCreateVariation}
                />
              ) : (
                <div className={styles.emptyState}>
                  <Sparkles size={22} />
                  <h3>No videos yet</h3>
                  <p>Describe a scene and hit Generate — video generation typically takes a few minutes.</p>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className={styles.resultSection}>
                <h3 className={styles.sectionTitle}>History</h3>
                <VideoHistoryGrid items={history} onOpen={setCurrentItem} />
              </div>
            )}
          </div>

          <VideoSettingsPanel
            settings={settings}
            onChange={setSettings}
            referenceImage={referenceImage}
            onReferenceImageChange={setReferenceImage}
          />
        </div>
      </div>
    </div>
  );
}
