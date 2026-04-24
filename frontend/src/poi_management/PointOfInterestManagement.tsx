import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiErrorBanner } from '@/components/layout/ApiErrorBanner'
import { PageHeader, PageShell } from '@/components/layout/PageShell'
import { formatQueryError } from '@/lib/formatQueryError'
import { cn } from '@/lib/utils'
import { EntityForm } from './EntityForm'
import { getPoiFormFieldConfig } from './poiFormConfig'
import { POI_CATEGORY_ICONS, POI_CATEGORY_META, DEFAULT_POI_CATEGORY } from './poiCategories'
import { getEntityId } from './poiAdapters'
import { createPoi, deletePoi, fetchPoiList, updatePoi } from './poiApi'
import { poiQueryKeys } from './queryKeys'
import type { PoiCategory, PoiEntityRow } from './types'
import { POI_CATEGORIES, isPoiCategory } from './types'
import { PoiDataTable } from './PoiDataTable'

export default function PointOfInterestManagement() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<PoiCategory>(DEFAULT_POI_CATEGORY)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PoiEntityRow | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [bannerError, setBannerError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const listQuery = useQuery({
    queryKey: poiQueryKeys.list(category, page, debouncedSearch),
    queryFn: () => fetchPoiList(category, page, undefined, debouncedSearch),
    // Keep previous rows only while refetching the same category + search (pagination).
    placeholderData: (previousData, previousQuery) => {
      if (!previousQuery) return undefined
      const prevCategory = previousQuery.queryKey[1]
      const prevSearch = previousQuery.queryKey[3]
      if (prevCategory !== category || prevSearch !== debouncedSearch) return undefined
      return keepPreviousData(previousData)
    },
  })

  useEffect(() => {
    setPage(1)
    setSearchInput('')
    setDebouncedSearch('')
  }, [category])

  useEffect(() => {
    const serverPage = listQuery.data?.page
    if (serverPage != null && serverPage !== page) {
      setPage(serverPage)
    }
  }, [listQuery.data?.page, page])

  const listPage = listQuery.data
  const totalPages = listPage?.total_pages ?? 0
  const totalRecords = listPage?.total ?? 0

  const invalidateCategory = useCallback(
    async (c: PoiCategory) => {
      await queryClient.invalidateQueries({ queryKey: [...poiQueryKeys.all, c] })
    },
    [queryClient],
  )

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createPoi(category, payload),
    onSuccess: async () => {
      setBannerError(null)
      setDialogOpen(false)
      await invalidateCategory(category)
    },
    onError: (e) => setBannerError(formatQueryError(e)),
  })

  const updateMut = useMutation({
    mutationFn: (args: { id: string; body: Record<string, unknown> }) =>
      updatePoi(category, args.id, args.body),
    onSuccess: async () => {
      setBannerError(null)
      setDialogOpen(false)
      setEditing(null)
      await invalidateCategory(category)
    },
    onError: (e) => setBannerError(formatQueryError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePoi(category, id),
    onSuccess: async () => {
      setBannerError(null)
      await invalidateCategory(category)
    },
    onError: (e) => setBannerError(formatQueryError(e)),
  })

  const openCreate = () => {
    setEditing(null)
    setFormMode('create')
    setDialogOpen(true)
  }

  const handleFormSubmit = async (payload: Record<string, unknown>) => {
    setBannerError(null)
    if (formMode === 'edit' && editing) {
      await updateMut.mutateAsync({
        id: getEntityId(editing, category),
        body: payload,
      })
    } else {
      await createMut.mutateAsync(payload)
    }
  }

  const onTabChange = (value: string) => {
    if (!isPoiCategory(value)) return
    setCategory(value)
    setBannerError(null)
    setEditing(null)
    setDialogOpen(false)
  }

  const submitting = createMut.isPending || updateMut.isPending

  const openEditCb = useCallback((row: PoiEntityRow) => {
    setEditing(row)
    setFormMode('edit')
    setDialogOpen(true)
  }, [])

  const handleDeleteCb = useCallback(
    (row: PoiEntityRow) => {
      const name = String(
        row['title'] || row['name'] || row['matnas_name'] || row['institution_name'] || 'this row',
      )
      const ok = window.confirm(`Delete “${name}”? This cannot be undone.`)
      if (!ok) return
      deleteMut.mutate(getEntityId(row, category))
    },
    [category, deleteMut.mutate],
  )

  const formDialogKey = useMemo(() => {
    if (formMode === 'edit' && editing) {
      return `${category}-edit-${getEntityId(editing, category)}`
    }
    return `${category}-create`
  }, [category, formMode, editing])

  const formFieldConfig = useMemo(() => getPoiFormFieldConfig(category), [category])

  return (
    <PageShell>
      <PageHeader
        title="Point of interest management"
        description="Manage listings and venues by category. Data is scoped to your municipality on the server."
        containerClassName="max-w-6xl"
        leading={
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" strokeWidth={1.75} />
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
              Add record
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {bannerError ? <ApiErrorBanner message={bannerError} className="mb-6" /> : null}

        <Tabs value={category} onValueChange={onTabChange} className="w-full">
          <TabsList
            className={cn(
              'mb-6 flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/50 p-1.5',
            )}
          >
            {POI_CATEGORIES.map((key) => {
              const Icon = POI_CATEGORY_ICONS[key]
              const meta = POI_CATEGORY_META[key]
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="hidden sm:inline">{meta.label}</span>
                  <span className="sm:hidden">{meta.shortLabel}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

        </Tabs>

        <Card className="rounded-2xl border-border/80 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {POI_CATEGORY_META[category].label}
            </CardTitle>
            <CardDescription>{POI_CATEGORY_META[category].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search this category…"
                className="rounded-lg ps-9"
                autoComplete="off"
                aria-label="Search listings"
              />
            </div>
            {listQuery.isError ? (
              <ApiErrorBanner
                message={formatQueryError(listQuery.error)}
                onRetry={() => void listQuery.refetch()}
              />
            ) : (
              <>
                <PoiDataTable
                  category={category}
                  data={listPage?.items ?? []}
                  isLoading={listQuery.isLoading}
                  onEdit={openEditCb}
                  onDelete={handleDeleteCb}
                  deletingId={deleteMut.isPending ? deleteMut.variables ?? null : null}
                />
                {!listQuery.isLoading && totalRecords > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {totalRecords} record{totalRecords === 1 ? '' : 's'} · page {listPage?.page ?? page} of{' '}
                      {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={page <= 1 || listQuery.isFetching}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={page >= totalPages || listQuery.isFetching}
                        onClick={() => setPage((p) => p + 1)}
                        aria-label="Next page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
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
            <DialogTitle>
              {formMode === 'create'
                ? `Add ${formFieldConfig.addRecordTitle}`
                : `Edit ${formFieldConfig.addRecordTitle}`}
            </DialogTitle>
            <DialogDescription>{formFieldConfig.dialogDescription}</DialogDescription>
          </DialogHeader>
          <EntityForm
            key={formDialogKey}
            category={category}
            mode={formMode}
            initialRow={editing}
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
