"use client";

import { useRef, useState } from "react";

interface PhotoIntakeProps {
  onExtracted: (text: string) => void;
  labels?: {
    title: string;
    hint: string;
    reading: string;
    retake: string;
    alt: string;
    errSelect: string;
    errRead: string;
    errGeneric: string;
  };
}

/**
 * Camera-first letter capture. On mobile this opens the rear camera; on
 * desktop it falls back to a file picker. After capture the image is sent
 * to /api/ocr which returns extracted text — either from a vision LLM
 * (when LLM_API_KEY is set) or a realistic demo extraction.
 */
export default function PhotoIntake({ onExtracted, labels }: PhotoIntakeProps) {
  // English defaults keep the component usable on its own; the page passes the
  // parent's language so the whole camera flow is translated too.
  const t = {
    title: "Take a photo of the letter",
    hint: "Opens your camera on mobile, or choose a file",
    reading: "Reading your letter…",
    retake: "📷 Retake",
    alt: "Captured letter",
    errSelect: "Please select an image file.",
    errRead: "Could not read the letter.",
    errGeneric: "Something went wrong.",
    ...labels,
  };
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError(t.errSelect);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setLoading(true);
      try {
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? t.errRead);
        if (data.text) onExtracted(data.text);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.errGeneric);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function retake() {
    setPreview(null);
    setError(null);
  }

  if (preview) {
    return (
      <div className="rounded-xl border-2 overflow-hidden fade-in" style={{ borderColor: "var(--teal)" }}>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={t.alt} className="w-full max-h-64 object-contain bg-gray-50" />
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
              <div className="h-6 w-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--teal)", borderTopColor: "transparent" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--teal-deep)" }}>{t.reading}</p>
            </div>
          )}
        </div>
        {!loading && (
          <div className="p-3 flex justify-end">
            <button type="button" className="btn-ghost text-sm" onClick={retake}>
              {t.retake}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
        style={{ borderColor: "var(--line)" }}
        onClick={() => (cameraRef.current ?? fileRef.current)?.click()}
      >
        <p className="text-3xl mb-2">📷</p>
        <p className="font-semibold mb-1">{t.title}</p>
        <p className="text-sm opacity-60">{t.hint}</p>
      </div>
      {error && (
        <p className="text-sm font-semibold" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
      {/* Camera capture (mobile — rear camera preferred) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {/* File picker fallback (desktop) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
