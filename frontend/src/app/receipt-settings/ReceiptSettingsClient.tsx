"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Save, Loader2, Receipt } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AxiosError } from "axios"
import api from "@/lib/api"
import LogoUpload from "@/components/receipt/LogoUpload"
import FooterMessageInput from "@/components/receipt/FooterMessageInput"
import ToggleRow from "@/components/receipt/ToggleRow"

const receiptSettingsSchema = z.object({
  receipt_footer_message: z
    .string()
    .max(150, "Footer message cannot exceed 150 characters"),
  receipt_show_tax: z.boolean(),
  receipt_show_donation: z.boolean(),
})

type ReceiptSettingsForm = z.infer<typeof receiptSettingsSchema>

interface ReceiptSettingsData {
  receipt_logo: string | null
  receipt_footer_message: string
  receipt_show_tax: number | boolean
  receipt_show_donation: number | boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export default function ReceiptSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiptSettingsForm>({
    resolver: zodResolver(receiptSettingsSchema),
    defaultValues: {
      receipt_footer_message: "",
      receipt_show_tax: true,
      receipt_show_donation: false,
    },
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get<ApiResponse<ReceiptSettingsData>>("/settings/receipt")
        const d = res.data.data
        setValue("receipt_footer_message", d.receipt_footer_message ?? "")
        setValue("receipt_show_tax", Boolean(d.receipt_show_tax))
        setValue("receipt_show_donation", Boolean(d.receipt_show_donation))
        setLogoUrl(d.receipt_logo ?? null)
      } catch {
        toast({
          title: "Error",
          description: "Failed to load receipt settings.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [setValue, toast])

  const onSubmit = async (data: ReceiptSettingsForm) => {
    setSaving(true)
    try {
      await api.put<ApiResponse<ReceiptSettingsData>>("/settings/receipt", data)
      toast({ title: "Saved", description: "Receipt settings updated successfully." })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({
        title: "Error",
        description: error.response?.data?.message ?? "Failed to save settings.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("logo", file)
      const res = await api.post<ApiResponse<{ receipt_logo: string }>>(
        "/settings/receipt/logo",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      setLogoUrl(res.data.data.receipt_logo)
      toast({ title: "Logo Uploaded", description: "Receipt logo saved successfully." })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({
        title: "Upload Failed",
        description: error.response?.data?.message ?? "Could not upload logo.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleLogoRemove = async () => {
    setIsRemoving(true)
    try {
      await api.delete("/settings/receipt/logo")
      setLogoUrl(null)
      toast({ title: "Logo Removed", description: "Receipt logo has been removed." })
    } catch {
      toast({ title: "Error", description: "Could not remove logo.", variant: "destructive" })
    } finally {
      setIsRemoving(false)
    }
  }

  const footerValue = watch("receipt_footer_message")
  const showTax = watch("receipt_show_tax")
  const showDonation = watch("receipt_show_donation")

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-72 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-5 bg-muted rounded animate-pulse mb-2" />
                <div className="h-6 w-40 bg-muted rounded animate-pulse mb-1" />
                <div className="h-4 w-56 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
          Receipt Customization
        </h1>
        <p className="text-sm text-muted-foreground">
          Customize how your printed receipts look for customers.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Receipt className="w-5 h-5 text-primary mb-2" aria-hidden="true" />
              <CardTitle>Receipt Logo</CardTitle>
              <CardDescription>
                Upload a logo to display at the top of every printed receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogoUpload
                currentLogoUrl={logoUrl}
                onUpload={handleLogoUpload}
                onRemove={handleLogoRemove}
                isUploading={isUploading}
                isRemoving={isRemoving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receipt Content</CardTitle>
              <CardDescription>
                Set the footer message and choose which lines appear on receipts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FooterMessageInput
                value={footerValue}
                onChange={(v) =>
                  setValue("receipt_footer_message", v, { shouldValidate: true })
                }
                error={errors.receipt_footer_message?.message}
              />

              <Separator />

              <div role="group" aria-labelledby="toggles-heading">
                <p id="toggles-heading" className="text-sm font-medium mb-1">
                  Line Item Visibility
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Control which line items print on the receipt.
                </p>
                <ToggleRow
                  id="show-tax"
                  label="Show Tax Line"
                  description="Display the tax amount as a separate line on the receipt."
                  checked={showTax}
                  onCheckedChange={(v) => setValue("receipt_show_tax", v)}
                />
                <Separator />
                <ToggleRow
                  id="show-donation"
                  label="Show Donation Line"
                  description="Display an optional donation contribution line on the receipt."
                  checked={showDonation}
                  onCheckedChange={(v) => setValue("receipt_show_donation", v)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            type="submit"
            className="gap-2 w-full sm:w-auto"
            disabled={saving}
            aria-label={saving ? "Saving receipt settings" : "Save receipt settings"}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="w-4 h-4" aria-hidden="true" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
