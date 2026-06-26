"use client"

import * as React from "react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileBarChart,
  Settings,
  LogOut,
  ChevronRight,
  Globe,
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Clock,
  Tag,
  Truck,
  Receipt,
  ChefHat,
  UtensilsCrossed,
  RotateCcw,
  TrendingDown,
  Building2,
  Bell,
  Heart,
  Sparkles,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { language, setLanguage, t } = useLanguage()
  const { logout } = useAuth()
  const { toast } = useToast()
  const [userRole, setUserRole] = React.useState<string>("admin")
  const [posMode, setPosMode] = React.useState<string>("retail")

  const scrollDivRef = React.useRef<HTMLDivElement>(null)

  const saveScroll = React.useCallback(() => {
    if (scrollDivRef.current) {
      sessionStorage.setItem('sidebarScroll', String(scrollDivRef.current.scrollTop))
    }
  }, [])

  // Mount pe restore karo
  React.useEffect(() => {
    const saved = sessionStorage.getItem('sidebarScroll')
    if (!saved) return
    const pos = parseInt(saved)
    // Double restore — pehle immediate, phir timeout ke baad
    if (scrollDivRef.current) scrollDivRef.current.scrollTop = pos
    const t = setTimeout(() => {
      if (scrollDivRef.current) scrollDivRef.current.scrollTop = pos
    }, 50)
    return () => clearTimeout(t)
  }, [])

  // Load user role and posMode from localStorage on mount
  React.useEffect(() => {
    const role = localStorage.getItem('userRole') || 'admin'
    setUserRole(role)
    const mode = localStorage.getItem('posMode') || 'retail'
    setPosMode(mode)
  }, [])

  // React to posMode changes from Settings page (same tab)
  React.useEffect(() => {
    const handler = (e: Event) => {
      setPosMode((e as CustomEvent).detail)
    }
    window.addEventListener('posModeChanged', handler)
    return () => window.removeEventListener('posModeChanged', handler)
  }, [])

  // Create User Dialog State
  const [isCashierOpen, setIsCashierOpen] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [cashierData, setCashierData] = React.useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "cashier",
    permissions: ["sales"] as string[]
  })

  const availablePages = [
    { id: "dashboard", label: "Dashboard" },
    { id: "sales", label: "POS" },
    { id: "shifts", label: "Shifts" },
    { id: "inventory", label: "Inventory" },
    { id: "customers", label: "Customers" },
    { id: "reports", label: "Reports" },
    { id: "coupons", label: "Coupons" },
    { id: "suppliers", label: "Suppliers" },
    { id: "expenses", label: "Expenses" },
    { id: "tables", label: "Tables" },
    { id: "kitchen", label: "Kitchen" },
    { id: "settings", label: "Settings" },
  ]

  const togglePermission = (pageId: string) => {
    setCashierData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(pageId)
        ? prev.permissions.filter(p => p !== pageId)
        : [...prev.permissions, pageId]
    }))
  }

  // Filter menu items based on role and permissions
  const allItems = [
    {
      title: t('nav.dashboard'),
      url: "/dashboard",
      icon: LayoutDashboard,
      roles: ['admin', 'cashier'],
      permission: 'dashboard'
    },
    {
      title: t('nav.posTerminal'),
      url: "/sales",
      icon: ShoppingCart,
      roles: ['admin', 'cashier'],
      permission: 'sales'
    },
    {
      title: "Shifts",
      url: "/shifts",
      icon: Clock,
      roles: ['admin', 'cashier'],
      permission: 'shifts'
    },
    {
      title: t('nav.inventory'),
      url: "/inventory",
      icon: Package,
      roles: ['admin', 'cashier'],
      permission: 'inventory'
    },
    {
      title: t('nav.customers'),
      url: "/customers",
      icon: Users,
      roles: ['admin', 'cashier'],
      permission: 'customers'
    },
    {
      title: t('nav.reports'),
      url: "/reports",
      icon: FileBarChart,
      roles: ['admin', 'cashier'],
      permission: 'reports'
    },
    {
      title: "Coupons",
      url: "/coupons",
      icon: Tag,
      roles: ['admin'],
      permission: 'coupons'
    },
    {
      title: "Suppliers",
      url: "/suppliers",
      icon: Truck,
      roles: ['admin'],
      permission: 'suppliers'
    },
    {
      title: "Expenses",
      url: "/expenses",
      icon: TrendingDown,
      roles: ['admin', 'cashier'],
      permission: 'expenses'
    },
    {
      title: "Loyalty",
      url: "/loyalty",
      icon: Heart,
      roles: ['admin', 'cashier'],
      permission: 'customers'
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: Bell,
      roles: ['admin', 'cashier'],
      permission: 'dashboard'
    },
    {
      title: "AI Insights",
      url: "/ai",
      icon: Sparkles,
      roles: ['admin'],
      permission: 'dashboard'
    },
    {
      title: t('nav.settings'),
      url: "/settings",
      icon: Settings,
      roles: ['admin', 'cashier'],
      permission: 'settings'
    },
    {
      title: "Receipt Settings",
      url: "/receipt-settings",
      icon: Receipt,
      roles: ['admin'],
      permission: 'settings'
    },
    {
      title: "Super Admin",
      url: "/superadmin",
      icon: Building2,
      roles: ['superadmin'],
      permission: 'superadmin',
      superadminOnly: true,
    },
    {
      title: "Tables",
      url: "/tables",
      icon: UtensilsCrossed,
      roles: ['admin', 'cashier'],
      permission: 'tables',
      restaurantOnly: true,
    },
    {
      title: "Kitchen",
      url: "/kitchen",
      icon: ChefHat,
      roles: ['admin', 'cashier'],
      permission: 'kitchen',
      restaurantOnly: true,
    },
  ]

  // Filter items based on user role, permissions, and posMode
  const userPermissions: string[] = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('userPermissions') || '[]')
    : [];

  const items = allItems.filter((item: any) => {
    // Superadmin sees only the Super Admin page
    if (userRole === 'superadmin') return item.superadminOnly === true;

    // Hide superadmin-only items for everyone else
    if (item.superadminOnly) return false;

    // Hide restaurant-only items when in retail mode
    if (item.restaurantOnly && posMode !== 'restaurant') return false;

    // Admin with NO permissions = full admin → sab pages mile
    if (userRole === 'admin' && userPermissions.length === 0) return true;

    // Admin ya cashier dono ke liye permissions check karo
    const roleAllowed = item.roles.includes(userRole);
    const hasPermission = userPermissions.includes(item.permission);

    return roleAllowed && hasPermission;
  })

  const passwordRules = [
    { label: "At least 8 characters",    test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number (0-9)",           test: (p: string) => /[0-9]/.test(p) },
    { label: "One symbol (!@#$%^&*)",      test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ]

  const isEmailValid = (email: string) => {
    const validTLDs = /\.(com|net|org|edu|gov|pk|co|io|info|biz|me|us|uk|ae|sa|store|shop|online|app|dev)(\.[a-z]{2})?$/i
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && validTLDs.test(email)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cashierData.name || !cashierData.email || !cashierData.password) {
      toast({
        title: "Missing Fields",
        description: "Please fill in name, email and password.",
        variant: "destructive"
      })
      return
    }

    if (!isEmailValid(cashierData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address (e.g. user@example.com)",
        variant: "destructive"
      })
      return
    }

    const failedRule = passwordRules.find(r => !r.test(cashierData.password))
    if (failedRule) {
      toast({
        title: "Weak Password",
        description: `Password requirement not met: ${failedRule.label}`,
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await api.post('/auth/create-cashier', {
        name: cashierData.name,
        email: cashierData.email,
        password: cashierData.password,
        role: cashierData.role,
        permissions: cashierData.permissions
      })

      if (response.data.success) {
        toast({
          title: "Success!",
          description: `User ${cashierData.name} has been created successfully!`,
        })
        setIsCashierOpen(false)
        setCashierData({ name: "", email: "", phone: "", password: "", role: "cashier", permissions: ["sales"] })
      } else {
        toast({
          title: "Error",
          description: response.data.message || "Failed to create user",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = () => {
    logout()
  }

  // Close sidebar on mobile when route changes
  React.useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon">

      <SidebarHeader className="h-16 flex items-center justify-center border-b">
        {isCollapsed ? (
          <div className="w-8 h-8 rounded overflow-hidden flex items-center justify-center">
            <img src="/Logoo.png" alt="SE" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2">
            <img src="/Logoo.png" alt="Software Elites" className="h-9 w-auto object-contain" />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <div
          ref={scrollDivRef}
          onScroll={saveScroll}
          style={{ overflowY: 'auto', height: '100%', paddingTop: '16px' }}
        >
          <SidebarMenu className="space-y-4">
            {items.map((item) => {
              if (item.url === '/reports') {
                const isReportsActive = pathname.startsWith('/reports')
                const subItems = [
                  { href: '/reports', label: 'Overview', icon: FileBarChart },
                  { href: '/reports/return-history', label: 'Return History', icon: RotateCcw },
                  { href: '/reports/coupons', label: 'Coupons', icon: Tag },
                ]
                return (
                  <SidebarMenuItem key={item.title}>
                    <div className="group/reports">
                      <SidebarMenuButton
                        asChild
                        isActive={isReportsActive}
                        tooltip={item.title}
                        className="py-5"
                      >
                        <Link href="/reports" onClick={saveScroll}>
                          <FileBarChart />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto opacity-50 transition-transform duration-200 group-hover/reports:rotate-90" />
                        </Link>
                      </SidebarMenuButton>

                      {/* Inline sub-items — show on hover within sidebar */}
                      <div className="hidden group-hover/reports:flex flex-col gap-0.5 mt-0.5 ml-4 pl-3 border-l border-border">
                        {subItems.map(sub => {
                          const Icon = sub.icon
                          const active = pathname === sub.href
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={saveScroll}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                                active
                                  ? "text-primary font-semibold"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              {sub.label}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </SidebarMenuItem>
                )
              }

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="py-5"
                  >
                    <Link href={item.url} onClick={saveScroll}>
                      {(() => { const Icon = item.icon; return <Icon />; })()}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {/* Create User Button - Admin Only (not superadmin) */}
          {userRole === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setIsCashierOpen(true)}
                tooltip="Create User"
                className="py-5 bg-purple-500/10 hover:bg-purple-500 text-foreground hover:text-white transition-all duration-200"
              >
                <UserPlus />
                <span>Create User</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Language Toggle */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
              tooltip={language === 'en' ? 'اردو' : 'English'}
              className="py-5"
            >
              <Globe />
              <span>{language === 'en' ? 'اردو' : 'English'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Sign Out */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="text-destructive hover:text-destructive"
            >
              <LogOut />
              <span>{t('nav.signOut')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <Dialog open={isCashierOpen} onOpenChange={setIsCashierOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Fill in the details and assign permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} autoComplete="off">
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="create-user-name"
                      name="new-user-name"
                      type="text"
                      placeholder="Full name"
                      className="pl-9 h-9 text-sm"
                      value={cashierData.name}
                      onChange={(e) => setCashierData({ ...cashierData, name: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="create-user-email"
                      name="new-user-email"
                      type="email"
                      placeholder="user@example.com"
                      className="pl-9 h-9 text-sm"
                      value={cashierData.email}
                      onChange={(e) => setCashierData({ ...cashierData, email: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Role Selection */}
                <div className="space-y-1.5">
                  <Label>Assign Role</Label>
                  <Select 
                    value={cashierData.role} 
                    onValueChange={(v) => setCashierData({ ...cashierData, role: v })}
                  >
                    <SelectTrigger className="w-full h-9 text-sm">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="create-user-password"
                      name="new-user-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="pl-9 pr-9 h-9 text-sm"
                      value={cashierData.password}
                      onChange={(e) => setCashierData({ ...cashierData, password: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-0.5 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Live Password Requirements */}
              {cashierData.password.length > 0 && (
                <div className="bg-muted/30 border border-border rounded-lg p-2.5 space-y-1">
                  {passwordRules.map((rule) => {
                    const passed = rule.test(cashierData.password)
                    return (
                      <div key={rule.label} className="flex items-center gap-2 text-[11px]">
                        <span className={passed ? "text-green-500" : "text-destructive"}>{passed ? "✓" : "✗"}</span>
                        <span className={passed ? "text-green-500" : "text-muted-foreground"}>{rule.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Permissions */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Access:</Label>
                <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2.5 rounded-lg border border-white">
                  {availablePages.map((page) => (
                    <div key={page.id} className="flex items-center space-x-1.5">
                      <Checkbox 
                        id={`page-${page.id}`} 
                        checked={cashierData.permissions.includes(page.id)}
                        onCheckedChange={() => togglePermission(page.id)}
                        className="h-3.5 w-3.5"
                      />
                      <Label 
                        htmlFor={`page-${page.id}`}
                        className="text-[10px] font-medium cursor-pointer leading-none"
                      >
                        {page.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsCashierOpen(false)} className="h-9 text-sm">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="h-9 text-sm">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Create User
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
