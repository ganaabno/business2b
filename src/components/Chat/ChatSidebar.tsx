import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import CalculatorModal from './CalculatorModal';
import UserSelectorModal from './UserSelectorModal';
import type { PriceConfig, ChatMessage, Conversation } from '../../types/chat';
import { fetchPriceConfigs } from '../../api/chat';

interface ChatSidebarProps {
  currentUser: {
    id: string;
    email?: string;
    name?: string;
  } | null;
}

interface EnrichedConversation extends Conversation {
  participant: {
    id: string;
    email: string;
    name?: string;
  };
  lastMessage?: {
    content: string;
    created_at: string;
  };
  unreadCount: number;
}

interface EnrichedConversation extends Conversation {
  participant: {
    id: string;
    email: string;
    name?: string;
  };
  lastMessage?: {
    content: string;
    created_at: string;
  };
  unreadCount: number;
}

export default function ChatSidebar({ currentUser }: ChatSidebarProps) {
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [selectedConversation, setSelectedConversation] = useState<EnrichedConversation | null>(null);
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [priceConfigs, setPriceConfigs] = useState<PriceConfig[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await fetchPriceConfigs();
        setPriceConfigs(configs);
      } catch (err) {
        console.error('Failed to load price configs:', err);
      }
    };
    loadConfigs();
  }, []);

  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      try {
        const { supabase } = await import('../../supabaseClient');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('chat_conversations')
          .select('*')
          .or(`participant_a_id.eq.${user.id},participant_b_id.eq.${user.id}`)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const enriched: EnrichedConversation[] = await Promise.all(
          (data || []).map(async (conv) => {
            const partnerId = conv.participant_a_id === user.id 
              ? conv.participant_b_id 
              : conv.participant_a_id;

            const { data: partnerData } = await supabase
              .from('users')
              .select('id, email, name')
              .eq('id', partnerId)
              .single();

            const { data: lastMsg } = await supabase
              .from('chat_messages')
              .select('content, created_at')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .neq('sender_id', user.id)
              .is('read_at', null);

            return {
              ...conv,
              participant: {
                id: partnerId,
                email: partnerData?.email || 'Unknown',
                name: partnerData?.name || undefined,
              },
              lastMessage: lastMsg ? { content: lastMsg.content, created_at: lastMsg.created_at } : undefined,
              unreadCount: count || 0,
            };
          })
        );

        setConversations(enriched);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', selectedConversation.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('chat_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('conversation_id', selectedConversation.id)
            .neq('sender_id', user.id)
            .is('read_at', null);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    const channel = supabase
      .channel(`chat_${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload: any) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);

  const handleSelectConversation = (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
      setSelectedConversation(conv);
      setView('chat');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content,
          message_type: 'text',
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);

      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleSendQuote = async (quoteText: string) => {
    if (!selectedConversation) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content: quoteText,
          message_type: 'price_quote',
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
    } catch (err) {
      console.error('Failed to send quote:', err);
    }
  };

  const handleNewChat = () => {
    setShowUserSelector(true);
  };

  const handleUserSelected = async (userId: string, userEmail: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('*')
        .or(`and(participant_a_id.eq.${user.id},participant_b_id.eq.${userId}),and(participant_a_id.eq.${userId},participant_b_id.eq.${user.id})`)
        .single();

      if (existing) {
        const conv: EnrichedConversation = {
          ...existing,
          participant: {
            id: userId,
            email: userEmail,
          },
          unreadCount: 0,
        };
        setSelectedConversation(conv);
        setView('chat');
      } else {
        const { data: newConv, error } = await supabase
          .from('chat_conversations')
          .insert({
            participant_a_id: user.id,
            participant_b_id: userId,
          })
          .select()
          .single();

        if (error) throw error;

        const conv: EnrichedConversation = {
          ...newConv,
          participant: {
            id: userId,
            email: userEmail,
          },
          unreadCount: 0,
        };
        setSelectedConversation(conv);
        setView('chat');
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    } finally {
      setShowUserSelector(false);
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setView('list');
  };

  return (
    <div className="flex h-full bg-white rounded-xl overflow-hidden border border-gray-200">
      {view === 'list' ? (
        <div className="w-full md:w-80 lg:w-96 border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Чат
            </h2>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id || null}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </div>
      ) : (
        <>
          <div className="flex-1">
            <ChatWindow
              messages={messages}
              currentUserId={currentUser?.id}
              recipientName={selectedConversation?.participant.name || selectedConversation?.participant.email.split('@')[0] || 'Unknown'}
              onSend={handleSendMessage}
              onOpenCalculator={() => setShowCalculator(true)}
              loading={loading}
            />
          </div>

          <button
            onClick={handleBack}
            className="absolute top-4 left-4 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors md:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </>
      )}

      <CalculatorModal
        configs={priceConfigs}
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onSendQuote={handleSendQuote}
      />

      <UserSelectorModal
        isOpen={showUserSelector}
        onClose={() => setShowUserSelector(false)}
        onSelect={handleUserSelected}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
