import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { generateReport, getReportDownloadUrl } from "../api";

export default function ReportCard({ interview, onRefresh }) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReport(interview.id);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const url = await getReportDownloadUrl(interview.id);
    window.open(url, "_blank");
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-neutral-800 last:border-0">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          <FileText className="w-4 h-4 text-neutral-500" />
        </div>
        <div>
          <p className="text-sm text-white">{interview.name || "Unnamed"}</p>
          <p className="text-xs text-neutral-600">
            {interview.department && `${interview.department} · `}
            {new Date(interview.created_at).toLocaleDateString()}
            {interview.transcript?.length > 0 && ` · ${interview.transcript.length} questions`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${
          interview.status === "completed"
            ? "border-neutral-700 text-neutral-400"
            : "border-neutral-800 text-neutral-600"
        }`}>
          {interview.status}
        </span>

        {interview.report_file ? (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white text-black rounded hover:bg-neutral-200 transition-colors"
          >
            <Download className="w-3 h-3" />
            PDF
          </button>
        ) : interview.status === "completed" ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-700 text-neutral-300 rounded hover:border-neutral-500 transition-colors disabled:opacity-40"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            {generating ? "..." : "Generate"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
