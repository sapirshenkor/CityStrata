import type { FC } from 'react'

export interface RecommendationsPanelProps {
  selectedRecommendation: unknown
  onSelectRecommendation: (rec: unknown) => void
}

declare const RecommendationsPanel: FC<RecommendationsPanelProps>
export default RecommendationsPanel
