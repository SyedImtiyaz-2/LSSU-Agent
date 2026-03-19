import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Loader2, Plus } from "lucide-react";
import { listInterviews, createInterview } from "../api";

export default function InterviewsPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listInterviews();
      setInterviews(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startInterview = async () => {
    setStarting(true);
    try {
      const { id, room_name } = await createInterview();
      navigate(`/interview/${id}`, { state: { room_name } });
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-10 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Sessions</h1>
            <p className="text-base text-neutral-500 mt-1">
              All voice sessions with LSSU team members
            </p>
          </div>
          <button
            onClick={startInterview}
            disabled={starting}
            className="flex items-center gap-2.5 px-6 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40"
          >
            {starting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            New Session
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="text-center py-20 border border-neutral-800 rounded-2xl bg-neutral-950">
            <Mic className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-base text-neutral-500 font-medium">No sessions yet</p>
            <p className="text-sm text-neutral-600 mt-1">
              Start a new session to begin
            </p>
          </div>
        ) : (
          <div className="border border-neutral-800 rounded-2xl bg-neutral-950 divide-y divide-neutral-800/60 overflow-hidden">
            {interviews.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between px-6 py-5 hover:bg-neutral-900/60 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-base text-white font-medium">
                      {i.name || "Unnamed Session"}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {i.department && `${i.department}  ·  `}
                      {new Date(i.created_at).toLocaleDateString()}
                      {i.transcript?.length > 0 &&
                        `  ·  ${i.transcript.length} questions`}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs px-3 py-1 rounded-lg font-medium border ${
                    i.status === "completed"
                      ? "border-neutral-600 text-neutral-300 bg-neutral-800/50"
                      : "border-neutral-800 text-neutral-500"
                  }`}
                >
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
