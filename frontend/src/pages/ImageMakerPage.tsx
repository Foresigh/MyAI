import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { PromptComposer } from "../components/common/PromptComposer";
import { ImageSettingsPanel } from "../components/image/ImageSettingsPanel";
import { ImageResultGrid } from "../components/image/ImageResultGrid";
import { ImageHistoryGrid } from "../components/image/ImageHistoryGrid";
import { ImageLightbox } from "../components/image/ImageLightbox";
import { generateImages } from "../lib/imageApi";
import { ChatApiError } from "../lib/api";
import { useImageStore } from "../store/imageStore";
import type { GeneratedImageItem, ImageGenerationSettings } from "../types/image";
import styles from "../components/image/ImageMaker.module.css";

const DEFAULT_SETTINGS: ImageGenerationSettings = {
  aspectRatio: "1:1",
  numImages: 1,
  quality: "standard",
  style: "none",
};

export function ImageMakerPage() {
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<ImageGenerationSettings>(DEFAULT_SETTINGS);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [currentResults, setCurrentResults] = useState<GeneratedImageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const history = useImageStore((s) => s.history);
  const addImages = useImageStore((s) => s.addImages);
  const removeImage = useImageStore((s) => s.removeImage);

  const runGeneration = async (
    generationPrompt: string,
    generationSettings: ImageGenerationSettings,
    generationReference: string | null
  ) => {
    setError(null);
    setIsGenerating(true);
    try {
      const dataUrls = await generateImages({
        prompt: generationPrompt,
        ...generationSettings,
        referenceImage: generationReference,
      });
      const items = addImages(dataUrls, generationPrompt, generationSettings);
      setCurrentResults(items);
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => runGeneration(prompt, settings, referenceImage);
  const handleClear = () => setPrompt("");

  const handleRegenerate = (item: GeneratedImageItem) => {
    setPrompt(item.prompt);
    setSettings(item.settings);
    void runGeneration(item.prompt, item.settings, referenceImage);
  };

  const handleCreateVariation = (item: GeneratedImageItem) => {
    setReferenceImage(item.dataUrl);
    void runGeneration(item.prompt, item.settings, item.dataUrl);
  };

  const handleDelete = (id: string) => {
    removeImage(id);
    setCurrentResults((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div className={styles.page}>
      <TopBar title="Image Maker" />
      <div className={styles.content}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <PromptComposer
              value={prompt}
              onChange={setPrompt}
              onGenerate={handleGenerate}
              onClear={handleClear}
              isGenerating={isGenerating}
              placeholder="Describe the image you want to create..."
            />

            {error && (
              <div className={styles.errorBanner}>
                <TriangleAlert size={15} />
                {error}
              </div>
            )}

            <div className={styles.resultSection}>
              <h3 className={styles.sectionTitle}>Result</h3>
              <ImageResultGrid
                items={currentResults}
                pendingCount={isGenerating ? settings.numImages : 0}
                onOpen={setLightboxSrc}
                onDelete={handleDelete}
                onUseAsReference={setReferenceImage}
                onCreateVariation={handleCreateVariation}
                onRegenerate={handleRegenerate}
              />
            </div>

            {history.length > 0 && (
              <div className={styles.resultSection}>
                <h3 className={styles.sectionTitle}>History</h3>
                <ImageHistoryGrid items={history} onOpen={setLightboxSrc} />
              </div>
            )}
          </div>

          <ImageSettingsPanel
            settings={settings}
            onChange={setSettings}
            referenceImage={referenceImage}
            onReferenceImageChange={setReferenceImage}
          />
        </div>
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
