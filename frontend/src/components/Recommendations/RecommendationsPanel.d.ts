import type { FC } from 'react'

export interface RecommendationsPanelProps {
  selectedRecommendation: unknown
  onSelectRecommendation: (rec: unknown) => void
  /** When set, map zooms to the statistical-area union for this macro-cluster index */
  onFamilyMacroClusterFocus?: (clusterIndex: number | null) => void
  /** Notifies MapApp while matching / tactical / community agent requests run */
  onRecommendationsProcessingChange?: (processing: boolean) => void
}

declare const RecommendationsPanel: FC<RecommendationsPanelProps>
export default RecommendationsPanel
