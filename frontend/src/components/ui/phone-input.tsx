"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const COUNTRY_CODE = "92"
const DIGITS_AFTER_CODE = 10  // 92 + 10 = 12 total

interface PhoneInputProps {
  id?: string
  label?: string
  value: string                          // full stored number e.g. "923001234567"
  onChange: (fullNumber: string) => void
  onBlur?: (fullNumber: string) => void
  error?: string
  disabled?: boolean
  required?: boolean
  placeholder?: string
  className?: string
}

export function PhoneInput({
  id = "phone",
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
  placeholder = "3001234567",
  className = "",
}: PhoneInputProps) {
  // Extract the part after "92" to show in input
  const getAfterCode = (val: string) => {
    const digits = val.replace(/\D/g, "")
    if (digits.startsWith(COUNTRY_CODE)) {
      return digits.slice(COUNTRY_CODE.length, COUNTRY_CODE.length + DIGITS_AFTER_CODE)
    }
    return digits.slice(0, DIGITS_AFTER_CODE)
  }

  const afterCode = getAfterCode(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, DIGITS_AFTER_CODE)
    onChange(COUNTRY_CODE + digits)
  }

  const handleBlur = () => {
    onBlur?.(COUNTRY_CODE + afterCode)
  }

  const isIncomplete = afterCode.length > 0 && afterCode.length < DIGITS_AFTER_CODE
  const displayError = error || (isIncomplete ? `Phone number mein ${DIGITS_AFTER_CODE - afterCode.length} aur digits chahiye` : undefined)

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="flex">
        <span className="inline-flex items-center px-3 border border-r-0 border-input rounded-l-md bg-muted text-sm text-muted-foreground font-mono select-none shrink-0">
          +92
        </span>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          value={afterCode}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          maxLength={DIGITS_AFTER_CODE}
          aria-describedby={displayError ? `${id}-error` : undefined}
          className={`rounded-l-none font-mono ${displayError ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
      </div>
      {displayError && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert" aria-live="polite">
          {displayError}
        </p>
      )}
      {!displayError && afterCode.length === DIGITS_AFTER_CODE && (
        <p className="text-xs text-green-600">+92-{afterCode}</p>
      )}
    </div>
  )
}

// Utility: validate a stored phone number
export function isValidPhone(fullNumber: string): boolean {
  const digits = fullNumber.replace(/\D/g, "")
  return digits.startsWith("92") && digits.length === 12
}

// Utility: format for display "+92-3001234567"
export function formatPhone(fullNumber: string): string {
  const digits = fullNumber.replace(/\D/g, "")
  if (digits.startsWith("92") && digits.length === 12) {
    return `+92-${digits.slice(2)}`
  }
  return fullNumber
}
