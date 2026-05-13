import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import EvacueeProfileForm from '../EvacueeProfileForm'
import CommunityForm from '../CommunityForm/CommunityForm'
import RecommendationsPanel from '../Recommendations/RecommendationsPanel'
import CommunityProfilesPanel from '../CommunityProfiles/CommunityProfilesPanel'
import { PublicListingsPanel, type FocusedListing } from './PublicListingsPanel'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { ReactNode } from 'react'

export interface MapSidebarProps {
  selectedRecommendation: unknown
  onSelectRecommendation: (rec: unknown) => void
  onFamilyMacroClusterFocus?: (clusterIndex: number | null) => void
  onRecommendationsProcessingChange?: (processing: boolean) => void
  onFocusLocation?: (focused: FocusedListing) => void
  /** Floating status card (pointer-events-none) anchored to sidebar bottom — map stays usable */
  agentThinkingOverlay?: ReactNode
  className?: string
}

export function MapSidebar({
  selectedRecommendation,
  onSelectRecommendation,
  onFamilyMacroClusterFocus,
  onRecommendationsProcessingChange,
  onFocusLocation,
  agentThinkingOverlay,
  className,
}: MapSidebarProps) {
  const { user } = useAuth()
  const userRole = user?.role ?? null
  const isVisitor = userRole === 'visitor'
  const hasFullAccess = userRole === 'editor' || userRole === 'admin'

  if (!user) {
    return (
      <aside
        className={cn(
          'relative flex h-full w-[min(100%,380px)] shrink-0 flex-col border-r border-border bg-card text-card-foreground shadow-sm shadow-black/20',
          className,
        )}
      >
        <ScrollArea className="h-full min-h-0 flex-1">
          <PublicListingsPanel onFocusLocation={onFocusLocation} />
        </ScrollArea>
        {agentThinkingOverlay ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-50 flex justify-center">
            {agentThinkingOverlay}
          </div>
        ) : null}
      </aside>
    )
  }

  const showFamilyTab = isVisitor || hasFullAccess
  const showCommunityTab = hasFullAccess
  const showFamilyRecommendationsTab = isVisitor || hasFullAccess
  const showCommunityRecommendationsTab = hasFullAccess

  const tabDefinitions = [
    {
      key: 'family',
      visible: showFamilyTab,
      value: 'form',
      title: 'טופס פרופיל משפחה',
      label: 'משפחה',
      compact: false,
    },
    {
      key: 'community',
      visible: showCommunityTab,
      value: 'community',
      title: 'פרופיל קהילה / קבוצה',
      label: 'קהילה',
      compact: false,
    },
    {
      key: 'family-recommendations',
      visible: showFamilyRecommendationsTab,
      value: 'recommendations',
      title: 'המלצות משפחה ודוחות טקטיים',
      label: 'המלצות למשפחה',
      compact: true,
    },
    {
      key: 'community-recommendations',
      visible: showCommunityRecommendationsTab,
      value: 'communities',
      title: 'פרופילי קהילה וקבוצות שמורות',
      label: 'המלצות לקהילה',
      compact: true,
    },
  ] as const

  const visibleTabs = tabDefinitions.filter((tab) => tab.visible)
  const visibleTabsCount = visibleTabs.length
  const hasTwoRows = visibleTabsCount > 3
  const firstRowCount = hasTwoRows ? Math.ceil(visibleTabsCount / 2) : visibleTabsCount

  const defaultTabValue = showFamilyTab ? 'form' : visibleTabs[0]?.value

  return (
    <aside
      className={cn(
        'relative flex h-full w-[min(100%,380px)] shrink-0 flex-col border-r border-border bg-card text-card-foreground shadow-sm shadow-black/20',
        className,
      )}
    >
      <Tabs defaultValue={defaultTabValue} className="flex h-full min-h-0 flex-col">
        <TabsList className="mx-3 mt-3 grid h-auto w-full grid-cols-6 gap-1 rounded-xl bg-muted/60 p-1">
          {visibleTabs.map((tab, index) => {
            const inFirstRow = index < firstRowCount
            const rowCount = hasTwoRows
              ? inFirstRow
                ? firstRowCount
                : visibleTabsCount - firstRowCount
              : visibleTabsCount

            const spanClass = rowCount === 2 ? 'col-span-3' : 'col-span-2'
            const centeredStart = rowCount === 1 ? 'col-start-3' : null
            const compactText = tab.compact && rowCount >= 2

            return (
              <TabsTrigger
                key={tab.key}
                value={tab.value}
                title={tab.title}
                className={cn(
                  spanClass,
                  'min-h-[2.25rem] px-1.5 text-center text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm',
                  compactText
                    ? 'whitespace-normal text-[10px] leading-snug sm:text-[11px]'
                    : 'text-[11px] leading-tight sm:text-xs',
                  centeredStart,
                )}
              >
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {showFamilyTab ? (
          <TabsContent value="form" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <ScrollArea className="h-full flex-1 px-3 pb-4 pt-3">
              <EvacueeProfileForm />
            </ScrollArea>
          </TabsContent>
        ) : null}
        {showCommunityTab ? (
          <TabsContent
            value="community"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full flex-1 px-3 pb-4 pt-3">
              <CommunityForm />
            </ScrollArea>
          </TabsContent>
        ) : null}
        {showFamilyRecommendationsTab ? (
          <TabsContent
            value="recommendations"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full flex-1 px-1 pb-4 pt-2">
              <RecommendationsPanel
                selectedRecommendation={selectedRecommendation}
                onSelectRecommendation={onSelectRecommendation}
                onFamilyMacroClusterFocus={onFamilyMacroClusterFocus}
                onRecommendationsProcessingChange={onRecommendationsProcessingChange}
              />
            </ScrollArea>
          </TabsContent>
        ) : null}
        {showCommunityRecommendationsTab ? (
          <TabsContent
            value="communities"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full flex-1 px-1 pb-4 pt-2">
              <CommunityProfilesPanel />
            </ScrollArea>
          </TabsContent>
        ) : null}
      </Tabs>
      {agentThinkingOverlay ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-50 flex justify-center">
          {agentThinkingOverlay}
        </div>
      ) : null}
    </aside>
  )
}
