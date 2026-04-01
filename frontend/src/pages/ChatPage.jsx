import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Database, Bot, User, CalendarCheck } from "lucide-react";
import { sendChatMessage, upsertChatLead } from "../api";

const CAL_LINK = "https://cal.com/ceo-fastship/15min";

// Lead collection steps before chat opens
const LEAD_STEPS = [
  { key: "name",  question: "Hi! I'm the LSSU AI Assistant. Before we begin, could you tell me your name?" },
  { key: "phone", question: (name) => `Nice to meet you, ${name}! What's your phone number?` },
  { key: "email", question: "And your email address?" },
];

function Message({ role, content, ragUsed, suggestCall }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-white" : "bg-neutral-800 border border-neutral-700"
      }`}>
        {isUser ? <User className="w-4 h-4 text-black" /> : <Bot className="w-4 h-4 text-neutral-300" />}
      </div>

      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-white text-black rounded-tr-sm"
            : "bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-tl-sm"
        }`}>
          {content}
        </div>
        {!isUser && suggestCall && (
          <a href={CAL_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors">
            <CalendarCheck className="w-4 h-4" />
            Book a 15-min call
          </a>
        )}
        {!isUser && ragUsed && !suggestCall && (
          <div className="flex items-center gap-1 text-xs text-neutral-600">
            <Database className="w-3 h-3" />
            <span>Knowledge base used</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-neutral-300" />
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: LEAD_STEPS[0].question },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Lead collection state: 0=asking name, 1=asking phone, 2=asking email, 3=done
  const [leadStep, setLeadStep] = useState(0);
  const [lead, setLead] = useState({ name: "", phone: "", email: "" });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sessionId = useRef(`chat-${Date.now()}`);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [leadStep]);

  const addMessage = (role, content, extras = {}) => {
    setMessages((prev) => [...prev, { role, content, ...extras }]);
  };

  const handleLeadStep = (text) => {
    const updated = { ...lead };

    if (leadStep === 0) {
      updated.name = text;
      setLead(updated);
      addMessage("user", text);
      upsertChatLead(sessionId.current, { name: text });
      const q = typeof LEAD_STEPS[1].question === "function"
        ? LEAD_STEPS[1].question(text)
        : LEAD_STEPS[1].question;
      setTimeout(() => addMessage("assistant", q), 400);
      setLeadStep(1);
    } else if (leadStep === 1) {
      updated.phone = text;
      setLead(updated);
      addMessage("user", text);
      upsertChatLead(sessionId.current, { phone: text });
      setTimeout(() => addMessage("assistant", LEAD_STEPS[2].question), 400);
      setLeadStep(2);
    } else if (leadStep === 2) {
      updated.email = text;
      setLead(updated);
      addMessage("user", text);
      upsertChatLead(sessionId.current, { email: text });
      setTimeout(() => addMessage("assistant",
        `Thanks ${updated.name}! How can I help you today?`
      ), 400);
      setLeadStep(3);
    }
  };

  const sendChat = async (text) => {
    addMessage("user", text);
    setLoading(true);
    try {
      const history = messages
        .filter((_, i) => i > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChatMessage(text, history, sessionId.current, lead);
      addMessage("assistant", res.reply, { ragUsed: res.rag_used, suggestCall: res.suggest_call });
    } catch {
      addMessage("assistant", "Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    if (leadStep < 3) {
      handleLeadStep(text);
    } else {
      sendChat(text);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder =
    leadStep === 0 ? "Your name..." :
    leadStep === 1 ? "Your phone number..." :
    leadStep === 2 ? "Your email address..." :
    "Ask anything about LSSU...";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-800 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">AI Assistant</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Ask questions · Backed by your knowledge base</p>
        </div>
        {leadStep === 3 && (
          <div className="text-right">
            <p className="text-xs text-neutral-400">{lead.name}</p>
            <p className="text-xs text-neutral-600">{lead.email}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content}
            ragUsed={msg.ragUsed} suggestCall={msg.suggestCall} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-neutral-800 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-neutral-700 mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
