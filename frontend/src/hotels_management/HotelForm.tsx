import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { HotelRow } from './types'
import {
  type HotelFormValues,
  formValuesToCreatePayload,
  hotelFormSchema,
} from './hotelFormSchema'

export interface HotelFormProps {
  mode: 'create' | 'edit'
  /** When editing, used to populate defaults */
  initial?: HotelRow | null
  onSubmit: (payload: ReturnType<typeof formValuesToCreatePayload>) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  className?: string
}

function rowToDefaults(row: HotelRow): HotelFormValues {
  return {
    name: row.name,
    location_fulladdress: row.location_fulladdress ?? '',
    type: row.type ?? '',
    description: row.description ?? '',
    url: row.url ?? '',
    rating: row.rating_value != null ? String(row.rating_value) : '',
  }
}

export function HotelForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
}: HotelFormProps) {
  const form = useForm<HotelFormValues>({
    resolver: zodResolver(hotelFormSchema),
    defaultValues: {
      name: '',
      location_fulladdress: '',
      type: '',
      description: '',
      url: '',
      rating: '',
    },
  })

  useEffect(() => {
    if (mode === 'edit' && initial) {
      form.reset(rowToDefaults(initial))
      return
    }
    form.reset({
      name: '',
      location_fulladdress: '',
      type: '',
      description: '',
      url: '',
      rating: '',
    })
  }, [mode, initial, form])

  const handleValid = async (values: HotelFormValues) => {
    await onSubmit(formValuesToCreatePayload(values))
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleValid)}
      className={cn('space-y-4', className)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="hotel-name">Name</Label>
        <Input
          id="hotel-name"
          placeholder="Hotel name"
          autoComplete="organization"
          {...form.register('name')}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="hotel-address">Address</Label>
        <Input
          id="hotel-address"
          placeholder="Full street address"
          autoComplete="street-address"
          {...form.register('location_fulladdress')}
        />
        {form.formState.errors.location_fulladdress ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.location_fulladdress.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hotel-type">Type</Label>
          <Input id="hotel-type" placeholder="e.g. Hotel, Resort" {...form.register('type')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hotel-rating">Rating (0–5)</Label>
          <Input
            id="hotel-rating"
            type="number"
            step="0.1"
            min={0}
            max={5}
            placeholder="—"
            {...form.register('rating')}
          />
          {form.formState.errors.rating ? (
            <p className="text-xs text-destructive">{form.formState.errors.rating.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hotel-url">Website URL</Label>
        <Input id="hotel-url" type="url" placeholder="https://…" {...form.register('url')} />
        {form.formState.errors.url ? (
          <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="hotel-desc">Description</Label>
        <Textarea
          id="hotel-desc"
          placeholder="Optional short description"
          rows={3}
          className="resize-none"
          {...form.register('description')}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'create' ? 'Add hotel' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
