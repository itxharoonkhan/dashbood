"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import api from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const lastAttemptedEmail = React.useRef<string>("")

  const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const trimmedEmail = email.trim();
      lastAttemptedEmail.current = trimmedEmail
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        toast({
          title: "Validation Error",
          description: "Email and password are required",
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }

      if (!isEmailValid(trimmedEmail)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address (e.g. user@example.com)",
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }

      const response = await api.post('/auth/login', {
        email: trimmedEmail,
        password: trimmedPassword
      })

      if (response.data.success) {
        // ... success logic unchanged
        login(response.data.token, {
          id: response.data.user.id.toString(),
          name: response.data.user.name,
          role: response.data.user.role,
          permissions: response.data.user.permissions || [],
        })

        toast({
          title: "Success!",
          description: "Login successful!"
        })

        const user = response.data.user;
        const permissions = user.permissions || [];

        // Fetch tenant settings to set posMode (retail/restaurant)
        if (user.role !== 'superadmin') {
          try {
            const settingsRes = await api.get('/settings')
            const mode = settingsRes.data?.data?.mode || 'retail'
            localStorage.setItem('posMode', mode)
            window.dispatchEvent(new CustomEvent('posModeChanged', { detail: mode }))
          } catch {
            localStorage.setItem('posMode', 'retail')
          }
        }

        if (user.role === 'superadmin') {
          router.push("/superadmin")
        } else if (user.role === 'admin' || permissions.includes('sales')) {
          router.push("/sales")
        } else if (permissions.length > 0) {
          const routeMap: Record<string, string> = {
            'dashboard': '/dashboard',
            'sales': '/sales',
            'inventory': '/inventory',
            'customers': '/customers',
            'reports': '/reports',
            'settings': '/settings'
          }
          router.push(routeMap[permissions[0]] || "/sales")
        } else {
          router.push("/sales")
        }
      } else {
        toast({
          title: "Login Failed",
          description: response.data.message || 'Login failed',
          variant: "destructive"
        })
      }
    } catch (error: any) {
      const status = error.response?.status
      const backendMessage = error.response?.data?.message

      toast({
        title: status === 429 ? "Too many requests" : "Login Failed",
        description: status === 429
          ? (backendMessage || 'Please wait before trying again.')
          : (backendMessage || 'Login failed. Please try again.'),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex items-center justify-center">
            <Image
              src="/Logoo.png"
              alt="Software Elites"
              width={220}
              height={72}
              priority
              className="object-contain"
            />
          </div>
          <div>
            <CardDescription className="text-base">
              Sign in to your account to continue
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
              <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>

            <div className="flex items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
