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
import { ApiErrorBanner } from '@/components/layout/ApiErrorBanner'
import UserBar from '@/components/UserBar'
import { PageHeader, PageShell } from '@/components/layout/PageShell'
import { formatQueryError } from '@/lib/formatQueryError'
import { HotelForm } from './HotelForm'
import { HotelsTable } from './HotelsTable'
import { formValuesToCreatePayload } from './hotelFormSchema'
import { createHotel, deleteHotel, fetchHotels, updateHotel } from './hotelsApi'
import { hotelManagementKeys } from './queryKeys'
import type { HotelCreateInput, HotelRow, HotelUpdateInput } from './types'

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
    onError: (e) => setBannerError(formatQueryError(e)),
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
    onError: (e) => setBannerError(formatQueryError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: deleteHotel,
    onSuccess: async () => {
      setBannerError(null)
      await invalidateList()
    },
    onError: (e) => setBannerError(formatQueryError(e)),
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
    const ok = window.confirm(`למחוק את “${row.name}”? לא ניתן לבטל פעולה זו.`)
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
        title="ניהול מלונות"
        description="הוספה ותחזוקה של מלונות עבור הרשות המקומית. כתובות עוברות גיאוקוד באופן אוטומטי."
        leading={
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" strokeWidth={1.75} />
          </div>
        }
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <UserBar variant="onSurface" />
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link to="/municipality" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                לוח בקרה
              </Link>
            </Button>
            <Button size="sm" className="rounded-lg gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              הוספת מלון
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {bannerError ? <ApiErrorBanner message={bannerError} className="mb-6" /> : null}

        {listQuery.isError ? (
          <ApiErrorBanner
            message={formatQueryError(listQuery.error)}
            onRetry={() => void listQuery.refetch()}
            className="mb-6"
          />
        ) : (
          <Card className="rounded-2xl border-border/80 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">מלונות</CardTitle>
              <CardDescription>
                מציג רשומות בתחום הרשות המקומית שלך, לפי סינון סמל יישוב בצד השרת.
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
            <DialogTitle>{editing ? 'עריכת מלון' : 'הוספת מלון'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'עדכנו פרטים. שינוי הכתובת המלאה יבצע גיאוקוד מחדש למיקום.'
                : 'הזינו שם וכתובת. המערכת תבצע גיאוקוד לכתובת ותשמור קואורדינטות.'}
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
