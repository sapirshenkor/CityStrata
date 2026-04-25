import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatApiError } from '@/lib/formatApiError'
import { loginFormSchema, type LoginFormValues } from '@/lib/authFormSchemas'
import { AppHeader } from '@/components/layout/AppHeader'
import UserBar from '@/components/UserBar'

export default function LoginPage() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/map'

  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true })
    }
  }, [user, loading, navigate, from])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const onValid = async (data: LoginFormValues) => {
    setServerError('')
    try {
      await login(data.email, data.password)
    } catch (err) {
      setServerError(formatApiError(err))
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader variant="map">
        <UserBar />
      </AppHeader>
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 rounded-xl bg-gradient-to-br from-primary to-slate-800 px-4 py-3 text-primary-foreground">
            <CardTitle className="text-2xl font-bold text-primary-foreground">CityStrata</CardTitle>
            <CardDescription className="text-primary-foreground/90">Sign in to continue</CardDescription>
          </div>
          <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Eilat · Municipality
          </span>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(onValid)}
            noValidate
            aria-label="Sign in"
          >
            {serverError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {serverError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@municipality.gov.il"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                {...register('email')}
              />
              {errors.email ? (
                <p id="login-email-error" className="text-sm text-destructive" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                {...register('password')}
              />
              {errors.password ? (
                <p id="login-password-error" className="text-sm text-destructive" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
