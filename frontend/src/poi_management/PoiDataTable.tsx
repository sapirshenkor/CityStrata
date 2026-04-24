import { useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  getDisplayAddress,
  getDisplayName,
  getDisplayRating,
  getDisplayType,
  getEntityId,
} from './poiAdapters'
import type { PoiCategory, PoiEntityRow } from './types'

export interface PoiDataTableProps {
  category: PoiCategory
  data: PoiEntityRow[]
  isLoading?: boolean
  onEdit: (row: PoiEntityRow) => void
  onDelete: (row: PoiEntityRow) => void
  deletingId?: string | null
  className?: string
}

function showRatingColumn(category: PoiCategory): boolean {
  return (
    category === 'airbnb_listings' ||
    category === 'coffee_shops' ||
    category === 'restaurants' ||
    category === 'hotel_listings'
  )
}

function showTypeColumn(category: PoiCategory): boolean {
  return category !== 'airbnb_listings'
}

function buildColumns(
  category: PoiCategory,
  onEdit: (row: PoiEntityRow) => void,
  onDelete: (row: PoiEntityRow) => void,
  deletingId: string | null | undefined,
): ColumnDef<PoiEntityRow>[] {
  const cols: ColumnDef<PoiEntityRow>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="max-w-[14rem] font-medium text-foreground">
          {getDisplayName(row.original, category)}
        </div>
      ),
    },
  ]

  if (showTypeColumn(category)) {
    cols.push({
      id: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const t = getDisplayType(row.original, category)
        return <span className="text-muted-foreground">{t ?? '—'}</span>
      },
    })
  }

  if (showRatingColumn(category)) {
    cols.push({
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => {
        const v = getDisplayRating(row.original, category)
        if (v == null) return <span className="text-muted-foreground">—</span>
        return (
          <span className="inline-flex items-center gap-1 tabular-nums text-foreground">
            <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            {v.toFixed(1)}
          </span>
        )
      },
    })
  }

  cols.push(
    {
      id: 'address',
      header: 'Address',
      cell: ({ row }) => {
        const addr = getDisplayAddress(row.original, category)
        if (!addr) return <span className="text-muted-foreground">—</span>
        return (
          <span className="inline-flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            <span className="line-clamp-2 max-w-[18rem]">{addr}</span>
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original
        const id = getEntityId(r, category)
        const busy = deletingId === id
        const label = getDisplayName(r, category)
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(r)}
              aria-label={`Edit ${label}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className={cn(
                'h-8 w-8 border border-destructive/40 bg-destructive/10 text-destructive shadow-none',
                'hover:bg-destructive/20 hover:text-destructive',
                'focus-visible:ring-destructive/40 disabled:opacity-50',
              )}
              onClick={() => onDelete(r)}
              disabled={busy}
              aria-label={`Delete ${label}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  )

  return cols
}

export function PoiDataTable({
  category,
  data,
  isLoading,
  onEdit,
  onDelete,
  deletingId,
  className,
}: PoiDataTableProps) {
  const columns = useMemo(
    () => buildColumns(category, onEdit, onDelete, deletingId),
    [category, onEdit, onDelete, deletingId],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead key={header.id} className={header.id === 'actions' ? 'w-[88px]' : ''}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={getEntityId(row.original, category)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No records for this category yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
