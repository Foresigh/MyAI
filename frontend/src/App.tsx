import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ChatPage } from "./pages/ChatPage";
import { useTheme } from "./hooks/useTheme";
import { useGrantSync } from "./hooks/useGrantSync";

const PricingPage = lazy(() => import("./pages/PricingPage").then((m) => ({ default: m.PricingPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const ImageMakerPage = lazy(() => import("./pages/ImageMakerPage").then((m) => ({ default: m.ImageMakerPage })));
const VideoMakerPage = lazy(() => import("./pages/VideoMakerPage").then((m) => ({ default: m.VideoMakerPage })));

export default function App() {
  useTheme();
  useGrantSync();

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/c/:conversationId" element={<ChatPage />} />
            <Route path="/images" element={<ImageMakerPage />} />
            <Route path="/videos" element={<VideoMakerPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
