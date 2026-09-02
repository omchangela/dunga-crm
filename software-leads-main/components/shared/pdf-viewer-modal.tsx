"use client";

import { useEffect } from "react";
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
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
            >
              <ExternalLink className="h-3.5 w-3.5" />Open
            </a>
            <a
              href={url}
              download
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
            >
              <Download className="h-3.5 w-3.5" />Download
            </a>
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
        <iframe
          src={url}
          title={title}
          className="h-full w-full flex-1 bg-[#525659]"
        />
      </div>
    </div>
  );
}

export default PdfViewerModal;
