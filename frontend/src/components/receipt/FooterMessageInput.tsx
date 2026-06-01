"use client"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const MAX_CHARS = 150

interface FooterMessageInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export default function FooterMessageInput({
  value,
  onChange,
  error,
  disabled = false,
}: FooterMessageInputProps) {
  const remaining = MAX_CHARS - value.length
  const isNearLimit = remaining <= 20

  return (
    <div className="space-y-2">
      <Label htmlFor="footer-message" className="text-sm font-medium">
        Footer Message
      </Label>
      <Textarea
        id="footer-message"
        placeholder="Thank you for shopping with us!"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
        disabled={disabled}
        rows={3}
        aria-describedby="footer-char-count footer-error"
        className={error ? "border-destructive focus-visible:ring-destructive" : ""}
      />
      <div className="flex items-center justify-between">
        {error ? (
          <p
            id="footer-error"
            className="text-xs text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        ) : (
          <span />
        )}
        <p
          id="footer-char-count"
          className={`text-xs tabular-nums ${isNearLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {remaining}/{MAX_CHARS}
        </p>
      </div>
    </div>
  )
}
