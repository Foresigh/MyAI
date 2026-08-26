import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { MessageList } from "../components/chat/MessageList";
import { Composer } from "../components/chat/Composer";
import { WelcomeScreen } from "../components/chat/WelcomeScreen";
import { APP_NAME } from "../lib/brand";
import { useConversationStore } from "../store/conversationStore";
import { useChatStream } from "../hooks/useChatStream";
import type { Attachment } from "../types/chat";
import styles from "./ChatPage.module.css";

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const conversations = useConversationStore((s) => s.conversations);
  const createConversation = useConversationStore((s) => s.createConversation);

  const conversation = conversationId ? conversations.find((c) => c.id === conversationId) : undefined;
  const { send, regenerate, stop, isGenerating } = useChatStream();

  useEffect(() => {
    if (conversationId && !conversation) {
      navigate("/", { replace: true });
    }
  }, [conversationId, conversation, navigate]);

  const handleSend = async (text: string, attachments: Attachment[]) => {
    let targetId = conversationId;
    if (!targetId) {
      targetId = createConversation();
      navigate(`/c/${targetId}`, { replace: true });
    }
    await send(targetId, text, attachments);
  };

  const handleRegenerate = () => {
    if (conversationId) void regenerate(conversationId);
  };

  return (
    <div className={styles.page}>
      <TopBar title={conversation?.title ?? APP_NAME} />
      {conversation && conversation.messages.length > 0 ? (
        <MessageList messages={conversation.messages} isGenerating={isGenerating} onRegenerate={handleRegenerate} />
      ) : (
        <WelcomeScreen onPick={(prompt) => handleSend(prompt, [])} />
      )}
      <Composer onSend={handleSend} onStop={stop} isGenerating={isGenerating} />
    </div>
  );
}
