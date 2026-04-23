import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { runClustering } from '../../services/api'
import { useOSMFacilityTypes } from '../../hooks/useMapData'
import AreaDetails from '../Sidebar/AreaDetails'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const LAYER_DEFS: {
  key: keyof LayerVisibility
  label: string
}[] = [
  { key: 'statisticalAreas', label: 'Statistical areas' },
  { key: 'institutions', label: 'Educational institutions' },
  { key: 'airbnb', label: 'Airbnb listings' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'coffeeShops', label: 'Coffee shops' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'matnasim', label: 'Matnasim' },
  { key: 'osmFacilities', label: 'OSM facilities' },
  { key: 'synagogues', label: 'Synagogues' },
]

export type LayerVisibility = {
  statisticalAreas: boolean
  institutions: boolean
  airbnb: boolean
  restaurants: boolean
  coffeeShops: boolean
  hotels: boolean
  matnasim: boolean
  osmFacilities: boolean
  synagogues: boolean
  clusters: boolean
}

export interface MapLayersPanelProps {
  layerVisibility: LayerVisibility
  onToggleLayer: (next: LayerVisibility) => void
  filters: Record<string, unknown>
  onUpdateFilters: (next: Record<string, unknown>) => void
  clusterAssignments: unknown[] | null
  onRunClustering: () => Promise<unknown>
  selectedArea: number | null
  onSelectArea: (area: number | null) => void
}

export function MapLayersPanel({
  layerVisibility,
  onToggleLayer,
  filters,
  onUpdateFilters,
  clusterAssignments,
  onRunClustering,
  selectedArea,
  onSelectArea,
}: MapLayersPanelProps) {
  const [facilityTypeSearch, setFacilityTypeSearch] = useState('')
  const [clusteringRunning, setClusteringRunning] = useState(false)
  const [clusteringError, setClusteringError] = useState<string | null>(null)
  const { data: facilityTypes, loading: facilityTypesLoading } = useOSMFacilityTypes()

  const handleRunClustering = async () => {
    setClusteringError(null)
    setClusteringRunning(true)
    try {
      await runClustering(4)
      await onRunClustering()
      onToggleLayer({ ...layerVisibility, clusters: true })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      setClusteringError(e.response?.data?.detail ?? e.message ?? 'Clustering failed')
    } finally {
      setClusteringRunning(false)
    }
  }

  const toggleFacilityType = (facilityType: string) => {
    const currentTypes = (filters.osmFacilities as { facility_types?: string[] } | undefined)
      ?.facility_types ?? []
    const newTypes = currentTypes.includes(facilityType)
      ? currentTypes.filter((t) => t !== facilityType)
      : [...currentTypes, facilityType]
    onUpdateFilters({
      ...filters,
      osmFacilities: {
        ...(filters.osmFacilities as object),
        facility_types: newTypes.length > 0 ? newTypes : undefined,
      },
    })
  }

  const selectAllFacilityTypes = () => {
    if (facilityTypes && facilityTypes.length > 0) {
      const filteredTypes = facilityTypeSearch
        ? facilityTypes.filter((type: string) =>
            type.toLowerCase().includes(facilityTypeSearch.toLowerCase()),
          )
        : facilityTypes
      onUpdateFilters({
        ...filters,
        osmFacilities: {
          ...(filters.osmFacilities as object),
          facility_types: filteredTypes,
        },
      })
    }
  }

  const deselectAllFacilityTypes = () => {
    onUpdateFilters({
      ...filters,
      osmFacilities: {
        ...(filters.osmFacilities as object),
        facility_types: undefined,
      },
    })
  }

  const filteredFacilityTypes =
    facilityTypes?.filter((type: string) =>
      type.toLowerCase().includes(facilityTypeSearch.toLowerCase()),
    ) ?? []

  const setLayer = (key: keyof LayerVisibility, checked: boolean) => {
    onToggleLayer({ ...layerVisibility, [key]: checked })
  }

  return (
    <div className="space-y-5 pr-1">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Map layers</h2>
        <p className="text-xs text-muted-foreground">
          Toggle overlays on the map. Turn on OSM facilities, then choose types below.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Visibility</h3>
        <div className="space-y-3">
          {LAYER_DEFS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label htmlFor={`sidebar-layer-${key}`} className="cursor-pointer text-slate-900">
                {label}
              </Label>
              <Switch
                id={`sidebar-layer-${key}`}
                checked={layerVisibility[key]}
                onCheckedChange={(c) => setLayer(key, c)}
              />
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sidebar-layer-clusters" className="cursor-pointer text-slate-900">
              Show clusters on map
            </Label>
            <Switch
              id="sidebar-layer-clusters"
              checked={layerVisibility.clusters}
              onCheckedChange={(c) => setLayer('clusters', c)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Clustering</h3>
        <Button
          type="button"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={clusteringRunning}
          onClick={() => void handleRunClustering()}
        >
          {clusteringRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running…
            </>
          ) : (
            'Run clustering'
          )}
        </Button>
        {clusteringError ? <p className="text-sm text-destructive">{clusteringError}</p> : null}
        {clusterAssignments && (
          <p className="text-xs text-muted-foreground">
            {clusterAssignments.length} areas in latest run
          </p>
        )}
      </section>

      {layerVisibility.osmFacilities && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">OSM facility types</h3>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={selectAllFacilityTypes}>
                All
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={deselectAllFacilityTypes}>
                None
              </Button>
            </div>
          </div>
          {facilityTypesLoading ? (
            <p className="text-sm text-muted-foreground">Loading types…</p>
          ) : (
            <>
              <Input
                placeholder="Search types…"
                value={facilityTypeSearch}
                onChange={(e) => setFacilityTypeSearch(e.target.value)}
              />
              {filteredFacilityTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No types match.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {filteredFacilityTypes.map((type: string) => {
                    const selected = (
                      filters.osmFacilities as { facility_types?: string[] } | undefined
                    )?.facility_types?.includes(type)
                    return (
                      <div key={type} className="flex items-center justify-between gap-2">
                        <Label className="max-w-[200px] cursor-pointer truncate text-xs font-normal">
                          {type}
                        </Label>
                        <Switch
                          checked={!!selected}
                          onCheckedChange={() => toggleFacilityType(type)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
              {(filters.osmFacilities as { facility_types?: string[] } | undefined)?.facility_types
                ?.length ? (
                <p className="text-xs text-muted-foreground">
                  {(filters.osmFacilities as { facility_types: string[] }).facility_types.length}{' '}
                  type(s) selected
                </p>
              ) : (
                <p className="text-xs text-amber-700">Select at least one type to load OSM data.</p>
              )}
            </>
          )}
        </section>
      )}

      {selectedArea != null && (
        <section>
          <AreaDetails stat2022={selectedArea} onClose={() => onSelectArea(null)} />
        </section>
      )}
    </div>
  )
}
