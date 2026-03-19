import { useState, useRef } from "react";
import { Upload, X, Loader2, Check } from "lucide-react";
import { uploadDocument } from "../api";

export default function DocumentUploader({ onUploaded }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;

    const allowed = [".pdf", ".txt", ".docx", ".md"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(ext)) {
      alert("Please upload a PDF, TXT, DOCX, or MD file.");
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      await uploadDocument(file);
      setUploadResult({ success: true, name: file.name });
      onUploaded?.();
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadResult({ success: false, error: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragActive ? "border-white bg-white/5" : "border-neutral-700 hover:border-neutral-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.docx,.md"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin mx-auto" />
        ) : (
          <>
            <Upload className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
            <p className="text-base text-neutral-400 font-medium">Drop a file here, or click to browse</p>
            <p className="text-sm text-neutral-600 mt-1">PDF, TXT, DOCX, MD</p>
          </>
        )}
      </div>
      {uploadResult && (
        <div className={`mt-3 flex items-center gap-2 text-sm ${uploadResult.success ? "text-neutral-300" : "text-red-400"}`}>
          {uploadResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {uploadResult.success ? `${uploadResult.name} indexed` : uploadResult.error}
        </div>
      )}
    </div>
  );
}
