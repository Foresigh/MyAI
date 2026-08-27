import { useMemo, useState } from "react";
import clsx from "clsx";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  Search,
  Trash2,
  Settings as SettingsIcon,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  Film,
  X,
} from "lucide-react";
import { APP_NAME } from "../../lib/brand";
import { useConversationStore } from "../../store/conversationStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { PLAN_DEFINITIONS } from "../../types/plans";
import { IconButton } from "../common/IconButton";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  onOpenSettings: () => void;
}

type Mode = "chat" | "images" | "videos";

function useMode(): Mode {
  const location = useLocation();
  if (location.pathname.startsWith("/images")) return "images";
  if (location.pathname.startsWith("/videos")) return "videos";
  return "chat";
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [query, setQuery] = useState("");
  const mode = useMode();

  const conversations = useConversationStore((s) => s.conversations);
  const createConversation = useConversationStore((s) => s.createConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);

  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const email = useSettingsStore((s) => s.email);
  const effectivePlan = useSettingsStore((s) => s.effectivePlan());

  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const closeMobileSidebar = useUiStore((s) => s.closeMobileSidebar);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, query]);

  const handleNewChat = () => {
    const id = createConversation();
    navigate(`/c/${id}`);
    closeMobileSidebar();
  };

  const handleNavigate = (id: string) => {
    navigate(`/c/${id}`);
    closeMobileSidebar();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    deleteConversation(id);
    if (conversationId === id) navigate("/");
  };

  const goTo = (path: string) => {
    navigate(path);
    closeMobileSidebar();
  };

  const modeTabs = (
    <div className={styles.modeTabs}>
      <button
        className={mode === "chat" ? `${styles.modeTab} ${styles.modeTabActive}` : styles.modeTab}
        onClick={() => goTo("/")}
      >
        <MessageSquare size={14} />
        Chat
      </button>
      <button
        className={mode === "images" ? `${styles.modeTab} ${styles.modeTabActive}` : styles.modeTab}
        onClick={() => goTo("/images")}
      >
        <ImageIcon size={14} />
        Images
      </button>
      <button
        className={mode === "videos" ? `${styles.modeTab} ${styles.modeTabActive}` : styles.modeTab}
        onClick={() => goTo("/videos")}
      >
        <Film size={14} />
        Video
      </button>
    </div>
  );

  if (collapsed && !mobileOpen) {
    return (
      <aside className={styles.collapsedRail}>
        <button className={styles.brandMark} onClick={() => navigate("/")} aria-label={`${APP_NAME} home`}>
          <Sparkles size={18} />
        </button>
        <IconButton label="Expand sidebar" onClick={toggleSidebar}>
          <PanelLeftOpen size={18} />
        </IconButton>
        <IconButton label="Chat" active={mode === "chat"} onClick={() => goTo("/")}>
          <MessageSquare size={17} />
        </IconButton>
        <IconButton label="Image Maker" active={mode === "images"} onClick={() => goTo("/images")}>
          <ImageIcon size={17} />
        </IconButton>
        <IconButton label="Video Maker" active={mode === "videos"} onClick={() => goTo("/videos")}>
          <Film size={17} />
        </IconButton>
        {mode === "chat" && (
          <IconButton label="New chat" onClick={handleNewChat}>
            <SquarePen size={18} />
          </IconButton>
        )}
        <div className={styles.railSpacer} />
        <IconButton label="Settings" onClick={onOpenSettings}>
          <SettingsIcon size={18} />
        </IconButton>
      </aside>
    );
  }

  return (
    <>
      <div
        className={clsx(styles.backdrop, mobileOpen && styles.backdropVisible)}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />
      <aside className={clsx(styles.sidebar, mobileOpen && styles.mobileOpen)}>
      <div className={styles.header}>
        <button className={styles.brand} onClick={() => navigate("/")}>
          <span className={styles.brandMark}>
            <Sparkles size={16} />
          </span>
          <span className={styles.brandName}>{APP_NAME}</span>
        </button>
        <IconButton label="Collapse sidebar" onClick={toggleSidebar} className={styles.desktopOnly}>
          <PanelLeftClose size={18} />
        </IconButton>
        <IconButton label="Close menu" onClick={closeMobileSidebar} className={styles.mobileOnly}>
          <X size={18} />
        </IconButton>
      </div>

      {modeTabs}

      {mode === "chat" ? (
        <>
          <button className={styles.newChat} onClick={handleNewChat}>
            <SquarePen size={16} />
            New chat
          </button>

          <div className={styles.search}>
            <Search size={14} className={styles.searchIcon} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
          </div>

          <nav className={styles.history} aria-label="Conversation history">
            {filtered.length === 0 && (
              <p className={styles.empty}>{query ? "No matches." : "No conversations yet."}</p>
            )}
            {filtered.map((c) => (
              <a
                key={c.id}
                href={`/c/${c.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate(c.id);
                }}
                className={c.id === conversationId ? `${styles.item} ${styles.itemActive}` : styles.item}
              >
                <MessageSquare size={14} className={styles.itemIcon} />
                <span className={styles.itemTitle}>{c.title}</span>
                <button
                  className={styles.itemDelete}
                  onClick={(e) => handleDelete(e, c.id)}
                  aria-label={`Delete conversation ${c.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </a>
            ))}
          </nav>
        </>
      ) : (
        <div className={styles.modeDescription}>
          {mode === "images"
            ? "Describe an image and Arvo will generate it. Your results and history live on the right."
            : "Describe a scene and Arvo will generate a short video. Generation can take a few minutes."}
        </div>
      )}

      <div className={styles.footer}>
        <button className={styles.profile} onClick={onOpenSettings}>
          <span className={styles.avatar}>{(email || "G").charAt(0).toUpperCase()}</span>
          <span className={styles.profileMeta}>
            <span className={styles.profileEmail}>{email || "Guest"}</span>
            <span className={styles.profilePlan}>{PLAN_DEFINITIONS[effectivePlan].name} plan</span>
          </span>
          <SettingsIcon size={16} />
        </button>
      </div>
      </aside>
    </>
  );
}
