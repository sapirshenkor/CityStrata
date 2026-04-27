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
  { key: 'statisticalAreas', label: 'אזורים סטטיסטיים' },
  { key: 'institutions', label: 'מוסדות חינוך' },
  { key: 'airbnb', label: 'נכסי Airbnb' },
  { key: 'restaurants', label: 'מסעדות' },
  { key: 'coffeeShops', label: 'בתי קפה' },
  { key: 'hotels', label: 'מלונות' },
  { key: 'matnasim', label: 'מתנ"סים' },
  { key: 'osmFacilities', label: 'מתקני OSM' },
  { key: 'synagogues', label: 'בתי כנסת' },
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
      setClusteringError(e.response?.data?.detail ?? e.message ?? 'הרצת האשכול נכשלה')
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
        <h2 className="text-base font-semibold text-foreground">שכבות מפה</h2>
        <p className="text-xs text-muted-foreground">
          הפעילו שכבות על גבי המפה. להפעלת נתוני OSM יש לבחור סוגי מתקנים בהמשך.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">הצגה</h3>
        <div className="space-y-3">
          {LAYER_DEFS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label htmlFor={`sidebar-layer-${key}`} className="cursor-pointer text-foreground">
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
            <Label htmlFor="sidebar-layer-clusters" className="cursor-pointer text-foreground">
              הצגת אשכולות במפה
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
        <h3 className="text-sm font-semibold text-foreground">אשכול</h3>
        <Button
          type="button"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={clusteringRunning}
          onClick={() => void handleRunClustering()}
        >
          {clusteringRunning ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              מריץ...
            </>
          ) : (
            'הרצת אשכול'
          )}
        </Button>
        {clusteringError ? <p className="text-sm text-destructive">{clusteringError}</p> : null}
        {clusterAssignments && (
          <p className="text-xs text-muted-foreground">
            {clusterAssignments.length} אזורים בהרצה האחרונה
          </p>
        )}
      </section>

      {layerVisibility.osmFacilities && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">סוגי מתקני OSM</h3>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={selectAllFacilityTypes}>
                הכול
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={deselectAllFacilityTypes}>
                ללא
              </Button>
            </div>
          </div>
          {facilityTypesLoading ? (
            <p className="text-sm text-muted-foreground">טוען סוגים...</p>
          ) : (
            <>
              <Input
                placeholder="חיפוש סוגים..."
                value={facilityTypeSearch}
                onChange={(e) => setFacilityTypeSearch(e.target.value)}
              />
              {filteredFacilityTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין סוגים תואמים.</p>
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
                  סוגים נבחרו
                </p>
              ) : (
                <p className="text-xs text-amber-500">יש לבחור לפחות סוג אחד לטעינת נתוני OSM.</p>
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
