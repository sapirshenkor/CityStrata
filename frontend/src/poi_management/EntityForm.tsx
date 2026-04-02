import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { buildCreatePayload, rowToFormValues } from './poiAdapters'
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

function typeFieldLabel(category: PoiCategory): string {
  switch (category) {
    case 'coffee_shops':
    case 'restaurants':
      return 'Category'
    case 'hotel_listings':
      return 'Type'
    case 'educational_institutions':
      return 'Phase / education type'
    case 'synagogues':
      return 'Synagogue type'
    default:
      return 'Type (optional)'
  }
}

function showTypeField(category: PoiCategory): boolean {
  return (
    category === 'coffee_shops' ||
    category === 'restaurants' ||
    category === 'hotel_listings' ||
    category === 'educational_institutions' ||
    category === 'synagogues'
  )
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
    form.reset({
      ...emptyDefaults,
      institutionCode: category === 'educational_institutions' ? '' : undefined,
    })
  }, [mode, initialRow, category, form])

  const handleValid = async (values: PoiCommonFormValues) => {
    const payload = buildCreatePayload(category, values)
    await onSubmit(payload)
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleValid)}
      className={cn('space-y-4', className)}
      noValidate
    >
      {category === 'educational_institutions' ? (
        <div className="space-y-2">
          <Label htmlFor="poi-institution-code">Institution code</Label>
          <Input
            id="poi-institution-code"
            placeholder="Unique code (CBS / ministry id)"
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
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="poi-name">Name</Label>
        <Input id="poi-name" placeholder="Display name" {...form.register('name')} />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="poi-address">Address</Label>
        <Input
          id="poi-address"
          placeholder="Street address"
          autoComplete="street-address"
          {...form.register('address')}
        />
        {form.formState.errors.address ? (
          <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
        ) : null}
      </div>

      {showTypeField(category) ? (
        <div className="space-y-2">
          <Label htmlFor="poi-type">{typeFieldLabel(category)}</Label>
          <Input id="poi-type" placeholder="Optional" {...form.register('type')} />
        </div>
      ) : null}

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
