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
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null)
  const [timeLeft, setTimeLeft] = React.useState<string>("")
  const lastAttemptedEmail = React.useRef<string>("")

  // Page load pe localStorage se lockout restore karo
  React.useEffect(() => {
    const stored = localStorage.getItem('pos_lockout')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.until > Date.now()) {
        setLockoutUntil(parsed.until)
        setEmail(parsed.email || "")
      } else {
        localStorage.removeItem('pos_lockout')
      }
    }
  }, [])

  // Timer logic
  React.useEffect(() => {
    if (!lockoutUntil) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = lockoutUntil - now;

      if (diff <= 0) {
        setLockoutUntil(null);
        setTimeLeft("");
        localStorage.removeItem('pos_lockout')
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockoutUntil) return;
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
        // Handle lockout from response
        if (response.data.lockUntil) {
          setLockoutUntil(response.data.lockUntil);
          localStorage.setItem('pos_lockout', JSON.stringify({ until: response.data.lockUntil, email: trimmedEmail }))
        }

        toast({
          title: "Login Failed",
          description: response.data.message || 'Login failed',
          variant: "destructive"
        })
      }
    } catch (error: any) {
      if (error.response?.data?.lockUntil) {
        setLockoutUntil(error.response.data.lockUntil);
        localStorage.setItem('pos_lockout', JSON.stringify({ until: error.response.data.lockUntil, email: lastAttemptedEmail.current }))
      }

      toast({
        title: "Login Failed",
        description: error.response?.data?.message || 'Login failed. Please try again.',
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
            {lockoutUntil && (
              <div className="bg-destructive/10 border border-white/20 text-destructive rounded-lg p-3 text-sm text-center font-medium animate-pulse">
                Account locked. Try again in {timeLeft}
              </div>
            )}
            
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
                  disabled={isLoading || !!lockoutUntil}
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
                  disabled={isLoading || !!lockoutUntil}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || !!lockoutUntil}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" disabled={!!lockoutUntil} />
                <span className="text-muted-foreground">Remember me</span>
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={isLoading || !!lockoutUntil}
            >
              {lockoutUntil ? `Locked (${timeLeft})` : isLoading ? "Signing in..." : "Sign In"}
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
