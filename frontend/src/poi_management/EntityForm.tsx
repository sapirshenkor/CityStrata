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
            <Label htmlFor="poi-edu-code">Institution code</Label>
            <Input
              id="poi-edu-code"
              placeholder="Unique code (institution_code)"
              autoComplete="off"
              disabled={mode === 'edit'}
              {...form.register('institutionCode')}
            />
            {mode === 'edit' ? (
              <p className="text-xs text-muted-foreground">Code cannot be changed after creation.</p>
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
            <Label htmlFor="poi-edu-supervision">Type of supervision</Label>
            <Input
              id="poi-edu-supervision"
              placeholder="Optional (type_of_supervision)"
              {...form.register('typeOfSupervision')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-type-education">Type of education</Label>
            <Input
              id="poi-edu-type-education"
              placeholder="Optional (type_of_education)"
              {...form.register('typeOfEducation')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-edu-phase">Education phase</Label>
            <Input
              id="poi-edu-phase"
              placeholder="Optional (education_phase)"
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
            <Label htmlFor="poi-airbnb-url">URL</Label>
            <Input
              id="poi-airbnb-url"
              type="url"
              inputMode="url"
              placeholder="Listing URL (url)"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-description">Description</Label>
            <Textarea
              id="poi-airbnb-description"
              placeholder="Optional (description)"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-nights">Number of nights</Label>
            <Input
              id="poi-airbnb-nights"
              type="number"
              min={0}
              step={1}
              placeholder="Optional (num_nights)"
              {...form.register('numNights', { valueAsNumber: true })}
            />
            {form.formState.errors.numNights ? (
              <p className="text-xs text-destructive">{form.formState.errors.numNights.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-price">Price per night</Label>
            <Input
              id="poi-airbnb-price"
              type="number"
              min={0}
              step={0.01}
              placeholder="Optional (price_per_night)"
              {...form.register('pricePerNight', { valueAsNumber: true })}
            />
            {form.formState.errors.pricePerNight ? (
              <p className="text-xs text-destructive">{form.formState.errors.pricePerNight.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-rating">Rating (0–5)</Label>
            <Input
              id="poi-airbnb-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="Optional (rating_value)"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-airbnb-capacity">Person capacity</Label>
            <Input
              id="poi-airbnb-capacity"
              type="number"
              min={0}
              step={1}
              placeholder="Optional (person_capacity)"
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
            <Label htmlFor="poi-coffee-description">Description</Label>
            <Textarea
              id="poi-coffee-description"
              placeholder="Optional (description)"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-category">Category</Label>
            <Input
              id="poi-coffee-category"
              placeholder="e.g. Café, Ice cream (category_name)"
              {...form.register('type')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-rating">Rating (0–5)</Label>
            <Input
              id="poi-coffee-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="Optional (total_score)"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">Venue score (total_score).</p>
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-url">URL</Label>
            <Input
              id="poi-coffee-url"
              type="url"
              inputMode="url"
              placeholder="Optional (url)"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-coffee-website">Website</Label>
            <Input
              id="poi-coffee-website"
              type="url"
              inputMode="url"
              placeholder="Optional (website)"
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
            <Label htmlFor="poi-coffee-activity-times">Activity times (JSON)</Label>
            <Textarea
              id="poi-coffee-activity-times"
              placeholder='e.g. {"mon": "08:00–18:00"} or []'
              rows={4}
              className="font-mono text-xs"
              {...form.register('activityTimesJson')}
            />
            <p className="text-xs text-muted-foreground">
              Stored as JSONB (activity_times). Leave empty if none.
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
            <Label htmlFor="poi-restaurant-description">Description</Label>
            <Textarea
              id="poi-restaurant-description"
              placeholder="Optional (description)"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-category">Category</Label>
            <Input
              id="poi-restaurant-category"
              placeholder="e.g. Italian, Fast food (category_name)"
              {...form.register('type')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-rating">Rating (0–5)</Label>
            <Input
              id="poi-restaurant-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="Optional (total_score)"
              {...form.register('ratingValue', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">Venue score (total_score).</p>
            {form.formState.errors.ratingValue ? (
              <p className="text-xs text-destructive">{form.formState.errors.ratingValue.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-url">URL</Label>
            <Input
              id="poi-restaurant-url"
              type="url"
              inputMode="url"
              placeholder="Optional (url)"
              {...form.register('url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-restaurant-website">Website</Label>
            <Input
              id="poi-restaurant-website"
              type="url"
              inputMode="url"
              placeholder="Optional (website)"
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
            <Label htmlFor="poi-hotel-url">URL</Label>
            <Input
              id="poi-hotel-url"
              type="url"
              inputMode="url"
              placeholder="Optional (url)"
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
            <Label htmlFor="poi-hotel-description">Description</Label>
            <Textarea
              id="poi-hotel-description"
              placeholder="Optional (description)"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-type">Type</Label>
            <Input
              id="poi-hotel-type"
              placeholder="e.g. Resort, Boutique (type)"
              {...form.register('type')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-hotel-rating">Rating (0–5)</Label>
            <Input
              id="poi-hotel-rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              placeholder="Optional (rating_value)"
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
            <Label htmlFor="poi-matnas-person">Person in charge</Label>
            <Input
              id="poi-matnas-person"
              placeholder="Optional (person_in_charge)"
              {...form.register('personInCharge')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-phone">Phone number</Label>
            <Input
              id="poi-matnas-phone"
              type="tel"
              autoComplete="tel"
              placeholder="Optional (phone_number)"
              {...form.register('phoneNumber')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-activity-days">Activity days</Label>
            <Input
              id="poi-matnas-activity-days"
              placeholder="Optional (activity_days)"
              {...form.register('activityDays')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-facility-area">Facility area (m²)</Label>
            <Input
              id="poi-matnas-facility-area"
              type="number"
              min={0}
              step={1}
              placeholder="Optional (facility_area)"
              {...form.register('facilityArea', { valueAsNumber: true })}
            />
            {form.formState.errors.facilityArea ? (
              <p className="text-xs text-destructive">{form.formState.errors.facilityArea.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-occupancy">Occupancy</Label>
            <Input
              id="poi-matnas-occupancy"
              type="number"
              min={0}
              step={1}
              placeholder="Optional (occupancy)"
              {...form.register('occupancy', { valueAsNumber: true })}
            />
            {form.formState.errors.occupancy ? (
              <p className="text-xs text-destructive">{form.formState.errors.occupancy.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-rooms">Number of activity rooms</Label>
            <Input
              id="poi-matnas-rooms"
              placeholder="Optional (number_of_activity_rooms)"
              {...form.register('numberOfActivityRooms')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-matnas-shelter">Shelter and where</Label>
            <Input
              id="poi-matnas-shelter"
              placeholder="Optional (shelter_and_where)"
              {...form.register('shelterAndWhere')}
            />
          </div>
        </>
      ) : category === 'synagogues' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="poi-syn-name">Name (English)</Label>
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
            <Label htmlFor="poi-syn-name-he">Name (Hebrew)</Label>
            <Input
              id="poi-syn-name-he"
              placeholder="Hebrew name (name_he)"
              dir="rtl"
              {...form.register('nameHe')}
            />
            <p className="text-xs text-muted-foreground">At least one of English or Hebrew name is required.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-syn-type">Type (English)</Label>
            <Input
              id="poi-syn-type"
              placeholder="e.g. Ashkenazi, Sephardi (type)"
              {...form.register('type')}
            />
            {form.formState.errors.type ? (
              <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poi-syn-type-he">Type (Hebrew)</Label>
            <Input
              id="poi-syn-type-he"
              placeholder="Hebrew type (type_he)"
              dir="rtl"
              {...form.register('typeHe')}
            />
            <p className="text-xs text-muted-foreground">At least one of English or Hebrew type is required.</p>
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
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
