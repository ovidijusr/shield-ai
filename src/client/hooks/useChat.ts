/**
 * useChat Hook
 *
 * React Query hook for chat operations with SSE streaming support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../shared/types';

const AUTH_TOKEN = (import.meta as any).env?.VITE_SHIELDAI_TOKEN || '';
const CHAT_STORAGE_KEY = 'shieldai_chat_history';

interface UseChatOptions {
  onError?: (error: Error) => void;
}

/**
 * Load chat history from localStorage
 */
function loadChatHistory(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load chat history:', error);
  }
  return [];
}

/**
 * Save chat history to localStorage
 */
function saveChatHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.warn('Failed to save chat history:', error);
  }
}

export function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadChatHistory);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;

      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingMessage('');

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Send request to chat endpoint with SSE
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
        };

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: userMessage.content,
            history: messages,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Check if response is SSE
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/event-stream')) {
          // Handle SSE streaming
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = '';

          if (!reader) {
            throw new Error('No response body reader available');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  // Stream complete
                  const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: accumulatedContent,
                    timestamp: new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                  setStreamingMessage('');
                  setIsLoading(false);
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    accumulatedContent += parsed.content;
                    setStreamingMessage(accumulatedContent);
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.warn('Failed to parse SSE data:', data);
                }
              }
            }
          }

          // If we exit the loop without [DONE], add the accumulated message
          if (accumulatedContent) {
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingMessage('');
          }
        } else {
          // Handle regular JSON response (fallback)
          const data = await response.json();
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: data.content || data.message || 'No response',
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            // Request was cancelled
            return;
          }
          options?.onError?.(error);

          // Add error message
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error.message}`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } finally {
        setIsLoading(false);
        setStreamingMessage('');
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, options]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingMessage('');
  }, []);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setStreamingMessage('');
  }, []);

  return {
    messages,
    streamingMessage,
    isLoading,
    sendMessage,
    clearMessages,
    cancelStream,
  };
}
