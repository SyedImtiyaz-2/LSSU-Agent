import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import AudioVisualizer from "../components/AudioVisualizer";
import TranscriptPanel from "../components/TranscriptPanel";
import { getLivekitToken, getInterview } from "../api";

function InterviewContent({ onDisconnect }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const [messages, setMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const pendingSegments = useRef({});

  useEffect(() => {
    if (!room) return;

    const handleData = (payload) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type === "interview_complete") {
          setInterviewDone(true);
        }
      } catch {
        // ignore non-JSON data
      }
    };

    room.on("activeSpeakersChanged", (speakers) => {
      setAgentSpeaking(speakers.some((s) => s.identity !== "user"));
      setUserSpeaking(speakers.some((s) => s.identity === "user"));
    });

    room.on("dataReceived", handleData);

    room.on("transcriptionReceived", (segments, participant) => {
      const role = participant?.identity === "user" ? "user" : "agent";

      for (const seg of segments) {
        const segKey = `${participant?.identity || "unknown"}-${seg.id}`;
        const text = seg.text?.trim();
        if (!text) continue;

        if (seg.final) {
          if (pendingSegments.current[segKey] !== undefined) {
            const idx = pendingSegments.current[segKey];
            delete pendingSegments.current[segKey];
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[idx]) updated[idx] = { role, text };
              return updated;
            });
          } else {
            setMessages((prev) => [...prev, { role, text }]);
          }
        } else {
          if (pendingSegments.current[segKey] !== undefined) {
            const idx = pendingSegments.current[segKey];
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[idx]) updated[idx] = { role, text };
              return updated;
            });
          } else {
            setMessages((prev) => {
              pendingSegments.current[segKey] = prev.length;
              return [...prev, { role, text }];
            });
          }
        }
      }
    });

    return () => {
      room.removeAllListeners("activeSpeakersChanged");
      room.removeAllListeners("dataReceived");
      room.removeAllListeners("transcriptionReceived");
    };
  }, [room]);

  const toggleMute = async () => {
    if (!room) return;
    const micTrack = room.localParticipant
      .getTrackPublications()
      .find((t) => t.source === "microphone");
    if (micTrack) {
      if (isMuted) await micTrack.unmute();
      else await micTrack.mute();
      setIsMuted(!isMuted);
    }
  };

  const agentConnected = participants.some((p) => p.identity !== "user");

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              connectionState === "connected"
                ? agentConnected
                  ? "bg-green-500"
                  : "bg-amber-500 animate-pulse"
                : "bg-neutral-600 animate-pulse"
            }`}
          />
          <span className="text-sm text-neutral-400">
            {connectionState === "connected"
              ? agentConnected
                ? "Session in progress"
                : "Agent is getting ready..."
              : "Connecting..."}
          </span>
        </div>
        {interviewDone && (
          <span className="text-sm text-neutral-300 font-medium">Complete</span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Agent + User visualizers (fixed, no scroll) */}
        <div className="lg:w-[360px] flex-shrink-0 flex flex-col items-center justify-center p-8 border-b lg:border-b-0 lg:border-r border-neutral-800">
          {/* Waiting overlay */}
          {!agentConnected && connectionState === "connected" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none lg:relative lg:inset-auto lg:mb-8">
              <Loader2 className="w-8 h-8 text-neutral-500 animate-spin mb-4" />
              <p className="text-base text-neutral-400 font-medium">Preparing your session</p>
              <p className="text-sm text-neutral-600 mt-1">The agent will be with you shortly...</p>
            </div>
          )}

          {/* Agent */}
          <div className={`mb-10 ${!agentConnected ? "hidden lg:block opacity-30" : ""}`}>
            <div
              className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 mx-auto transition-all duration-300 ${
                agentSpeaking
                  ? "border-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  : "border-neutral-700 bg-transparent"
              }`}
            >
              <span className="text-base font-semibold text-neutral-300">AI</span>
            </div>
            <p className="text-sm text-neutral-500 text-center mb-3">Agent</p>
            <AudioVisualizer isActive={agentSpeaking} />
          </div>

          {/* User */}
          <div className={`${!agentConnected ? "hidden lg:block opacity-30" : ""}`}>
            <div
              className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mb-4 mx-auto transition-all duration-300 ${
                userSpeaking
                  ? "border-white bg-white/10"
                  : "border-neutral-800 bg-transparent"
              }`}
            >
              <Mic className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-500 text-center mb-3">You</p>
            <AudioVisualizer isActive={userSpeaking} />
          </div>
        </div>

        {/* Right: Transcript (scrollable) */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden min-w-0">
          <h3 className="text-xs text-neutral-600 uppercase tracking-widest mb-4 flex-shrink-0">
            Transcript
          </h3>
          <div className="flex-1 overflow-hidden">
            <TranscriptPanel messages={messages} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-neutral-800 flex-shrink-0">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${
            isMuted
              ? "border-red-800 text-red-400 bg-red-950/30"
              : "border-neutral-700 text-white hover:border-neutral-500"
          }`}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={onDisconnect}
          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-all"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function InterviewRoom() {
  const { interviewId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [wsUrl, setWsUrl] = useState(null);
  const [roomName, setRoomName] = useState(location.state?.room_name || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function connect() {
      try {
        let room = roomName;
        if (!room) {
          const interview = await getInterview(interviewId);
          room = interview.room_name;
          setRoomName(room);
        }
        const data = await getLivekitToken(room, "user");
        setToken(data.token);
        setWsUrl(data.url);
      } catch (err) {
        console.error("Failed to connect:", err);
        setError("Failed to connect to session room.");
      }
    }
    connect();
  }, [interviewId, roomName]);

  const handleDisconnect = () => navigate("/interviews");

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/interviews")}
            className="text-sm text-white underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!token || !wsUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={handleDisconnect}
      >
        <InterviewContent onDisconnect={handleDisconnect} />
      </LiveKitRoom>
    </div>
  );
}
