import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapLayersPanel, type LayerVisibility } from '../Map/MapLayersPanel'
import EvacueeProfileForm from '../EvacueeProfileForm'
import RecommendationsPanel from '../Recommendations/RecommendationsPanel'
import { cn } from '@/lib/utils'

export type { LayerVisibility }

export interface MapSidebarProps {
  selectedRecommendation: unknown
  onSelectRecommendation: (rec: unknown) => void
  layerVisibility: LayerVisibility
  onToggleLayer: (next: LayerVisibility) => void
  filters: Record<string, unknown>
  onUpdateFilters: (next: Record<string, unknown>) => void
  clusterAssignments: unknown[] | null
  onRunClustering: () => Promise<unknown>
  selectedArea: number | null
  onSelectArea: (area: number | null) => void
  className?: string
}

export function MapSidebar({
  selectedRecommendation,
  onSelectRecommendation,
  layerVisibility,
  onToggleLayer,
  filters,
  onUpdateFilters,
  clusterAssignments,
  onRunClustering,
  selectedArea,
  onSelectArea,
  className,
}: MapSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-[min(100%,380px)] shrink-0 flex-col border-r border-[#e0e0e0] bg-white shadow-[2px_0_8px_rgba(0,0,0,0.08)]',
        className,
      )}
    >
      <Tabs defaultValue="form" className="flex h-full min-h-0 flex-col">
        <TabsList className="mx-3 mt-3 grid w-auto grid-cols-3 rounded-lg bg-[#f8f9fa] p-1">
          <TabsTrigger
            value="form"
            className="px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#667eea] data-[state=active]:shadow-sm sm:text-sm"
          >
            Form
          </TabsTrigger>
          <TabsTrigger
            value="layers"
            className="px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#667eea] data-[state=active]:shadow-sm sm:text-sm"
          >
            Layers
          </TabsTrigger>
          <TabsTrigger
            value="recommendations"
            className="px-1.5 text-[11px] leading-tight data-[state=active]:bg-white data-[state=active]:text-[#667eea] data-[state=active]:shadow-sm sm:px-2 sm:text-xs"
          >
            Recommendations
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <ScrollArea className="h-full flex-1 px-3 pb-4 pt-3">
            <EvacueeProfileForm />
          </ScrollArea>
        </TabsContent>
        <TabsContent
          value="layers"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <ScrollArea className="h-full flex-1 px-3 pb-4 pt-3">
            <MapLayersPanel
              layerVisibility={layerVisibility}
              onToggleLayer={onToggleLayer}
              filters={filters}
              onUpdateFilters={onUpdateFilters}
              clusterAssignments={clusterAssignments}
              onRunClustering={onRunClustering}
              selectedArea={selectedArea}
              onSelectArea={onSelectArea}
            />
          </ScrollArea>
        </TabsContent>
        <TabsContent
          value="recommendations"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <ScrollArea className="h-full flex-1 px-1 pb-4 pt-2">
            <RecommendationsPanel
              selectedRecommendation={selectedRecommendation}
              onSelectRecommendation={onSelectRecommendation}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
