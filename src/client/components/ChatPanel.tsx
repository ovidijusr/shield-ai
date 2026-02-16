/**
 * ChatPanel Component
 *
 * Conversational AI advisor interface with streaming support.
 */

import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Loader2, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ChatMessage } from '../../shared/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

interface ChatPanelProps {
  /** Whether to render as mobile sheet (slide-out) */
  mobile?: boolean;
  /** Custom className */
  className?: string;
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex mb-4', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
          isStreaming && 'animate-pulse'
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
            components={{
              // Custom styling for code blocks
              code({ node, inline, className, children, ...props }: any) {
                return inline ? (
                  <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs" {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={cn('block text-xs', className)} {...props}>
                    {children}
                  </code>
                );
              },
              // Custom styling for links
              a({ node, children, ...props }: any) {
                return (
                  <a
                    className="text-blue-500 hover:text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {!isStreaming && (
          <p className="text-xs opacity-50 mt-2">
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

function ChatContent() {
  const { messages, streamingMessage, isLoading, sendMessage, clearMessages, cancelStream } = useChat();
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, streamingMessage]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Suggested action examples
  const suggestedActions = messages.length === 0 ? [
    'Explain the security findings',
    'What are the most critical issues?',
    'How do I fix privileged containers?',
  ] : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle className="text-lg">AI Security Advisor</CardTitle>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Messages area */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea ref={scrollAreaRef} className="h-full px-4 py-4">
          {messages.length === 0 && !streamingMessage && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm mb-2">
                Ask me anything about your Docker security findings
              </p>
              <p className="text-xs">
                I can explain risks, suggest fixes, and provide guidance
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}

          {streamingMessage && (
            <MessageBubble
              message={{
                role: 'assistant',
                content: streamingMessage,
                timestamp: new Date().toISOString(),
              }}
              isStreaming
            />
          )}

          {isLoading && !streamingMessage && (
            <div className="flex items-center justify-start mb-4">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Suggested actions */}
      {suggestedActions.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Suggested:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => {
                  setInput(action);
                  textareaRef.current?.focus();
                }}
              >
                {action}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <CardFooter className="p-4 border-t">
        <div className="flex gap-2 w-full">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your security findings..."
            className="min-h-[40px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              variant="outline"
              size="icon"
              onClick={cancelStream}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </div>
  );
}

export function ChatPanel({ mobile = false, className }: ChatPanelProps) {
  const [open, setOpen] = useState(false);

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>AI Security Advisor</SheetTitle>
            <SheetDescription>
              Get instant help with your security findings
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <Card className="h-full border-0 rounded-none">
              <ChatContent />
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <ChatContent />
    </Card>
  );
}
