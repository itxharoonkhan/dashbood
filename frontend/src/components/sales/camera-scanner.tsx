"use client"

import * as React from "react"
import { Camera, X, SwitchCamera, Loader2, ZapOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Props {
  open: boolean
  onClose: () => void
  onDetected: (code: string) => void
}

export function CameraScanner({ open, onClose, onDetected }: Props) {
  const videoRef    = React.useRef<HTMLVideoElement>(null)
  const readerRef   = React.useRef<any>(null)
  const streamRef   = React.useRef<MediaStream | null>(null)

  const [cameras, setCameras]       = React.useState<MediaDeviceInfo[]>([])
  const [activeCamIdx, setActiveCamIdx] = React.useState(0)
  const [scanning, setScanning]     = React.useState(false)
  const [error, setError]           = React.useState("")
  const [lastCode, setLastCode]     = React.useState("")
  const cooldownRef = React.useRef(false)

  // ── Start scanner ──────────────────────────────────────────────────────────
  const startScanner = React.useCallback(async (deviceId?: string) => {
    setError("")
    setScanning(false)

    try {
      // Stop existing stream
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (readerRef.current) {
        try { readerRef.current.reset() } catch { /* ignore */ }
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "environment" }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)

        // Start decode loop
        const decode = async () => {
          if (!readerRef.current || !videoRef.current) return
          try {
            const result = await readerRef.current.decodeOnceFromVideoElement(videoRef.current)
            if (result && !cooldownRef.current) {
              const code = result.getText()
              cooldownRef.current = true
              setLastCode(code)
              onDetected(code)
              // 2 second cooldown before next scan
              setTimeout(() => { cooldownRef.current = false }, 2000)
              // Keep scanning
              setTimeout(decode, 2000)
            } else {
              setTimeout(decode, 100)
            }
          } catch {
            // No barcode found — keep trying
            setTimeout(decode, 150)
          }
        }
        decode()
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Browser settings mein camera allow karo.")
      } else if (err.name === "NotFoundError") {
        setError("Koi camera nahi mila device pe.")
      } else {
        setError("Camera start nahi hua: " + (err.message || "Unknown error"))
      }
    }
  }, [onDetected])

  // ── Load cameras list ──────────────────────────────────────────────────────
  const loadCameras = React.useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter(d => d.kind === "videoinput")
      setCameras(cams)
      return cams
    } catch {
      return []
    }
  }, [])

  // ── On open ────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return
    setLastCode("")
    setError("")

    const init = async () => {
      // Request permission first (so enumerateDevices returns labels)
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        tempStream.getTracks().forEach(t => t.stop())
      } catch { /* proceed */ }

      const cams = await loadCameras()
      // Prefer back camera
      const backIdx = cams.findIndex(c => c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("rear"))
      const idx = backIdx >= 0 ? backIdx : 0
      setActiveCamIdx(idx)
      await startScanner(cams[idx]?.deviceId)
    }

    init()
  }, [open])

  // ── On close ──────────────────────────────────────────────────────────────
  const handleClose = React.useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (readerRef.current) {
      try { readerRef.current.reset() } catch { /* ignore */ }
      readerRef.current = null
    }
    setScanning(false)
    setLastCode("")
    onClose()
  }, [onClose])

  React.useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [open])

  // ── Switch camera ──────────────────────────────────────────────────────────
  const switchCamera = async () => {
    if (cameras.length < 2) return
    const nextIdx = (activeCamIdx + 1) % cameras.length
    setActiveCamIdx(nextIdx)
    await startScanner(cameras[nextIdx]?.deviceId)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Camera Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        {/* Camera feed */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Scanning overlay */}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Scan frame */}
              <div className="relative w-56 h-36">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br" />
                {/* Scan line animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-primary/80 animate-scan-line" />
              </div>
            </div>
          )}

          {/* Loading */}
          {!scanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-white text-sm">Camera shuru ho raha hai...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
              <ZapOff className="w-10 h-10 text-destructive" />
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          {/* Last scanned code */}
          {lastCode && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <Badge className="bg-green-600 text-white text-xs px-3 py-1">
                ✅ Scanned: {lastCode}
              </Badge>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {scanning ? "Barcode frame ke saamne rakho" : error ? "Error" : "Starting..."}
          </p>
          <div className="flex gap-2">
            {cameras.length > 1 && (
              <Button variant="outline" size="sm" onClick={switchCamera}>
                <SwitchCamera className="w-4 h-4 mr-1" />
                Switch
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleClose}>
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
