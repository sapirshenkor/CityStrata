import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { buildCreatePayload, rowToFormValues } from './poiAdapters'
import { getPoiFormFieldConfig } from './poiFormConfig'
import { getPoiFormSchema } from './poiFormSchema'
import type { PoiCategory, PoiCommonFormValues, PoiEntityRow } from './types'

export interface EntityFormProps {
  category: PoiCategory
  mode: 'create' | 'edit'
  initialRow: PoiEntityRow | null
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  className?: string
}

const emptyDefaults: PoiCommonFormValues = {
  name: '',
  address: '',
  type: '',
}

export function EntityForm({
  category,
  mode,
  initialRow,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
}: EntityFormProps) {
  const fieldConfig = useMemo(() => getPoiFormFieldConfig(category), [category])
  const schema = useMemo(() => getPoiFormSchema(category), [category])
  const resolver = useMemo(() => zodResolver(schema), [schema])

  const form = useForm<PoiCommonFormValues>({
    resolver,
    defaultValues: emptyDefaults,
  })

  useEffect(() => {
    if (mode === 'edit' && initialRow) {
      form.reset(rowToFormValues(initialRow, category))
      return
    }
    const base: PoiCommonFormValues = {
      ...emptyDefaults,
      ...(category === 'educational_institutions'
        ? {
            institutionCode: '',
            typeOfSupervision: '',
            typeOfEducation: '',
            educationPhase: '',
          }
        : {}),
      ...(category === 'hotel_listings'
        ? { description: '', url: '', ratingValue: undefined }
        : {}),
      ...(category === 'airbnb_listings'
        ? {
            description: '',
            url: '',
            numNights: undefined,
            pricePerNight: undefined,
            personCapacity: undefined,
            ratingValue: undefined,
          }
        : {}),
      ...(category === 'coffee_shops'
        ? {
            description: '',
            url: '',
            website: '',
            activityTimesJson: '',
            ratingValue: undefined,
          }
        : {}),
      ...(category === 'restaurants'
        ? {
            description: '',
            url: '',
            website: '',
            ratingValue: undefined,
          }
        : {}),
      ...(category === 'matnasim'
        ? {
            personInCharge: '',
            phoneNumber: '',
            activityDays: '',
            facilityArea: undefined,
            occupancy: undefined,
            numberOfActivityRooms: '',
            shelterAndWhere: '',
          }
        : {}),
      ...(category === 'synagogues'
        ? {
            nameHe: '',
            typeHe: '',
          }
        : {}),
    }
    form.reset(base)
  }, [mode, initialRow, category, form])

  const handleValid = async (values: PoiCommonFormValues) => {
    const payload = buildCreatePayload(category, values)
    await onSubmit(payload)
  }

  const typeField = fieldConfig.typeField

  return (
    <form
      onSubmit={form.handleSubmit(handleValid)}
      className={cn('space-y-4', className)}
      noValidate
    >
      {category === 'educational_institutions' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-edu-code">קוד מוסד</Label>
            <Input
              id="poi-edu-code"
              placeholder="קוד ייחודי"
              autoComplete="off"
              disabled={mode === 'edit'}
              {...form.register('institutionCode')}
            />
            {mode === 'edit' ? (
              <p className="text-xs text-muted-foreground">לא ניתן לשנות את הקוד לאחר יצירה.</p>
            ) : null}
            {form.formState.errors.institutionCode ? (
              <p className="text-xs text-destructive">{form.formState.errors.institutionCode.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-name">{fieldConfig.nameLabel}</Label>
            <Input
              id="poi-edu-name"
              placeholder={fieldConfig.namePlaceholder}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-address">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-edu-address"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-supervision">סוג פיקוח</Label>
            <Input
              id="poi-edu-supervision"
              placeholder="אופציונלי"
              {...form.register('typeOfSupervision')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-type-education">סוג חינוך</Label>
            <Input
              id="poi-edu-type-education"
              placeholder="אופציונלי"
              {...form.register('typeOfEducation')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-phase">שלב חינוך</Label>
            <Input
              id="poi-edu-phase"
              placeholder="אופציונלי"
              {...form.register('educationPhase')}
            />
          </div>
        </>
      ) : category === 'airbnb_listings' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-title">{fieldConfig.nameLabel}</Label>
            <Input
              id="poi-airbnb-title"
              placeholder={fieldConfig.namePlaceholder}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-url">כתובת URL</Label>
            <Input
              id="poi-airbnb-url"
              type="url"
              inputMode="url"
              placeholder="כתובת הנכס"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-description">תיאור</Label>
            <Textarea
              id="poi-airbnb-description"
              placeholder="אופציונלי"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-nights">מספר לילות</Label>
            <Input
              id="poi-airbnb-nights"
              type="number"
              min={0}
              step={1}
              placeholder="אופציונלי"
              {...form.register('numNights', { valueAsNumber: true })}
            />
            {form.formState.errors.numNights ? (
              <p className="text-xs text-destructive">{form.formState.errors.numNights.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-price">מחיר ללילה</Label>
            <Input
              id="poi-airbnb-price"
              type="number"
              min={0}
              step={0.01}
              placeholder="אופציונלי"
              {...form.register('pricePerNight', { valueAsNumber: true })}
            />
            {form.formState.errors.pricePerNight ? (
              <p className="text-xs text-destructive">{form.formState.errors.pricePerNight.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-rating">דירוג (0-5)</Label>
            <Input
              id="poi-airbnb-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="אופציונלי"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-capacity">קיבולת נפשות</Label>
            <Input
              id="poi-airbnb-capacity"
              type="number"
              min={0}
              step={1}
              placeholder="אופציונלי"
              {...form.register('personCapacity', { valueAsNumber: true })}
            />
            {form.formState.errors.personCapacity ? (
              <p className="text-xs text-destructive">{form.formState.errors.personCapacity.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-location">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-airbnb-location"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>
        </>
      ) : category === 'coffee_shops' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-coffee-title">{fieldConfig.nameLabel}</Label>
            <Input
              id="poi-coffee-title"
              placeholder={fieldConfig.namePlaceholder}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-description">תיאור</Label>
            <Textarea
              id="poi-coffee-description"
              placeholder="אופציונלי"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-category">קטגוריה</Label>
            <Input
              id="poi-coffee-category"
              placeholder="לדוגמה: קפה, גלידה"
              {...form.register('type')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-rating">דירוג (0-5)</Label>
            <Input
              id="poi-coffee-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="אופציונלי"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">ציון המקום.</p>
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-url">כתובת URL</Label>
            <Input
              id="poi-coffee-url"
              type="url"
              inputMode="url"
              placeholder="אופציונלי"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-website">אתר</Label>
            <Input
              id="poi-coffee-website"
              type="url"
              inputMode="url"
              placeholder="אופציונלי"
              {...form.register('website')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-street">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-coffee-street"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-activity-times">שעות פעילות (JSON)</Label>
            <Textarea
              id="poi-coffee-activity-times"
              placeholder='לדוגמה: {"sun": "08:00-18:00"} או []'
              rows={4}
              className="font-mono text-xs"
              {...form.register('activityTimesJson')}
            />
            <p className="text-xs text-muted-foreground">
              נשמר כ־JSONB. השאירו ריק אם אין מידע.
            </p>
            {form.formState.errors.activityTimesJson ? (
              <p className="text-xs text-destructive">{form.formState.errors.activityTimesJson.message}</p>
            ) : null}
          </div>
        </>
      ) : category === 'restaurants' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-title">{fieldConfig.nameLabel}</Label>
            <Input
              id="poi-restaurant-title"
              placeholder={fieldConfig.namePlaceholder}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-description">תיאור</Label>
            <Textarea
              id="poi-restaurant-description"
              placeholder="אופציונלי"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-category">קטגוריה</Label>
            <Input
              id="poi-restaurant-category"
              placeholder="לדוגמה: איטלקי, מזון מהיר"
              {...form.register('type')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-rating">דירוג (0-5)</Label>
            <Input
              id="poi-restaurant-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="אופציונלי"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">ציון המקום.</p>
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-url">כתובת URL</Label>
            <Input
              id="poi-restaurant-url"
              type="url"
              inputMode="url"
              placeholder="אופציונלי"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-website">אתר</Label>
            <Input
              id="poi-restaurant-website"
              type="url"
              inputMode="url"
              placeholder="אופציונלי"
              {...form.register('website')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-street">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-restaurant-street"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>
        </>
      ) : category === 'hotel_listings' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-hotel-url">כתובת URL</Label>
            <Input
              id="poi-hotel-url"
              type="url"
              inputMode="url"
              placeholder="אופציונלי"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-name">{fieldConfig.nameLabel}</Label>
            <Input
              id="poi-hotel-name"
              placeholder={fieldConfig.namePlaceholder}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-description">תיאור</Label>
            <Textarea
              id="poi-hotel-description"
              placeholder="אופציונלי"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-type">סוג</Label>
            <Input
              id="poi-hotel-type"
              placeholder="לדוגמה: ריזורט, בוטיק"
              {...form.register('type')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-rating">דירוג (0-5)</Label>
            <Input
              id="poi-hotel-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="אופציונלי"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-address">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-hotel-address"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>
        </>
      ) : category === 'matnasim' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-matnas-name">{fieldConfig.nameLabel}</Label>
            <Input
              id="poi-matnas-name"
              placeholder={fieldConfig.namePlaceholder}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-address">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-matnas-address"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-person">איש קשר</Label>
            <Input
              id="poi-matnas-person"
              placeholder="אופציונלי"
              {...form.register('personInCharge')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-phone">מספר טלפון</Label>
            <Input
              id="poi-matnas-phone"
              type="tel"
              autoComplete="tel"
              placeholder="אופציונלי"
              {...form.register('phoneNumber')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-activity-days">ימי פעילות</Label>
            <Input
              id="poi-matnas-activity-days"
              placeholder="אופציונלי"
              {...form.register('activityDays')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-facility-area">שטח מתקן (מ"ר)</Label>
            <Input
              id="poi-matnas-facility-area"
              type="number"
              min={0}
              step={1}
              placeholder="אופציונלי"
              {...form.register('facilityArea', { valueAsNumber: true })}
            />
            {form.formState.errors.facilityArea ? (
              <p className="text-xs text-destructive">{form.formState.errors.facilityArea.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-occupancy">תפוסה</Label>
            <Input
              id="poi-matnas-occupancy"
              type="number"
              min={0}
              step={1}
              placeholder="אופציונלי"
              {...form.register('occupancy', { valueAsNumber: true })}
            />
            {form.formState.errors.occupancy ? (
              <p className="text-xs text-destructive">{form.formState.errors.occupancy.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-rooms">מספר חדרי פעילות</Label>
            <Input
              id="poi-matnas-rooms"
              placeholder="אופציונלי"
              {...form.register('numberOfActivityRooms')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-shelter">מרחב מוגן ומיקום</Label>
            <Input
              id="poi-matnas-shelter"
              placeholder="אופציונלי"
              {...form.register('shelterAndWhere')}
            />
          </div>
        </>
      ) : category === 'synagogues' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-syn-name">שם (אנגלית)</Label>
            <Input
              id="poi-syn-name"
              placeholder={fieldConfig.namePlaceholder}
              autoComplete="organization"
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-syn-name-he">שם (עברית)</Label>
            <Input
              id="poi-syn-name-he"
              placeholder="שם בעברית"
              dir="rtl"
              {...form.register('nameHe')}
            />
            <p className="text-xs text-muted-foreground">יש להזין לפחות שם אחד בעברית או באנגלית.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-syn-type">סוג (אנגלית)</Label>
            <Input
              id="poi-syn-type"
              placeholder="לדוגמה: אשכנזי, ספרדי"
              {...form.register('type')}
            />
            {form.formState.errors.type ? (
              <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-syn-type-he">סוג (עברית)</Label>
            <Input
              id="poi-syn-type-he"
              placeholder="סוג בעברית"
              dir="rtl"
              {...form.register('typeHe')}
            />
            <p className="text-xs text-muted-foreground">יש להזין לפחות סוג אחד בעברית או באנגלית.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-syn-address">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-syn-address"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-name">{fieldConfig.nameLabel}</Label>
            <Input id="poi-name" placeholder={fieldConfig.namePlaceholder} {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-address">{fieldConfig.addressLabel}</Label>
            <Input
              id="poi-address"
              placeholder={fieldConfig.addressPlaceholder}
              autoComplete="street-address"
              {...form.register('address')}
            />
            {fieldConfig.addressHint ? (
              <p className="text-xs text-muted-foreground">{fieldConfig.addressHint}</p>
            ) : null}
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
            ) : null}
          </div>

          {typeField ? (
            <div className="space-y-2">
              <Label htmlFor="poi-type">{typeField.label}</Label>
              <Input id="poi-type" placeholder={typeField.placeholder} {...form.register('type')} />
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          ביטול
        </Button>
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'create' ? 'יצירה' : 'שמירה'}
        </Button>
      </div>
    </form>
  )
}
