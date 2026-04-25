import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import type { ChatMessage, Conversation } from "../types/chat";
import {
  fetchMessages,
  sendMessage,
  markMessageAsRead,
  getOrCreateConversation,
} from "../api/chat";

export function useChat(participantBId?: string) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!participantBId) return;

    const initConversation = async () => {
      try {
        const conv = await getOrCreateConversation(participantBId);
        setConversation(conv);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create conversation",
        );
      }
    };

    initConversation();
  }, [participantBId]);

  useEffect(() => {
    if (!conversation) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const msgs = await fetchMessages(conversation.id);
        setMessages(msgs);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          for (const msg of msgs) {
            if (!msg.read_at && msg.sender_id !== user.id) {
              await markMessageAsRead(msg.id);
            }
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    const channel = supabase
      .channel(`chat_messages_${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const send = useCallback(
    async (content: string) => {
      if (!conversation) return;

      setSending(true);
      try {
        const newMessage = await sendMessage(conversation.id, content);
        setMessages((prev) => [...prev, newMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setSending(false);
      }
    },
    [conversation?.id],
  );

  return {
    conversation,
    messages,
    loading,
    sending,
    error,
    send,
  };
}
