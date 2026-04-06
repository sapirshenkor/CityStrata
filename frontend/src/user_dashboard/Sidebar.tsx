import { Link } from 'react-router-dom'
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
        'dashboard-app__sidebar-shell flex w-64 shrink-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="dashboard-app__gradient px-5 py-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-white" strokeWidth={1.75} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">CityStrata</h1>
            <p className="text-xs text-white/90">Eilat evacuation mapping</p>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-white/85">Municipality dashboard</p>
      </div>

      <nav className="dashboard-app__sidebar-nav flex flex-col gap-1 p-3">
        <Link to="/" className="dashboard-app__nav-link">
          <Home className="h-4 w-4 shrink-0" />
          Main map
        </Link>
        <div className="dashboard-app__nav-link dashboard-app__nav-link--active cursor-default">
          <MapPinned className="h-4 w-4 shrink-0" />
          Municipality view
        </div>
        <Link to="/municipality/poi" className="dashboard-app__nav-link">
          <MapPin className="h-4 w-4 shrink-0" />
          POI management
        </Link>
      </nav>

      <div className="mx-3 mt-2 rounded-lg border border-[#e0e0e0] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666]">City scope</h2>
        <dl className="space-y-2 text-sm text-[#333]">
          <div className="flex justify-between gap-2">
            <dt className="text-[#666]">Municipality</dt>
            <dd className="font-medium">Eilat</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#666]">Semel yish</dt>
            <dd className="font-mono text-xs tabular-nums">{DEFAULT_SEMEL_YISH}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#666]">Selection</dt>
            <dd className="max-w-[8rem] truncate text-right font-mono text-xs">
              {selectedStat2022 == null ? 'All areas' : `Area ${selectedStat2022}`}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-auto flex flex-col gap-2 p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 rounded-md border-[#e0e0e0] bg-white text-[#333] hover:bg-[#f8f9fa] hover:text-[#333]"
          onClick={onClearSelection}
          disabled={selectedStat2022 == null}
        >
          <XCircle className="h-4 w-4" />
          Clear area selection
        </Button>
        <Button
          type="button"
          className="w-full justify-start gap-2 rounded-md border-0 bg-[#667eea] text-white shadow-none hover:bg-[#5568d3]"
          onClick={onRefreshData}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          Refresh data
        </Button>
        <p className="px-1 text-[11px] leading-snug text-[#666]">
          Refresh invalidates cached dashboard queries so the next view loads fresh data from the API.
        </p>
      </div>
    </aside>
  )
}
