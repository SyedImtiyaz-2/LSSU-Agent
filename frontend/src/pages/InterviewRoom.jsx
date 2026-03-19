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
  // Track in-progress streaming segments by participant+segmentId
  const pendingSegments = useRef({});

  useEffect(() => {
    if (!room) return;

    const handleData = (payload, participant) => {
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
          // Segment is final — if we were tracking it as pending, replace; otherwise add new
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
          // Streaming partial — update in place
          if (pendingSegments.current[segKey] !== undefined) {
            const idx = pendingSegments.current[segKey];
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[idx]) updated[idx] = { role, text };
              return updated;
            });
          } else {
            // First partial for this segment — add and remember index
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
      {/* Status */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionState === "connected"
                ? agentConnected
                  ? "bg-white"
                  : "bg-neutral-500 animate-pulse"
                : "bg-neutral-600"
            }`}
          />
          <span className="text-xs text-neutral-500">
            {connectionState === "connected"
              ? agentConnected
                ? "In progress"
                : "Waiting for agent..."
              : "Connecting..."}
          </span>
        </div>
        {interviewDone && (
          <span className="text-xs text-neutral-400">Complete</span>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Visualizer */}
        <div className="lg:w-1/2 flex flex-col items-center justify-center p-8 border-b lg:border-b-0 lg:border-r border-neutral-800">
          {/* Agent */}
          <div className="mb-10">
            <div
              className={`w-20 h-20 rounded-full border flex items-center justify-center mb-4 mx-auto transition-all duration-300 ${
                agentSpeaking
                  ? "border-white bg-white/5"
                  : "border-neutral-700 bg-transparent"
              }`}
            >
              <span className="text-sm font-medium text-neutral-400">AI</span>
            </div>
            <p className="text-xs text-neutral-600 text-center mb-3">Agent</p>
            <AudioVisualizer isActive={agentSpeaking} />
          </div>

          {/* User */}
          <div>
            <div
              className={`w-16 h-16 rounded-full border flex items-center justify-center mb-4 mx-auto transition-all duration-300 ${
                userSpeaking
                  ? "border-white bg-white/5"
                  : "border-neutral-800 bg-transparent"
              }`}
            >
              <Mic className="w-4 h-4 text-neutral-500" />
            </div>
            <p className="text-xs text-neutral-600 text-center mb-3">You</p>
            <AudioVisualizer isActive={userSpeaking} />
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="lg:w-1/2 flex flex-col p-6 overflow-hidden">
          <h3 className="text-xs text-neutral-600 uppercase tracking-widest mb-4">
            Transcript
          </h3>
          <TranscriptPanel messages={messages} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-neutral-800">
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
        <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
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
