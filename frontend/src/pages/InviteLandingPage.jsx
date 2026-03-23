import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Mic, AlertCircle } from "lucide-react";
import { getInvitation, startInviteSession, getLivekitToken } from "../api";

export default function InviteLandingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getInvitation(token);
        setInvite(data);
        if (data.status === "started" && data.interview_id) {
          // Already started, go to interview room
          navigate(`/interview/${data.interview_id}`, {
            state: { room_name: null, invite_token: token },
          });
        }
      } catch (err) {
        setError("This invitation link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const { id, room_name } = await startInviteSession(token, name);
      navigate(`/interview/${id}`, {
        state: { room_name, invite_token: token },
      });
    } catch (err) {
      setError("Failed to start session. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neutral-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Invitation Error</h1>
          <p className="text-neutral-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">LSSU AI Session</h1>
          <p className="text-neutral-400 text-base">
            You've been invited to a brief voice session with our AI agent
          </p>
        </div>

        {/* Card */}
        <div className="border border-neutral-800 rounded-2xl bg-neutral-950 p-8">
          {invite?.message && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-neutral-400 italic">"{invite.message}"</p>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div>
              <label className="text-sm font-medium text-neutral-400 block mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-white text-black text-base font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40"
          >
            {starting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            Start Voice Session
          </button>

          <div className="mt-6 space-y-2">
            <p className="text-xs text-neutral-600 text-center">
              The session takes about 5-10 minutes. You'll need a microphone.
            </p>
            <p className="text-xs text-neutral-600 text-center">
              Your responses help us understand how AI can support your work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
