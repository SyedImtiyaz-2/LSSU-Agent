import { useState, useEffect } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { listInterviews, generateReport, getReportDownloadUrl } from "../api";

function cleanSummary(raw) {
  if (!raw) return "";
  return raw
    .replace(/#{1,4}\s?/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export default function ReportsPage() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listInterviews();
      setInterviews((data || []).filter((i) => i.status === "completed"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async (id) => {
    setGenerating(id);
    setError("");
    try {
      await generateReport(id);
      await fetchData();
      window.open(getReportDownloadUrl(id), "_blank");
    } catch (err) {
      const msg = err.response?.data?.detail || "Report generation failed";
      setError(msg);
      console.error(err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-10 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Reports</h1>
          <p className="text-base text-neutral-500 mt-1">
            AI-generated requirements reports from completed sessions.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-950/50 border border-red-900 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="text-center py-20 border border-neutral-800 rounded-2xl bg-neutral-950">
            <FileText className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-base text-neutral-500 font-medium">No completed sessions yet</p>
            <p className="text-sm text-neutral-600 mt-1">
              Reports are generated from completed sessions
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {interviews.map((i) => {
              const summary = cleanSummary(i.summary);
              const lines = summary ? summary.split("\n").filter(Boolean) : [];

              return (
                <div
                  key={i.id}
                  className="border border-neutral-800 rounded-2xl bg-neutral-950 hover:border-neutral-700 transition-colors"
                >
                  {/* Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-white">
                        {i.name || "Unnamed"}
                      </h3>
                      {i.report_file ? (
                        <button
                          onClick={() =>
                            window.open(getReportDownloadUrl(i.id), "_blank")
                          }
                          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGenerate(i.id)}
                          disabled={generating === i.id}
                          className="flex items-center gap-2 px-5 py-2.5 border border-neutral-600 text-neutral-300 text-sm font-medium rounded-xl hover:border-neutral-400 transition-colors disabled:opacity-40"
                        >
                          {generating === i.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                          {generating === i.id ? "Processing..." : "Generate Report"}
                        </button>
                      )}
                    </div>

                    {/* Tags row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {i.department && (
                        <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 font-medium">
                          {i.department}
                        </span>
                      )}
                      <span className="px-3 py-1 rounded-full bg-neutral-800/60 text-xs text-neutral-400">
                        {new Date(i.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {i.transcript?.length > 0 && (
                        <span className="px-3 py-1 rounded-full bg-neutral-800/60 text-xs text-neutral-400">
                          {i.transcript.length} questions
                        </span>
                      )}
                      {i.report_file && (
                        <span className="px-3 py-1 rounded-full bg-neutral-800/60 text-xs text-neutral-400">
                          PDF ready
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {lines.length > 0 && (
                    <div className="px-6 pb-6 pt-2">
                      <div className="border-t border-neutral-800 pt-4">
                        <ul className="space-y-1.5">
                          {lines.slice(0, 5).map((line, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-neutral-400 leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-neutral-700"
                            >
                              {line.replace(/^[-*\d.]+\s*/, "")}
                            </li>
                          ))}
                        </ul>
                        {lines.length > 5 && (
                          <p className="text-xs text-neutral-600 mt-2 pl-4">
                            + {lines.length - 5} more points in full report
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
