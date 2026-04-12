import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import axios from 'axios'
import api from '../../services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { communityProfilesKeys } from '@/hooks/useCommunityProfilesData'
import {
  COMMUNITY_TYPES,
  HOUSING_PREFERENCES,
  communityFormSchema,
  communityFormValuesToPayload,
  type CommunityFormValues,
} from './communityFormSchema'

const defaultValues: CommunityFormValues = {
  community_name: '',
  leader_name: '',
  contact_phone: '',
  contact_email: '',
  community_type: 'neighborhood',
  total_families: 1,
  total_people: 1,
  infants: 0,
  preschool: 0,
  elementary: 0,
  youth: 0,
  adults: 1,
  seniors: 0,
  cohesion_importance: 3,
  housing_preference: 'hotel',
  needs_synagogue: false,
  needs_community_center: false,
  needs_education_institution: false,
  infrastructure_notes: '',
}

export interface CommunityFormProps {
  className?: string
  onSuccess?: (data: unknown) => void
}

const COMPOSITION_FIELDS: { name: keyof Pick<
  CommunityFormValues,
  'infants' | 'preschool' | 'elementary' | 'youth' | 'adults' | 'seniors'
>; label: string }[] = [
  { name: 'infants', label: 'תינוקות (0–1)' },
  { name: 'preschool', label: 'גיל גן (2–5)' },
  { name: 'elementary', label: 'גיל יסודי (6–12)' },
  { name: 'youth', label: 'נוער (13–18)' },
  { name: 'adults', label: 'מבוגרים' },
  { name: 'seniors', label: 'קשישים' },
]

export function CommunityForm({ className, onSuccess }: CommunityFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<CommunityFormValues>({
    resolver: zodResolver(communityFormSchema) as Resolver<CommunityFormValues>,
    defaultValues,
  })

  const compositionSum = (
    [
      form.watch('infants'),
      form.watch('preschool'),
      form.watch('elementary'),
      form.watch('youth'),
      form.watch('adults'),
      form.watch('seniors'),
    ] as number[]
  ).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const totalPeopleWatched = form.watch('total_people')

  const mutation = useMutation({
    mutationFn: async (values: CommunityFormValues) => {
      const payload = communityFormValuesToPayload(values)
      const res = await api.post('/api/communities', payload)
      return res.data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: communityProfilesKeys.list() })
      onSuccess?.(data)
      form.reset(defaultValues)
    },
  })

  const onSubmit = (values: CommunityFormValues) => {
    mutation.mutate(values)
  }

  return (
    <Card className={cn('max-w-[720px] border-[#e0e0e0] shadow-md', className)} dir="rtl">
      <CardHeader className="space-y-1 pb-4">
        <div className="text-lg font-bold text-[#333]">פרופיל קהילה</div>
        <p className="text-xs text-muted-foreground">
          טופס רישום לקהילה / קבוצה המפונים יחד (משלים לפרופיל משפחתי).
        </p>
      </CardHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {mutation.isSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              הפרופיל נשמר בהצלחה.
              {mutation.data?.id != null ? (
                <div className="mt-1.5 text-xs font-bold">מזהה: {String(mutation.data.id)}</div>
              ) : null}
            </div>
          ) : null}

          {mutation.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              {axios.isAxiosError(mutation.error) && mutation.error.response?.data?.detail
                ? typeof mutation.error.response.data.detail === 'string'
                  ? mutation.error.response.data.detail
                  : JSON.stringify(mutation.error.response.data.detail)
                : mutation.error instanceof Error
                  ? mutation.error.message
                  : 'שגיאה בשמירה. נסו שוב.'}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="community_name">שם הקהילה</Label>
              <Input
                id="community_name"
                placeholder="לדוגמה: שכונת הגולן"
                autoComplete="organization"
                {...form.register('community_name')}
              />
              {form.formState.errors.community_name ? (
                <p className="text-xs text-destructive">{form.formState.errors.community_name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="leader_name">שם איש קשר</Label>
              <Input id="leader_name" placeholder="שם מלא" {...form.register('leader_name')} />
              {form.formState.errors.leader_name ? (
                <p className="text-xs text-destructive">{form.formState.errors.leader_name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">טלפון</Label>
              <Input id="contact_phone" type="tel" placeholder="05x-xxxxxxx" {...form.register('contact_phone')} />
              {form.formState.errors.contact_phone ? (
                <p className="text-xs text-destructive">{form.formState.errors.contact_phone.message}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact_email">אימייל</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                {...form.register('contact_email')}
              />
              {form.formState.errors.contact_email ? (
                <p className="text-xs text-destructive">{form.formState.errors.contact_email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="community_type">סוג הקהילה</Label>
              <select
                id="community_type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...form.register('community_type')}
              >
                {COMMUNITY_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {form.formState.errors.community_type ? (
                <p className="text-xs text-destructive">{form.formState.errors.community_type.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_families">מספר משפחות</Label>
              <Input id="total_families" type="number" min={0} step={1} {...form.register('total_families')} />
              {form.formState.errors.total_families ? (
                <p className="text-xs text-destructive">{form.formState.errors.total_families.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_people">מספר נפשות משוער</Label>
              <Input id="total_people" type="number" min={1} step={1} {...form.register('total_people')} />
              {form.formState.errors.total_people ? (
                <p className="text-xs text-destructive">{form.formState.errors.total_people.message}</p>
              ) : null}
            </div>

            <div className="space-y-3 sm:col-span-2">
              <div className="text-sm font-medium">הרכב גילאים</div>
              <p className="text-xs text-muted-foreground">
                סכום הקטגוריות חייב להתאים למספר הנפשות. סכום נוכחי: {compositionSum} /{' '}
                {Number.isFinite(totalPeopleWatched) ? totalPeopleWatched : '—'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {COMPOSITION_FIELDS.map(({ name, label }) => (
                  <div key={name} className="space-y-2">
                    <Label htmlFor={name}>{label}</Label>
                    <Input id={name} type="number" min={0} step={1} {...form.register(name)} />
                    {form.formState.errors[name] ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors[name]?.message as string | undefined}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cohesion_importance">חשיבות שמירה על לכידות (1–5)</Label>
              <Input
                id="cohesion_importance"
                type="number"
                min={1}
                max={5}
                step={1}
                {...form.register('cohesion_importance')}
              />
              {form.formState.errors.cohesion_importance ? (
                <p className="text-xs text-destructive">{form.formState.errors.cohesion_importance.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="housing_preference">העדפת מגורים</Label>
              <select
                id="housing_preference"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...form.register('housing_preference')}
              >
                {HOUSING_PREFERENCES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {form.formState.errors.housing_preference ? (
                <p className="text-xs text-destructive">{form.formState.errors.housing_preference.message}</p>
              ) : null}
            </div>

            <div className="space-y-3 sm:col-span-2">
              <span className="text-sm font-medium leading-none">צרכי תשתית</span>
              <div className="flex flex-col gap-3 rounded-md border border-input p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-input" {...form.register('needs_synagogue')} />
                  צורך בבית כנסת
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    {...form.register('needs_community_center')}
                  />
                  {'צורך במבנה להתכנסות (מתנ"ס)'}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    {...form.register('needs_education_institution')}
                  />
                  צורך במוסד חינוכי ייעודי
                </label>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="infrastructure_notes">הערות נוספות</Label>
              <Textarea
                id="infrastructure_notes"
                placeholder="פרטים נוספים על צרכים, מגבלות או הערות לצוות"
                rows={4}
                {...form.register('infrastructure_notes')}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2 border-t border-[#e9ecef] pt-4">
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={mutation.isPending}>
            {mutation.isPending ? 'שולח…' : 'שלח'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default CommunityForm
