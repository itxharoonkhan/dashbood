"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Store, Mail, Lock, Eye, EyeOff, User, Phone, UserPlus, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export default function SignupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "cashier",
    permissions: [] as string[]
  })

  const permissionsList = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales / POS' },
    { id: 'inventory', label: 'Inventory / Products' },
    { id: 'customers', label: 'Customers' },
    { id: 'reports', label: 'Reports' },
    { id: 'settings', label: 'Settings' }
  ]

  const passwordRules = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number (0-9)", test: (p: string) => /[0-9]/.test(p) },
    { label: "One symbol (!@#$%^&*)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ]

  const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => {
      const newPermissions = checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(p => p !== permissionId)
      return { ...prev, permissions: newPermissions }
    })
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate email domain
    if (!isEmailValid(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address (e.g. user@example.com)",
        variant: "destructive"
      })
      return
    }

    // Validate all password rules
    const failedRule = passwordRules.find(r => !r.test(formData.password))
    if (failedRule) {
      toast({
        title: "Weak Password",
        description: `Password requirement not met: ${failedRule.label}`,
        variant: "destructive"
      })
      return
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    try {
      const token = localStorage.getItem('authToken')
      
      // Check if user is logged in and is admin
      const userRole = localStorage.getItem('userRole')
      if (!token || userRole !== 'admin') {
        toast({
          title: "Access Denied",
          description: "Only admins can create new accounts",
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }

      const response = await api.post('/auth/create-cashier', {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password.trim(),
        role: formData.role,
        permissions: formData.permissions
      })

      if (response.data.success) {
        toast({
          title: "Success!",
          description: "Cashier account created successfully!"
        })
        // Redirect to login after successful creation
        setTimeout(() => {
          router.push("/login")
        }, 1000)
      } else {
        toast({
          title: "Error",
          description: response.data.message || 'Failed to create account',
          variant: "destructive"
        })
      }
    } catch (error: any) {
      console.error('Signup error:', error)
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to create account. Please try again.',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 py-8">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
            <Store className="w-8 h-8 text-accent-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Elites POS</CardTitle>
            <CardDescription className="text-base">
              Create your account to get started
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@elites.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+92 300 1234567"
                  className="pl-10"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-10 w-full rounded-md border border-white bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                value={formData.role}
                onChange={(e) => handleChange("role", e.target.value)}
                disabled={isLoading}
              >
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Permissions */}
            <div className="space-y-3 pt-2">
              <Label className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Page Permissions
              </Label>
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-white">
                {permissionsList.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={permission.id} 
                      checked={formData.permissions.includes(permission.id)}
                      onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={permission.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {permission.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select the pages this user is allowed to access</p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {/* Password Requirements */}
              {formData.password.length > 0 && (
                <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5">
                  {passwordRules.map((rule) => {
                    const passed = rule.test(formData.password)
                    return (
                      <div key={rule.label} className="flex items-center gap-2 text-xs">
                        <span className={passed ? "text-green-500" : "text-destructive"}>
                          {passed ? "✓" : "✗"}
                        </span>
                        <span className={passed ? "text-green-500" : "text-muted-foreground"}>
                          {rule.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  className="pl-10 pr-10"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={isLoading}
            >
              {isLoading ? (
                "Creating Account..."
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create Account
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                Sign In
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
