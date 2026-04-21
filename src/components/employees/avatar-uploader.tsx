"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface AvatarUploaderProps {
  employeeId: string;
  currentAvatarUrl?: string | null;
  displayName: string;
  onUploadComplete?: (storagePath: string, publicUrl: string) => void;
  className?: string;
}

export function AvatarUploader({
  employeeId,
  currentAvatarUrl,
  displayName,
  onUploadComplete,
  className,
}: AvatarUploaderProps) {
  const [preview, setPreview] = useState<string | null>(
    currentAvatarUrl ?? null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size (max 2 MB)
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2 MB.");
      return;
    }

    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    if (!onUploadComplete) return;

    setIsUploading(true);
    try {
      const base64 = await fileToBase64(file);

      // Dynamic import to avoid bundling server action in all paths
      const { uploadDocument } =
        await import("@/app/(dashboard)/employees/actions");
      const result = await uploadDocument(
        employeeId,
        `avatar_${file.name}`,
        base64,
        file.type,
      );
      onUploadComplete(result.storagePath, result.publicUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      setPreview(currentAvatarUrl ?? null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Avatar circle */}
      <div className="relative group">
        <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md ring-2 ring-pcso-gold/40">
          {preview ? (
            <Image
              src={preview}
              alt={`Avatar of ${displayName}`}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-pcso-navy text-2xl font-semibold text-white">
              {initials || <User className="h-8 w-8" />}
            </div>
          )}
        </div>

        {/* Camera overlay button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Change avatar photo"
          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-pcso-gold shadow transition-colors hover:bg-pcso-gold-light disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5 text-white" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {isUploading && (
        <p className="text-xs text-muted-foreground">Uploading…</p>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs text-destructive text-center max-w-[160px]"
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="text-xs"
      >
        {preview ? "Change photo" : "Upload photo"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to read file as base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}
