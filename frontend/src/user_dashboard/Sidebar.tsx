import { Link } from 'react-router-dom'
import UserBar from '@/components/UserBar'
import {
  Building2,
  Home,
  MapPin,
  MapPinned,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DEFAULT_SEMEL_YISH = 2600

export interface SidebarProps {
  selectedStat2022: number | null
  onClearSelection: () => void
  onRefreshData: () => void
  isRefreshing?: boolean
  className?: string
}

export function Sidebar({
  selectedStat2022,
  onClearSelection,
  onRefreshData,
  isRefreshing,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'dashboard-app__sidebar-shell flex h-full min-h-0 w-64 shrink-0 flex-col overflow-x-hidden overflow-y-auto',
        className,
      )}
    >
      <div className="dashboard-app__gradient px-5 py-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-white" strokeWidth={1.75} />
          <div>
            <Link to="/" className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
              <h1 className="text-lg font-bold tracking-tight text-white hover:underline">CityStrata</h1>
            </Link>
            <p className="text-xs text-white/90">מיפוי פינוי באילת</p>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-white/85">לוח בקרת רשות</p>
        <div className="mt-4 border-t border-white/20 pt-4">
          <UserBar />
        </div>
      </div>

      <nav className="dashboard-app__sidebar-nav flex flex-col gap-1 p-3">
        <Link to="/map" className="dashboard-app__nav-link">
          <Home className="h-4 w-4 shrink-0" />
          מפה ראשית
        </Link>
        <div className="dashboard-app__nav-link dashboard-app__nav-link--active cursor-default">
          <MapPinned className="h-4 w-4 shrink-0" />
          תצוגת רשות
        </div>
        <Link to="/municipality/poi" className="dashboard-app__nav-link">
          <MapPin className="h-4 w-4 shrink-0" />
          ניהול נקודות עניין
        </Link>
      </nav>

      <div className="mx-3 mt-2 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          היקף עירוני
        </h2>
        <dl className="space-y-2 text-sm text-card-foreground">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">רשות</dt>
            <dd className="font-medium">אילת</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">סמל יישוב</dt>
            <dd className="font-mono text-xs tabular-nums">{DEFAULT_SEMEL_YISH}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">בחירה</dt>
            <dd className="max-w-[8rem] truncate text-end font-mono text-xs">
              {selectedStat2022 == null ? 'כל האזורים' : `אזור ${selectedStat2022}`}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-auto flex flex-col gap-2 p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 rounded-lg"
          onClick={onClearSelection}
          disabled={selectedStat2022 == null}
        >
          <XCircle className="h-4 w-4" />
          ניקוי בחירת אזור
        </Button>
        <Button
          type="button"
          variant="default"
          className="w-full justify-start gap-2 rounded-lg shadow-soft"
          onClick={onRefreshData}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          רענון נתונים
        </Button>
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          הרענון מנקה נתוני לוח בקרה שנשמרו במטמון, כדי שהצפייה הבאה תטען נתונים עדכניים.
        </p>
      </div>
    </aside>
  )
}
