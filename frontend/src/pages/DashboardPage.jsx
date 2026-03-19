import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, FileText, Database, ArrowRight, Loader2, Plus } from "lucide-react";
import { listInterviews, listDocuments, createInterview } from "../api";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ interviews: 0, completed: 0, documents: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [interviews, docs] = await Promise.all([
          listInterviews(),
          listDocuments(),
        ]);
        setStats({
          interviews: interviews?.length || 0,
          completed: interviews?.filter((i) => i.status === "completed").length || 0,
          documents: docs?.length || 0,
        });
        setRecent((interviews || []).slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
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
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-base text-neutral-500 mt-1">
              LSSU requirements gathering overview
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-5 mb-10">
          {[
            { label: "Total Sessions", value: stats.interviews, icon: Mic, desc: "All time" },
            { label: "Completed", value: stats.completed, icon: FileText, desc: "Ready for reports" },
            { label: "Documents Indexed", value: stats.documents, icon: Database, desc: "Knowledge base" },
          ].map(({ label, value, icon: Icon, desc }) => (
            <div
              key={label}
              className="p-6 border border-neutral-800 rounded-2xl bg-neutral-950 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-neutral-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white">
                {loading ? "-" : value}
              </p>
              <p className="text-sm text-neutral-400 mt-1 font-medium">{label}</p>
              <p className="text-xs text-neutral-600 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Recent Sessions */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">
              Recent Sessions
            </h2>
            <button
              onClick={() => navigate("/interviews")}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white transition-colors font-medium"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-16 border border-neutral-800 rounded-2xl bg-neutral-950">
              <Mic className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-base text-neutral-500 font-medium">No sessions yet</p>
              <p className="text-sm text-neutral-600 mt-1">
                Start one to begin gathering requirements
              </p>
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-2xl bg-neutral-950 divide-y divide-neutral-800/60 overflow-hidden">
              {recent.map((interview) => (
                <div
                  key={interview.id}
                  onClick={() => navigate(`/interviews`)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-neutral-900/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                      <Mic className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-base text-white font-medium">
                        {interview.name || "Unnamed"}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {interview.department && `${interview.department}  ·  `}
                        {new Date(interview.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-lg font-medium border ${
                      interview.status === "completed"
                        ? "border-neutral-600 text-neutral-300 bg-neutral-800/50"
                        : "border-neutral-800 text-neutral-500"
                    }`}
                  >
                    {interview.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
