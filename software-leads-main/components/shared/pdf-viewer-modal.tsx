"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Download } from "lucide-react";

interface PdfViewerModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

/**
 * In-app PDF viewer. Renders the PDF inline using the browser's built-in
 * viewer (via an <iframe>) so the user stays inside the app instead of being
 * sent off to a new browser tab.
 */
export function PdfViewerModal({ url, title = "PDF", onClose }: PdfViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string>("");

  // Convert base64 / data-URI to a Blob URL for reliable, high-performance rendering & downloading without "failed to load response data" in iFrame/browser
  useEffect(() => {
    let createdUrl = "";
    if (url && url.startsWith("data:")) {
      try {
        const parts = url.split(";base64,");
        const contentType = parts[0].replace("data:", "") || "application/pdf";
        const b64Data = parts[1] || "";
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (err) {
        console.error("Failed to convert data-URI to blob URL:", err);
        setBlobUrl(url);
      }
    } else {
      setBlobUrl(url);
    }

    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [url]);

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${title.replace(/[^a-zA-Z0-9_\-]/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#e5e9f2] px-4 py-3">
          <p className="truncate text-sm font-semibold text-[#1a2035]">{title}</p>
          <div className="flex items-center gap-1.5">
            <a
              href={blobUrl || url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
            >
              <ExternalLink className="h-3.5 w-3.5" />Open
            </a>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
            >
              <Download className="h-3.5 w-3.5" />Download
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[#f5f6fa] hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Viewer */}
        {blobUrl ? (
          <iframe
            src={blobUrl}
            title={title}
            className="h-full w-full flex-1 bg-[#525659]"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#525659] text-white text-sm font-semibold">
            Loading PDF...
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfViewerModal;
