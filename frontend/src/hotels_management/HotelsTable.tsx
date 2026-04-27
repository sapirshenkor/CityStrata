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
import type { HotelRow } from './types'

export interface HotelsTableProps {
  data: HotelRow[]
  isLoading?: boolean
  onEdit: (row: HotelRow) => void
  onDelete: (row: HotelRow) => void
  deletingUuid?: string | null
  className?: string
}

function buildColumns(
  onEdit: (row: HotelRow) => void,
  onDelete: (row: HotelRow) => void,
  deletingUuid: string | null | undefined,
): ColumnDef<HotelRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'שם',
      cell: ({ row }) => (
        <div className="font-medium text-foreground">{row.original.name}</div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'סוג',
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string | null>() ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'rating_value',
      header: 'דירוג',
      cell: ({ getValue }) => {
        const v = getValue<number | null>()
        if (v == null) return <span className="text-muted-foreground">—</span>
        return (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            {v.toFixed(1)}
          </span>
        )
      },
    },
    {
      accessorKey: 'location_fulladdress',
      header: 'כתובת',
      cell: ({ getValue }) => {
        const addr = getValue<string | null>()
        if (!addr) return <span className="text-muted-foreground">—</span>
        return (
          <span className="inline-flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            <span className="line-clamp-2">{addr}</span>
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original
        const busy = deletingUuid === r.uuid
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(r)}
              aria-label={`עריכת ${r.name}`}
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
              aria-label={`מחיקת ${r.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]
}

export function HotelsTable({
  data,
  isLoading,
  onEdit,
  onDelete,
  deletingUuid,
  className,
}: HotelsTableProps) {
  const columns = buildColumns(onEdit, onDelete, deletingUuid)

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
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                אין עדיין מלונות. הוסיפו מלון כדי להתחיל.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
