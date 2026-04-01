import { useState, useEffect } from "react";
import { FileText, Trash2, Loader2, Database, Globe } from "lucide-react";
import DocumentUploader from "../components/DocumentUploader";
import { listDocuments, deleteDocument, crawlUrl } from "../api";

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState("");

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const docs = await listDocuments();
      setDocuments(docs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleCrawl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setCrawling(true);
    setCrawlError("");
    try {
      await crawlUrl(url);
      setUrlInput("");
      fetchDocs();
    } catch (err) {
      setCrawlError(err?.response?.data?.detail || "Failed to crawl URL");
    } finally {
      setCrawling(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this document from the knowledge base?")) return;
    try {
      await deleteDocument(id);
      fetchDocs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-10 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
          <p className="text-base text-neutral-500 mt-1">
            Upload proposal documents, meeting notes, and department context.
            The agent uses these to ask smarter follow-up questions.
          </p>
        </div>

        <DocumentUploader onUploaded={fetchDocs} />

        {/* URL Crawler */}
        <div className="mt-6 border border-neutral-800 rounded-2xl bg-neutral-950 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-semibold text-white">Crawl a URL</span>
            <span className="text-xs text-neutral-600 ml-1">— paste any webpage to extract and index its content</span>
          </div>
          <div className="flex gap-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
              placeholder="https://lssu.edu/programs/nursing"
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              disabled={crawling}
            />
            <button
              onClick={handleCrawl}
              disabled={!urlInput.trim() || crawling}
              className="px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {crawling ? "Crawling…" : "Crawl"}
            </button>
          </div>
          {crawlError && <p className="text-xs text-red-400 mt-2">{crawlError}</p>}
        </div>

        <div className="mt-10">
          <h2 className="text-sm text-neutral-500 uppercase tracking-widest mb-4 font-semibold">
            Indexed Documents ({documents.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-16 border border-neutral-800 rounded-2xl bg-neutral-950">
              <Database className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-base text-neutral-500 font-medium">No documents yet</p>
              <p className="text-sm text-neutral-600 mt-1">
                Upload documents to build context for sessions
              </p>
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-2xl bg-neutral-950 divide-y divide-neutral-800/60 overflow-hidden">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-neutral-900/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-neutral-400" />
                    </div>
                    <div>
                      <p className="text-base text-white font-medium">{doc.filename}</p>
                      <p className="text-sm text-neutral-500">
                        {doc.file_size
                          ? `${(doc.file_size / 1024).toFixed(1)} KB`
                          : ""}
                        {doc.created_at
                          ? `  ·  ${new Date(doc.created_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-neutral-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-neutral-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
