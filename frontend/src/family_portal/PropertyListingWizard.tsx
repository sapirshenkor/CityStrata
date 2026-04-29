import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, Building2, CheckCircle2, PlusCircle, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import UserBar from '@/components/UserBar'
import { createPropertyListing } from '@/services/api'

const propertyTypes = [
  { value: 'apartment', label: 'דירה' },
  { value: 'garden_apt', label: 'דירת גן' },
  { value: 'private_house', label: 'בית פרטי' },
  { value: 'building', label: 'בניין' },
  { value: 'other', label: 'אחר' },
] as const

const unitSchema = z.object({
  floor: z.coerce.number().int().optional(),
  rooms: z.coerce.number().positive('יש להזין מספר חדרים גדול מ-0'),
  bathrooms: z.coerce.number().int().min(0).default(1),
  monthly_price: z.coerce.number().min(0).optional(),
  rental_period: z.string().optional(),
  description: z.string().optional(),
  has_mamad: z.boolean().default(false),
  has_accessibility: z.boolean().default(false),
  allows_pets: z.boolean().default(false),
  has_ac: z.boolean().default(false),
  has_elevator: z.boolean().default(false),
  is_furnished: z.boolean().default(false),
  has_building_shelter: z.boolean().default(false),
})

const wizardSchema = z
  .object({
    property_type: z.enum(['apartment', 'garden_apt', 'private_house', 'building', 'other']),
    property_type_other: z.string().optional(),
    city: z.string().min(1, 'יש להזין יישוב'),
    street: z.string().min(1, 'יש להזין רחוב'),
    house_number: z.string().min(1, 'יש להזין מספר בית'),
    neighborhood: z.string().optional(),
    total_floors: z.coerce.number().int().min(1).optional(),
    parking_spots: z.coerce.number().int().min(0).default(0),
    publisher_name: z.string().min(1, 'יש להזין שם מפרסם'),
    phone_number: z.string().min(1, 'יש להזין טלפון'),
    general_description: z.string().optional(),
    units: z.array(unitSchema).min(1, 'יש להוסיף לפחות יחידת דיור אחת'),
  })
  .superRefine((data, ctx) => {
    if (data.property_type === 'other' && !data.property_type_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['property_type_other'],
        message: 'יש להזין סוג נכס כאשר נבחר "אחר"',
      })
    }
  })

type WizardValues = z.infer<typeof wizardSchema>

const unitDefaults: WizardValues['units'][number] = {
  floor: 0,
  rooms: 3,
  bathrooms: 1,
  monthly_price: 0,
  rental_period: '',
  description: '',
  has_mamad: false,
  has_accessibility: false,
  allows_pets: false,
  has_ac: false,
  has_elevator: false,
  is_furnished: false,
  has_building_shelter: false,
}

const initialValues: WizardValues = {
  property_type: 'apartment',
  property_type_other: '',
  city: '',
  street: '',
  house_number: '',
  neighborhood: '',
  total_floors: 1,
  parking_spots: 0,
  publisher_name: '',
  phone_number: '',
  general_description: '',
  units: [unitDefaults],
}

const stepLabels = ['מיקום וסוג הנכס', 'מבנה ויחידות דיור', 'פרסום ואימות']

function toErrorText(err: unknown): string {
  const detail =
    typeof err === 'object' && err !== null && 'response' in err
      ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : null
  if (typeof detail === 'string' && detail.trim()) return detail
  if (err instanceof Error && err.message.trim()) return err.message
  return 'שמירת המודעה נכשלה. נסו שוב.'
}

export default function PropertyListingWizard() {
  const navigate = useNavigate()
  const [stepIdx, setStepIdx] = useState(0)
  const [successState, setSuccessState] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await createPropertyListing(payload)
      return data
    },
  })

  const { control, register, watch, setValue, trigger, handleSubmit, formState, reset } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'units' })

  const propertyType = watch('property_type')
  const errors = formState.errors
  const submitting = createMutation.isPending

  const stepProgress = useMemo(() => ((stepIdx + 1) / stepLabels.length) * 100, [stepIdx])

  const validateCurrentStep = async () => {
    if (stepIdx === 0) {
      return trigger(['property_type', 'property_type_other', 'city', 'street', 'house_number'])
    }
    if (stepIdx === 1) {
      return trigger(['total_floors', 'parking_spots', 'units'])
    }
    return trigger(['publisher_name', 'phone_number'])
  }

  const onSubmit = async (values: WizardValues) => {
    setSubmitError(null)

    const payload = {
      property_type: values.property_type,
      property_type_other:
        values.property_type === 'other' ? values.property_type_other?.trim() || null : null,
      city: values.city.trim(),
      street: values.street.trim(),
      house_number: values.house_number.trim(),
      neighborhood: values.neighborhood?.trim() || null,
      total_floors: values.total_floors ?? null,
      parking_spots: values.parking_spots ?? 0,
      publisher_name: values.publisher_name.trim(),
      phone_number: values.phone_number.trim(),
      units: values.units.map((unit, idx) => ({
        floor: unit.floor ?? null,
        rooms: Number(unit.rooms),
        bathrooms: unit.bathrooms ?? 1,
        monthly_price:
          unit.monthly_price === undefined || unit.monthly_price === null
            ? null
            : Number(unit.monthly_price),
        rental_period: unit.rental_period?.trim() || null,
        description: unit.description?.trim() || values.general_description?.trim() || null,
        has_mamad: unit.has_mamad,
        has_accessibility: unit.has_accessibility,
        allows_pets: unit.allows_pets,
        has_ac: unit.has_ac,
        has_elevator: unit.has_elevator,
        is_furnished: unit.is_furnished,
        has_building_shelter: unit.has_building_shelter,
        ...(idx > 0 ? {} : {}),
      })),
    }

    try {
      await createMutation.mutateAsync(payload)
      setSuccessState(true)
    } catch (err) {
      setSubmitError(toErrorText(err))
    }
  }

  if (successState) {
    return (
      <div className="dashboard-app min-h-screen" dir="rtl">
        <header className="dashboard-app__gradient px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="h-9 border border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              <Link to="/family" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                חזרה ללוח המשפחות
              </Link>
            </Button>
            <UserBar />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          <Card className="border-emerald-500/30 bg-card shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h2 className="text-xl font-bold text-foreground">המודעה פורסמה בהצלחה</h2>
              <p className="max-w-xl text-sm text-muted-foreground">
                המודעה נשמרה במערכת וניתן כעת לחזור ללוח המשפחות או ליצור מודעה נוספת.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate('/family')}>חזרה ללוח המשפחות</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    reset(initialValues)
                    setSuccessState(false)
                    setStepIdx(0)
                  }}
                >
                  יצירת מודעה נוספת
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-app min-h-screen" dir="rtl">
      <header className="dashboard-app__gradient px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-9 border border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link to="/family" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              חזרה ללוח המשפחות
            </Link>
          </Button>
          <UserBar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl p-4 pb-10 sm:p-6">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-5 w-5 text-primary" />
                  הוספת דירה
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  אשף יצירת מודעה ב-3 שלבים עבור שיכון מפונים.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                שלב {stepIdx + 1} מתוך {stepLabels.length}
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {stepLabels.map((label, idx) => (
                  <div
                    key={label}
                    className={idx <= stepIdx ? 'font-semibold text-foreground' : 'text-muted-foreground'}
                  >
                    {idx + 1}. {label}
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
            }}
            noValidate
          >
            <CardContent className="space-y-5">
              {submitError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              {stepIdx === 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="property_type">סוג הנכס</Label>
                    <select
                      id="property_type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...register('property_type')}
                    >
                      {propertyTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {errors.property_type ? (
                      <p className="text-xs text-destructive">{errors.property_type.message}</p>
                    ) : null}
                  </div>

                  {propertyType === 'other' && (
                    <div className="space-y-2">
                      <Label htmlFor="property_type_other">סוג נכס אחר</Label>
                      <Input
                        id="property_type_other"
                        placeholder="לדוגמה: יחידת אירוח"
                        {...register('property_type_other')}
                      />
                      {errors.property_type_other ? (
                        <p className="text-xs text-destructive">{errors.property_type_other.message}</p>
                      ) : null}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="city">יישוב</Label>
                    <Input id="city" placeholder="אילת" {...register('city')} />
                    {errors.city ? <p className="text-xs text-destructive">{errors.city.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="street">רחוב</Label>
                    <Input id="street" placeholder="תרשיש" {...register('street')} />
                    {errors.street ? (
                      <p className="text-xs text-destructive">{errors.street.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="house_number">מספר בית</Label>
                    <Input id="house_number" placeholder="7" {...register('house_number')} />
                    {errors.house_number ? (
                      <p className="text-xs text-destructive">{errors.house_number.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">שכונה</Label>
                    <Input id="neighborhood" placeholder="מרכז העיר" {...register('neighborhood')} />
                  </div>
                </div>
              )}

              {stepIdx === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="total_floors">סה"כ קומות בבניין</Label>
                      <Input id="total_floors" type="number" min={1} {...register('total_floors')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parking_spots">מספר חניות</Label>
                      <Input id="parking_spots" type="number" min={0} {...register('parking_spots')} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">יחידות דיור</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ ...unitDefaults })}
                      >
                        <PlusCircle className="ms-1 h-4 w-4" />
                        הוספת יחידה
                      </Button>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.id} className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">יחידה {index + 1}</h4>
                          {fields.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="ms-1 h-4 w-4" />
                              הסרה
                            </Button>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>קומה</Label>
                            <Input type="number" {...register(`units.${index}.floor`)} />
                          </div>
                          <div className="space-y-2">
                            <Label>מספר חדרים</Label>
                            <Input type="number" step="0.5" min={0.5} {...register(`units.${index}.rooms`)} />
                          </div>
                          <div className="space-y-2">
                            <Label>מחיר חודשי</Label>
                            <Input type="number" min={0} {...register(`units.${index}.monthly_price`)} />
                          </div>
                          <div className="space-y-2">
                            <Label>משך שכירות</Label>
                            <Input
                              placeholder="לדוגמה: גמיש לטווח ארוך"
                              {...register(`units.${index}.rental_period`)}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            { key: 'has_mamad', label: 'יש ממ"ד' },
                            { key: 'has_accessibility', label: 'נגישות' },
                            { key: 'allows_pets', label: 'מאפשר חיות מחמד' },
                            { key: 'has_ac', label: 'מזגן' },
                            { key: 'has_elevator', label: 'מעלית' },
                            { key: 'is_furnished', label: 'מרוהט' },
                            { key: 'has_building_shelter', label: 'מקלט בבניין' },
                          ].map((feature) => (
                            <label
                              key={feature.key}
                              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={Boolean(watch(`units.${index}.${feature.key as keyof WizardValues['units'][number]}`))}
                                onChange={(e) =>
                                  setValue(
                                    `units.${index}.${feature.key as keyof WizardValues['units'][number]}`,
                                    e.target.checked as never,
                                    { shouldDirty: true, shouldTouch: true },
                                  )
                                }
                              />
                              {feature.label}
                            </label>
                          ))}
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label>תיאור יחידה</Label>
                          <Textarea
                            rows={3}
                            placeholder="מידע נוסף על היחידה"
                            {...register(`units.${index}.description`)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stepIdx === 2 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="publisher_name">שם המפרסם</Label>
                    <Input id="publisher_name" placeholder="שם מלא" {...register('publisher_name')} />
                    {errors.publisher_name ? (
                      <p className="text-xs text-destructive">{errors.publisher_name.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">טלפון</Label>
                    <Input id="phone_number" placeholder="052-0000000" {...register('phone_number')} />
                    {errors.phone_number ? (
                      <p className="text-xs text-destructive">{errors.phone_number.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="general_description">פירוט חופשי</Label>
                    <Textarea
                      id="general_description"
                      rows={4}
                      placeholder="פרטים חשובים נוספים לפרסום המודעה"
                      {...register('general_description')}
                    />
                    <p className="text-xs text-muted-foreground">
                      אם לא ימולא תיאור יחידה, טקסט זה ישמש כברירת מחדל לכל היחידות.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" disabled={stepIdx === 0 || submitting} onClick={() => setStepIdx((s) => Math.max(s - 1, 0))}>
                חזור
              </Button>

              {stepIdx < stepLabels.length - 1 ? (
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    const valid = await validateCurrentStep()
                    if (valid) setStepIdx((s) => Math.min(s + 1, stepLabels.length - 1))
                  }}
                >
                  המשך לשלב הבא
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={submitting}
                  onClick={() => void handleSubmit(onSubmit)()}
                >
                  {submitting ? 'מפרסם מודעה...' : 'פרסם מודעה'}
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  )
}
