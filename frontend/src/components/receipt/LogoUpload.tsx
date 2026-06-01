"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, X, ImageIcon, Loader2 } from "lucide-react"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_SIZE_BYTES = 2 * 1024 * 1024

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:5001"

interface LogoUploadProps {
  currentLogoUrl: string | null
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
  isUploading: boolean
  isRemoving: boolean
}

export default function LogoUpload({
  currentLogoUrl,
  onUpload,
  onRemove,
  isUploading,
  isRemoving,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLocalError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError("Only PNG, JPG, and WEBP files are allowed.")
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError("File size must be under 2MB.")
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setPendingFile(file)
  }

  const handleConfirmUpload = async () => {
    if (!pendingFile) return
    await onUpload(pendingFile)
    URL.revokeObjectURL(preview ?? "")
    setPreview(null)
    setPendingFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleCancelPreview = () => {
    URL.revokeObjectURL(preview ?? "")
    setPreview(null)
    setPendingFile(null)
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const displayUrl = preview ?? (currentLogoUrl ? `${API_BASE}${currentLogoUrl}` : null)

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Receipt Logo</Label>

      {displayUrl ? (
        <div className="relative w-40 h-24 border rounded-lg overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt="Receipt logo preview"
            className="w-full h-full object-contain p-2"
          />
          {preview && (
            <span className="absolute top-1 left-1 text-xs bg-amber-100 text-amber-800 rounded px-1 leading-5">
              Preview
            </span>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center w-40 h-24 border-2 border-dashed rounded-lg bg-muted/30 gap-1"
          aria-label="No logo uploaded"
        >
          <ImageIcon className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">No logo</span>
        </div>
      )}

      {localError && (
        <p className="text-xs text-destructive" role="alert" aria-live="assertive">
          {localError}
        </p>
      )}

      <input
        ref={inputRef}
        id="logo-upload-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Upload receipt logo"
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap gap-2">
        {preview ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmUpload}
              disabled={isUploading}
              aria-label="Save this logo"
            >
              {isUploading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="w-3 h-3 mr-1" aria-hidden="true" />
              )}
              {isUploading ? "Uploading..." : "Save Logo"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancelPreview}
              disabled={isUploading}
              aria-label="Cancel logo selection"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              aria-label={currentLogoUrl ? "Change receipt logo" : "Upload receipt logo"}
            >
              <Upload className="w-3 h-3 mr-1" aria-hidden="true" />
              {currentLogoUrl ? "Change Logo" : "Upload Logo"}
            </Button>
            {currentLogoUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onRemove}
                disabled={isRemoving}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Remove receipt logo"
              >
                {isRemoving ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="w-3 h-3 mr-1" aria-hidden="true" />
                )}
                {isRemoving ? "Removing..." : "Remove"}
              </Button>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP &bull; Max 2MB</p>
    </div>
  )
}
