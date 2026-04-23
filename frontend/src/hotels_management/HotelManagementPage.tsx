import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, PageShell } from '@/components/layout/PageShell'
import { HotelForm } from './HotelForm'
import { HotelsTable } from './HotelsTable'
import { formValuesToCreatePayload } from './hotelFormSchema'
import { createHotel, deleteHotel, fetchHotels, updateHotel } from './hotelsApi'
import { hotelManagementKeys } from './queryKeys'
import type { HotelCreateInput, HotelRow, HotelUpdateInput } from './types'

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = err as { response?: { data?: { detail?: unknown } } }
    const d = r.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x) => JSON.stringify(x)).join(', ')
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}

export default function HotelManagementPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HotelRow | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: hotelManagementKeys.list(),
    queryFn: fetchHotels,
  })

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: hotelManagementKeys.list() })
  }, [queryClient])

  const createMut = useMutation({
    mutationFn: createHotel,
    onSuccess: async () => {
      setBannerError(null)
      setDialogOpen(false)
      setEditing(null)
      await invalidateList()
    },
    onError: (e) => setBannerError(apiErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ uuid, body }: { uuid: string; body: HotelUpdateInput }) =>
      updateHotel(uuid, body),
    onSuccess: async () => {
      setBannerError(null)
      setDialogOpen(false)
      setEditing(null)
      await invalidateList()
    },
    onError: (e) => setBannerError(apiErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: deleteHotel,
    onSuccess: async () => {
      setBannerError(null)
      await invalidateList()
    },
    onError: (e) => setBannerError(apiErrorMessage(e)),
  })

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (row: HotelRow) => {
    setEditing(row)
    setDialogOpen(true)
  }

  const handleDelete = (row: HotelRow) => {
    const ok = window.confirm(`Delete “${row.name}”? This cannot be undone.`)
    if (!ok) return
    deleteMut.mutate(row.uuid)
  }

  const handleFormSubmit = async (payload: ReturnType<typeof formValuesToCreatePayload>) => {
    setBannerError(null)
    if (editing) {
      const body: HotelUpdateInput = { ...payload }
      await updateMut.mutateAsync({ uuid: editing.uuid, body })
    } else {
      await createMut.mutateAsync(payload as HotelCreateInput)
    }
  }

  const submitting = createMut.isPending || updateMut.isPending

  return (
    <PageShell>
      <PageHeader
        title="Hotel management"
        description="Add and maintain hotels for your municipality. Addresses are geocoded automatically."
        leading={
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" strokeWidth={1.75} />
          </div>
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link to="/municipality" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button size="sm" className="rounded-lg gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add hotel
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {bannerError ? (
          <div
            className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {bannerError}
          </div>
        ) : null}

        {listQuery.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {apiErrorMessage(listQuery.error)}
          </div>
        ) : (
          <Card className="rounded-2xl border-border/80 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Hotels</CardTitle>
              <CardDescription>
                Showing listings for your municipality scope (filtered server-side by semel yish).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HotelsTable
                data={listQuery.data ?? []}
                isLoading={listQuery.isLoading}
                onEdit={openEdit}
                onDelete={handleDelete}
                deletingUuid={deleteMut.isPending ? deleteMut.variables : null}
              />
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit hotel' : 'Add hotel'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update details. Changing the full address will re-geocode the location.'
                : 'Enter a name and address. We will geocode the address and save coordinates.'}
            </DialogDescription>
          </DialogHeader>
          <HotelForm
            mode={editing ? 'edit' : 'create'}
            initial={editing}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setDialogOpen(false)
              setEditing(null)
            }}
            isSubmitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
