"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Store, Bell, CreditCard, Palette, Save, Loader2, Users, LockOpen, Lock, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTheme } from "@/contexts/theme-context"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import { AxiosError } from "axios"

interface Account {
  id: number
  name: string
  email: string
  role: string
  failedAttempts: number
  lockUntil: string | null
  created_at: string
}

interface Settings {
  store_name: string
  store_address: string
  store_phone: string
  store_email: string
  store_gstin: string
  currency: string
  tax_rate: number
  items_per_page: number
  theme: string
  invoice_prefix: string
  low_stock_alert: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const { theme, toggleTheme, setTheme } = useTheme()
  const { toast } = useToast()
  const { t, isRTL } = useLanguage()
  const [settings, setSettings] = React.useState<Settings>({
    store_name: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    store_gstin: '',
    currency: 'PKR',
    tax_rate: 5,
    items_per_page: 25,
    theme: 'light',
    invoice_prefix: 'INV',
    low_stock_alert: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = React.useState(false)
  const [unlockingId, setUnlockingId] = React.useState<number | null>(null)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<number | null>(null)
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('userRole') === 'admin'

  const fetchAccounts = React.useCallback(async () => {
    setAccountsLoading(true)
    try {
      const res = await api.get("/auth/accounts")
      setAccounts(res.data.data || [])
    } catch (err) {
      console.error("Failed to fetch accounts", err)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const handleUnlock = async (id: number) => {
    setUnlockingId(id)
    try {
      await api.put(`/auth/unlock/${id}`)
      toast({ title: "Account Unlocked", description: "Account has been successfully unlocked." })
      fetchAccounts()
    } catch (err) {
      toast({ title: "Error", description: "Failed to unlock account.", variant: "destructive" })
    } finally {
      setUnlockingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await api.delete(`/auth/accounts/${id}`)
      toast({ title: "Account Deleted", description: "Account has been permanently deleted." })
      setConfirmDeleteId(null)
      fetchAccounts()
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to delete account.", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const getLockStatus = (account: Account) => {
    if (!account.lockUntil) return null
    const lockTime = new Date(account.lockUntil)
    const now = new Date()
    if (lockTime > now) {
      const remainingMins = Math.ceil((lockTime.getTime() - now.getTime()) / 60000)
      return remainingMins
    }
    return null
  }

  // Check if user is admin
  React.useEffect(() => {
    const role = localStorage.getItem('userRole')
    // Temporarily allowing both for visibility
    if (role !== 'admin' && role !== 'cashier') {
      router.replace('/dashboard')
    }
  }, [router])

  React.useEffect(() => {
    if (isAdmin) fetchAccounts()
  }, [isAdmin, fetchAccounts])

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings")
        const raw = res.data.data || res.data.settings || {}
        setSettings({
          store_name: raw.store_name || '',
          store_address: raw.store_address || '',
          store_phone: raw.store_phone || '',
          store_email: raw.store_email || '',
          store_gstin: raw.store_gstin || '',
          currency: raw.currency || 'PKR',
          tax_rate: parseInt(raw.tax_rate) || 5,
          items_per_page: raw.items_per_page || 25,
          theme: raw.theme || 'light',
          invoice_prefix: raw.invoice_prefix || 'INV',
          low_stock_alert: raw.low_stock_alert !== undefined ? Boolean(raw.low_stock_alert) : true,
        })
      } catch (err) {
        console.error("Failed to load settings", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSaveChanges = async () => {
    // Only admin can save
    if (localStorage.getItem('userRole') !== 'admin') {
      toast({
        title: "Permission Denied",
        description: "Only admins can change store settings.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      await api.put("/settings", settings)
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (value: string) => {
    setTheme(value as "light" | "dark")
    setSettings(prev => ({ ...prev, theme: value }))
    toast({
      title: "Theme changed",
      description: `Switched to ${value} mode.`,
    })
  }

  const updateSetting = (key: keyof Settings, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex flex-col gap-1">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-5 bg-muted rounded animate-pulse mb-2" />
                <div className="h-6 w-32 bg-muted rounded animate-pulse mb-1" />
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "cashier"]}>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">{t('settings.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Store className="w-5 h-5 text-primary mb-2" />
            <CardTitle>{t('settings.storeInfo')}</CardTitle>
            <CardDescription>{t('settings.updateStoreDetails')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.storeName')}</label>
              <Input value={settings.store_name ?? ""} onChange={(e) => updateSetting("store_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.storeAddress')}</label>
              <Input value={settings.store_address ?? ""} onChange={(e) => updateSetting("store_address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.contactNumber')}</label>
              <Input value={settings.store_phone ?? ""} onChange={(e) => updateSetting("store_phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.email')}</label>
              <Input value={settings.store_email ?? ""} onChange={(e) => updateSetting("store_email", e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">GSTIN</label>
              <Input value={settings.store_gstin ?? ""} onChange={(e) => updateSetting("store_gstin", e.target.value)} placeholder="GST Identification Number" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Bell className="w-5 h-5 text-primary mb-2" />
            <CardTitle>{t('settings.notifications')}</CardTitle>
            <CardDescription>{t('settings.configureNotifications')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">{t('settings.lowStockAlerts')}</label>
                <p className="text-xs text-muted-foreground">{t('settings.lowStockDesc')}</p>
              </div>
              <Switch checked={settings.low_stock_alert} onCheckedChange={(v) => updateSetting("low_stock_alert", v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">{t('settings.dailySalesSummary')}</label>
                <p className="text-xs text-muted-foreground">{t('settings.dailySalesDesc')}</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">{t('settings.newCustomerAlerts')}</label>
                <p className="text-xs text-muted-foreground">{t('settings.newCustomerDesc')}</p>
              </div>
              <Switch defaultChecked={false} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CreditCard className="w-5 h-5 text-primary mb-2" />
            <CardTitle>{t('settings.paymentSettings')}</CardTitle>
            <CardDescription>{t('settings.configurePayment')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.defaultCurrency')}</label>
              <Select value={settings.currency ?? "PKR"} onValueChange={(v) => updateSetting("currency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR (Rs.)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.taxRate')}</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.tax_rate ?? 5}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val >= 0 && val <= 100) {
                      updateSetting("tax_rate", val)
                    }
                  }}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">%</span>
              </div>
              <p className="text-xs text-muted-foreground">0% se 100% tak koi bhi value enter karein (e.g. 3, 5, 7.5)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Palette className="w-5 h-5 text-primary mb-2" />
            <CardTitle>{t('settings.appearance')}</CardTitle>
            <CardDescription>{t('settings.customizeLook')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.theme')}</label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('settings.currentTheme')}: <span className="font-medium">{theme}</span>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.itemsPerPage')}</label>
              <Select value={settings.items_per_page.toString()} onValueChange={(v) => updateSetting("items_per_page", parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <Users className="w-5 h-5 text-primary mb-2" />
            <CardTitle>Account Management</CardTitle>
            <CardDescription>
              All registered accounts — {accounts.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No accounts found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Role</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => {
                      const lockedMins = getLockStatus(account)
                      const isLocked = lockedMins !== null
                      return (
                        <tr key={account.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-3 font-medium">{account.name}</td>
                          <td className="py-3 px-3 text-muted-foreground">{account.email}</td>
                          <td className="py-3 px-3">
                            <Badge variant={account.role === 'admin' ? 'default' : 'secondary'}>
                              {account.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            {isLocked ? (
                              <div className="flex items-center gap-1 text-destructive">
                                <Lock className="w-3 h-3" />
                                <span className="text-xs">Locked ({lockedMins} min left)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-green-600">
                                <LockOpen className="w-3 h-3" />
                                <span className="text-xs">Active</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {isLocked && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleUnlock(account.id)}
                                  disabled={unlockingId === account.id}
                                >
                                  {unlockingId === account.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <LockOpen className="w-3 h-3" />
                                  )}
                                  Unlock
                                </Button>
                              )}
                              {account.email !== 'admin@elites.com' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setConfirmDeleteId(account.id)}
                                  disabled={deletingId === account.id}
                                >
                                  {deletingId === account.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              * Passwords are securely encrypted and cannot be displayed.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Delete Karna Chahte Hain?</AlertDialogTitle>
            <AlertDialogDescription>
              Yeh action permanent hai. Account database se hamesha ke liye delete ho jayega aur wapas nahi aa sakta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
            >
              Haan, Delete Karo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Button className="gap-2 w-full sm:w-auto" onClick={handleSaveChanges} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : t('settings.saveChanges')}
        </Button>
      </div>
    </div>
    </ProtectedRoute>
  )
}
