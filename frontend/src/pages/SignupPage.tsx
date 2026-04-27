import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatApiError } from '@/lib/formatApiError'
import { signupFormSchema, toSignupPayload, type SignupFormValues } from '@/lib/authFormSchemas'
import { AppHeader } from '@/components/layout/AppHeader'
import UserBar from '@/components/UserBar'

export default function SignupPage() {
  const { signup, user, loading } = useAuth()
  const navigate = useNavigate()

  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (!loading && user) {
      navigate('/map', { replace: true })
    }
  }, [user, loading, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      department: '',
      password: '',
    },
  })

  const onValid = async (values: SignupFormValues) => {
    setServerError('')
    try {
      await signup(toSignupPayload(values))
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
        <Card className="w-full max-w-lg border-border shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 rounded-xl bg-gradient-to-br from-primary to-slate-800 px-4 py-3 text-primary-foreground">
            <CardTitle className="text-2xl font-bold text-primary-foreground">יצירת חשבון</CardTitle>
            <CardDescription className="text-primary-foreground/90">גישה לרשות מקומית ב־CityStrata</CardDescription>
          </div>
          <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            אילת · סמל יישוב 2600
          </span>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(onValid)}
            noValidate
            aria-label="יצירת חשבון"
          >
            {serverError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {serverError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="su-first">שם פרטי</Label>
                <Input
                  id="su-first"
                  autoComplete="given-name"
                  aria-invalid={errors.first_name ? 'true' : 'false'}
                  aria-describedby={errors.first_name ? 'su-first-error' : undefined}
                  {...register('first_name')}
                />
                {errors.first_name ? (
                  <p id="su-first-error" className="text-sm text-destructive" role="alert">
                    {errors.first_name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-last">שם משפחה</Label>
                <Input
                  id="su-last"
                  autoComplete="family-name"
                  aria-invalid={errors.last_name ? 'true' : 'false'}
                  aria-describedby={errors.last_name ? 'su-last-error' : undefined}
                  {...register('last_name')}
                />
                {errors.last_name ? (
                  <p id="su-last-error" className="text-sm text-destructive" role="alert">
                    {errors.last_name.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="su-email">דוא"ל עבודה</Label>
              <Input
                id="su-email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'su-email-error' : undefined}
                {...register('email')}
              />
              {errors.email ? (
                <p id="su-email-error" className="text-sm text-destructive" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="su-phone">טלפון</Label>
              <Input
                id="su-phone"
                type="tel"
                autoComplete="tel"
                placeholder="אופציונלי"
                {...register('phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="su-dept">מחלקה</Label>
              <Input id="su-dept" placeholder="אופציונלי" {...register('department')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="su-pass">סיסמה</Label>
              <Input
                id="su-pass"
                type="password"
                autoComplete="new-password"
                placeholder="לפחות 8 תווים"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'su-pass-error' : undefined}
                {...register('password')}
              />
              {errors.password ? (
                <p id="su-pass-error" className="text-sm text-destructive" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'יוצר חשבון...' : 'יצירת חשבון'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            כבר רשומים?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              התחברות
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
