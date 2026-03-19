import { useState, useEffect } from "react";
import { FileText, Trash2, Loader2, Database } from "lucide-react";
import DocumentUploader from "../components/DocumentUploader";
import { listDocuments, deleteDocument } from "../api";

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

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
