import { useEffect, useRef } from "react";

export default function TranscriptPanel({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        Transcript will appear here...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex gap-3 ${msg.role === "agent" ? "" : "flex-row-reverse"}`}
        >
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              msg.role === "agent"
                ? "bg-neutral-800 text-neutral-400"
                : "bg-white text-black"
            }`}
          >
            {msg.role === "agent" ? "A" : "Y"}
          </div>
          <div
            className={`max-w-[80%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
              msg.role === "agent"
                ? "bg-neutral-900 text-neutral-300 border border-neutral-800"
                : "bg-neutral-800 text-white"
            }`}
          >
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
