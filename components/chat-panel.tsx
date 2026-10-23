"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { SendHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Same four for every lead.
const QUICK_PROMPTS = [
  "Draft a follow-up message",
  "What should I emphasize on my next call?",
  "Help me handle their objection",
  "Summarize this lead for my manager",
];

// Styles for the Markdown the assistant writes (no typography plugin here).
const MARKDOWN_STYLES = [
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-3 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold",
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-3 [&_hr]:border-border",
  "[&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1",
].join(" ");

function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

/** Loads the saved history for a lead, then hands off to the live chat. */
export function ChatPanel({ leadId }: { leadId: number }) {
  const [loaded, setLoaded] = useState<{
    leadId: number;
    messages: UIMessage[] | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/chat/${leadId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((messages: UIMessage[]) => setLoaded({ leadId, messages }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ leadId, messages: null });
      });
    return () => controller.abort();
  }, [leadId]);

  if (loaded?.leadId !== leadId) {
    return <p className="text-sm text-muted-foreground">Loading chat…</p>;
  }
  if (!loaded.messages) {
    return (
      <p className="text-sm text-muted-foreground">Couldn’t load the chat.</p>
    );
  }
  return (
    <ChatSession
      key={leadId}
      leadId={leadId}
      initialMessages={loaded.messages}
    />
  );
}

function ChatSession({
  leadId,
  initialMessages,
}: {
  leadId: number;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/chat/${leadId}`,
        // The server loads the history itself; it only needs the new message.
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          return { body: { text: last ? messageText(last) : "" } };
        },
      }),
    [leadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: `lead-${leadId}`,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[calc(100dvh-11.5rem)] min-h-80 flex-col gap-3">
      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask about this lead. Answers use only the lead’s own data: the
            intake form, the customer’s message, logged calls, and the analysis.
          </p>
        )}
        {messages.map((message) => {
          const text = messageText(message);
          if (!text) return null;
          const mine = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                  mine
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : cn("bg-muted", MARKDOWN_STYLES),
                )}
              >
                {mine ? (
                  text
                ) : (
                  // Images and links are dropped: the model's output is shaped
                  // by untrusted customer text, and an image URL would be
                  // fetched by the browser as soon as it rendered.
                  <ReactMarkdown
                    disallowedElements={["img", "a"]}
                    unwrapDisallowed
                  >
                    {text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}
        {status === "submitted" && (
          <p className="text-sm italic text-muted-foreground">Thinking…</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Couldn’t get an answer. Please try again.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => send(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          aria-label="Message"
          placeholder="Ask about this lead…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={busy || input.trim() === ""}
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
