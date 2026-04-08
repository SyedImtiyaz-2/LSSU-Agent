import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Database, Bot, User, CalendarCheck } from "lucide-react";
import { sendChatMessage, upsertChatLead } from "../api";

const CAL_LINK = "https://cal.com/ceo-fastship/15min";

const ICP_OPTIONS = [
  { id: 1,  name: "Traditional Student",           full: "Traditional Prospective Student" },
  { id: 2,  name: "Transfer Student",              full: "Transfer Prospective Student" },
  { id: 3,  name: "Transfer Back Student",         full: "Transfer Back Prospective Student" },
  { id: 4,  name: "Canadian Student",              full: "Canadian Cross Border Student" },
  { id: 5,  name: "Charter School Student",        full: "Charter School Student" },
  { id: 6,  name: "Indigenous Scholar",            full: "Indigenous and Anishinaabe Scholar" },
  { id: 7,  name: "Cannabis / Chemistry",          full: "Cannabis Business & Chemistry Student" },
  { id: 8,  name: "Fisheries & Wildlife",          full: "Fisheries & Wildlife Student" },
  { id: 9,  name: "Fire Science",                  full: "Fire Science Student" },
  { id: 10, name: "Nursing",                       full: "Nursing Student" },
  { id: 11, name: "Robotics Engineering",          full: "Robotics Engineering Student" },
  { id: 12, name: "Hockey Athlete (Men's)",        full: "Collegiate Hockey Athlete (Men's)" },
  { id: 13, name: "Hockey Athlete (Women's)",      full: "Collegiate Hockey Athlete (Women's)" },
];

// ── Name extraction ───────────────────────────────────────────────────────

const NON_NAME_WORDS = new Set([
  "just","here","there","so","well","actually","basically","literally",
  "the","a","an","is","am","are","was","were","be","been",
  "hi","hello","hey","ok","okay","yes","no","sure","thanks","thank",
  "um","uh","hmm","oh","ah","and","or","but","not","also","too",
]);
const FILLER_PREFIX = /^(just|so|well|actually|basically|um|uh|oh|hi|hey|hello)\s+/i;

// Tier 1: fast regex extraction — returns name string or null
function extractNameRegex(text) {
  let t = text.trim().replace(/[.,!?]+$/, "").trim();
  // Strip leading social preamble before the name phrase
  t = t.replace(/^(?:hey\s+there|hi\s+there|hello\s+there|as\s+i\s+said|like\s+i\s+said|just\s+so\s+you\s+know|oh\s+hey|btw)[,!.]?\s*/i, "").trim();
  const prefixes = [
    /^(?:hi+[,!]?\s*|hello+[,!]?\s*|hey+[,!]?\s*)?(?:my name is|i(?:'m| am)|call me|it(?:'s| is)|this is|name(?:'s| is))\s+/i,
    /^(?:you can call me|people call me|everyone calls me)\s+/i,
  ];
  for (const re of prefixes) t = t.replace(re, "");
  t = t.trim();
  while (FILLER_PREFIX.test(t)) t = t.replace(FILLER_PREFIX, "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3) return null;
  if (!words.every(w => /^[a-zA-Z'-]+$/.test(w))) return null;
  if (words.some(w => NON_NAME_WORDS.has(w.toLowerCase()))) return null;
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// Tier 2: LLM extraction via backend — async, used when regex returns null
async function extractNameLLM(text) {
  try {
    const res = await fetch("/api/utils/extract-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.name || null;
  } catch {
    return null;
  }
}

// Combined: try regex first (instant), fall back to LLM if uncertain.
// Returns { name: string|null, confident: boolean }
//   confident=true  → regex matched, skip confirmation
//   confident=false → LLM matched, show confirmation
async function extractName(text) {
  const fast = extractNameRegex(text);
  if (fast !== null) return { name: fast, confident: true };
  const llm = await extractNameLLM(text);
  return { name: llm, confident: false };
}

// ── Contact validation helpers ────────────────────────────────────────────
function isValidPhone(text) {
  const digits = text.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits[0] === "1");
}

function isValidEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
}

// Detect if user typed a question instead of answering the lead prompt
// Returns: { isQuestion, nudge, isValidationError }
function detectIntent(text, step) {
  const t = text.trim();
  const questionWords = /^(what|who|how|why|when|where|is|are|can|does|do|tell|explain|which|will|would|could|should|give|show|list|compare|define|describe)\b/i;
  const hasQuestionMark = t.includes("?");
  const looksLikeQuestion = questionWords.test(t) || hasQuestionMark;

  if (step === 0) {
    // Name-introducing phrases override all other checks — let extraction handle it
    const hasNameIntro = /\b(?:my name is|i'?m|i am|call me|it'?s|this is|name(?:'s)? is)\s+[a-z]/i.test(t);
    if (hasNameIntro) return { isQuestion: false };
    const tooLong = t.split(" ").length > 4;
    const hasDigits = /\d/.test(t);
    if (looksLikeQuestion || (tooLong && !hasDigits))
      return { isQuestion: true, nudge: `I'd love to help with that! But first, could you share your name? 😊` };
  }

  if (step === 1) {
    if (looksLikeQuestion)
      return { isQuestion: true, nudge: `Happy to answer that once we get started! Just need your phone number first.` };
    // Has some digits but not a valid 10-digit number → validation error
    const hasDigits = /\d/.test(t);
    if (hasDigits && !isValidPhone(t))
      return { isQuestion: true, isValidationError: true, nudge: `That doesn't look like a valid phone number. Please enter a 10-digit US number — e.g. 906-555-1234.` };
    // No digits at all and not a question → treat as non-phone input
    if (!hasDigits)
      return { isQuestion: true, nudge: `I just need your phone number — digits only, e.g. 9065551234.` };
  }

  if (step === 2) {
    if (looksLikeQuestion)
      return { isQuestion: true, nudge: `Almost there! Could you drop your email address? Then we can dive right in.` };
    if (t.includes("@") && !isValidEmail(t))
      return { isQuestion: true, isValidationError: true, nudge: `That email doesn't look quite right. Try something like name@example.com.` };
    if (!t.includes("@"))
      return { isQuestion: true, nudge: `Almost there! Could you drop your email address? Then we can dive right in.` };
  }

  return { isQuestion: false };
}

// Lead collection steps before chat opens (text-based)
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

function IcpSelector({ onSelect }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-neutral-300" />
      </div>
      <div className="flex flex-col gap-2 max-w-[80%]">
        <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm bg-neutral-900 border border-neutral-800 text-neutral-100">
          Which program are you interested in?
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ICP_OPTIONS.map((icp) => (
            <button
              key={icp.id}
              onClick={() => onSelect(icp)}
              className="px-3 py-1.5 text-xs rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-white hover:text-black hover:border-white transition-all text-left"
            >
              {icp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const YES_RE  = /^(yes|yeah|yep|yup|correct|that'?s right|right|sure|ok|okay|confirmed?|👍|✓|y)\b/i;
const NO_RE   = /^(no|nope|wrong|incorrect|not quite|nah|change|different|n)\.?$/i;
// Matches explicit "I don't want to share" intent at phone/email steps
const SKIP_RE = /^(skip|pass|no thanks|nah|nope|none|n\/a|na|no phone|no email|no number|move on|continue|next|don'?t have|prefer not|rather not|not comfortable|no|without|decline|bypass)\.?$/i;

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: LEAD_STEPS[0].question },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // 0=name entry, 0.5=name confirm, 1=phone, 2=email, 3=icp, 4=chat
  const [leadStep, setLeadStep] = useState(0);
  const [lead, setLead] = useState({ name: "", phone: "", email: "", icp_id: null, icp_name: "" });
  const [pendingName, setPendingName] = useState(""); // extracted name awaiting confirm
  const [showIcpSelector, setShowIcpSelector] = useState(false);
  const [phoneAttempts, setPhoneAttempts] = useState(0);
  const [emailAttempts, setEmailAttempts] = useState(0);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sessionId = useRef(`chat-${Date.now()}`);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showIcpSelector]);

  useEffect(() => {
    if (leadStep !== 3) inputRef.current?.focus();
  }, [leadStep]);

  const addMessage = (role, content, extras = {}) => {
    setMessages((prev) => [...prev, { role, content, ...extras }]);
  };

  const handleLeadStep = async (text) => {
    addMessage("user", text);

    // ── Step 0: name entry ────────────────────────────────────────────────
    if (leadStep === 0) {
      const { isQuestion, nudge } = detectIntent(text, 0);
      if (isQuestion) {
        setTimeout(() => addMessage("assistant", nudge), 400);
        return;
      }
      setLoading(true);
      const { name: extracted, confident } = await extractName(text);
      setLoading(false);

      if (!extracted) {
        // Neither regex nor LLM found a name
        addMessage("assistant", `Could you share just your first name? For example: "Alex"`);
        return;
      }

      if (confident) {
        // Regex was sure — accept directly, no confirmation needed
        const updated = { ...lead, name: extracted };
        setLead(updated);
        upsertChatLead(sessionId.current, { name: extracted });
        addMessage("assistant", LEAD_STEPS[1].question(extracted));
        setLeadStep(1);
      } else {
        // LLM extracted it from messy input — confirm with the user
        setPendingName(extracted);
        addMessage("assistant", `Just to confirm — should I call you **${extracted}**? (yes / no)`);
        setLeadStep(0.5);
      }
      return;
    }

    // ── Step 0.5: name confirmation ───────────────────────────────────────
    if (leadStep === 0.5) {
      if (YES_RE.test(text.trim())) {
        // Confirmed — save and move on
        const updated = { ...lead, name: pendingName };
        setLead(updated);
        upsertChatLead(sessionId.current, { name: pendingName });
        const q = LEAD_STEPS[1].question(pendingName);
        setTimeout(() => addMessage("assistant", q), 400);
        setLeadStep(1);
      } else if (NO_RE.test(text.trim())) {
        // Rejected — ask again
        setPendingName("");
        setTimeout(() => addMessage("assistant",
          `No worries! What would you like me to call you?`
        ), 400);
        setLeadStep(0);
      } else {
        // They typed a new name directly instead of yes/no
        const { name: extracted } = await extractName(text);
        const name = extracted || text.trim();
        const updated = { ...lead, name };
        setLead(updated);
        upsertChatLead(sessionId.current, { name });
        const q = LEAD_STEPS[1].question(name);
        setTimeout(() => addMessage("assistant", q), 400);
        setLeadStep(1);
      }
      return;
    }

    // ── Step 1: phone ─────────────────────────────────────────────────────
    if (leadStep === 1) {
      // Explicit skip intent
      if (SKIP_RE.test(text.trim())) {
        setPhoneAttempts(0);
        setTimeout(() => addMessage("assistant", `No problem! ${LEAD_STEPS[2].question}`), 400);
        setLeadStep(2);
        return;
      }
      const { isQuestion, nudge } = detectIntent(text, 1);
      if (isQuestion) {
        const newAttempts = phoneAttempts + 1;
        setPhoneAttempts(newAttempts);
        // Auto-skip after 2 failed attempts
        if (newAttempts >= 2) {
          setTimeout(() => addMessage("assistant",
            `No worries — we can skip the phone number! ${LEAD_STEPS[2].question}`
          ), 400);
          setLeadStep(2);
          return;
        }
        const hint = `\n\nNo worries if you'd prefer not to — just type **skip** to continue without a phone number.`;
        setTimeout(() => addMessage("assistant", nudge + hint), 400);
        return;
      }
      setPhoneAttempts(0);
      const digits = text.replace(/\D/g, "");
      const phone = digits.length === 11 ? digits.slice(1) : digits; // normalise to 10 digits
      const updated = { ...lead, phone };
      setLead(updated);
      upsertChatLead(sessionId.current, { phone });
      setTimeout(() => addMessage("assistant", LEAD_STEPS[2].question), 400);
      setLeadStep(2);
      return;
    }

    // ── Step 2: email ─────────────────────────────────────────────────────
    if (leadStep === 2) {
      // Explicit skip intent
      if (SKIP_RE.test(text.trim())) {
        setEmailAttempts(0);
        setTimeout(() => setShowIcpSelector(true), 400);
        setLeadStep(3);
        return;
      }
      const { isQuestion, nudge } = detectIntent(text, 2);
      if (isQuestion) {
        const newAttempts = emailAttempts + 1;
        setEmailAttempts(newAttempts);
        // Auto-skip after 2 failed attempts
        if (newAttempts >= 2) {
          setTimeout(() => setShowIcpSelector(true), 400);
          setLeadStep(3);
          return;
        }
        const hint = `\n\nNo worries if you'd prefer not to — just type **skip** to continue without an email.`;
        setTimeout(() => addMessage("assistant", nudge + hint), 400);
        return;
      }
      setEmailAttempts(0);
      const email = text.trim().toLowerCase();
      const updated = { ...lead, email };
      setLead(updated);
      upsertChatLead(sessionId.current, { email });
      setTimeout(() => setShowIcpSelector(true), 400);
      setLeadStep(3);
    }
  };

  const handleIcpSelect = (icp) => {
    const updated = { ...lead, icp_id: icp.id, icp_name: icp.full };
    setLead(updated);
    setShowIcpSelector(false);
    addMessage("user", icp.name);
    upsertChatLead(sessionId.current, { icp_id: icp.id, icp_name: icp.full });
    setTimeout(() => addMessage("assistant",
      `Great! I'll focus on ${icp.full}. How can I help you today?`
    ), 400);
    setLeadStep(4);
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

    if (leadStep < 3) {          // covers 0, 0.5, 1, 2
      handleLeadStep(text);
    } else if (leadStep === 4) {
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
    leadStep === 0   ? "Your name..." :
    leadStep === 0.5 ? "yes / no / or type your name..." :
    leadStep === 1   ? "Your phone number..." :
    leadStep === 2   ? "Your email address..." :
    leadStep === 3   ? "Select a program above..." :
    "Ask anything about LSSU...";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-800 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">AI Assistant</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Ask questions · Backed by your knowledge base</p>
        </div>
        {leadStep >= 4 && (
          <div className="text-right">
            <p className="text-xs text-neutral-400">{lead.name}</p>
            <p className="text-xs text-neutral-600">{lead.icp_name || lead.email}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content}
            ragUsed={msg.ragUsed} suggestCall={msg.suggestCall} />
        ))}
        {showIcpSelector && <IcpSelector onSelect={handleIcpSelect} />}
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
            disabled={loading || leadStep === 3}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || leadStep === 3}
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
