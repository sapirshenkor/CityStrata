import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Coffee,
  GraduationCap,
  Home,
  Hotel,
  Landmark,
  UtensilsCrossed,
} from 'lucide-react'
import type { PoiCategory, PoiCategoryMeta } from './types'

export const POI_CATEGORY_META: Record<PoiCategory, PoiCategoryMeta> = {
  airbnb_listings: {
    category: 'airbnb_listings',
    label: 'Airbnb listings',
    shortLabel: 'Airbnb',
    description: 'Short-term rental listings',
  },
  coffee_shops: {
    category: 'coffee_shops',
    label: 'Coffee shops',
    shortLabel: 'Coffee',
    description: 'Cafés and coffee shops',
  },
  educational_institutions: {
    category: 'educational_institutions',
    label: 'Education',
    shortLabel: 'Education',
    description: 'Schools and institutions',
  },
  hotel_listings: {
    category: 'hotel_listings',
    label: 'Hotels',
    shortLabel: 'Hotels',
    description: 'Hotel listings',
  },
  matnasim: {
    category: 'matnasim',
    label: 'Matnasim',
    shortLabel: 'Matnasim',
    description: 'Community centers',
  },
  restaurants: {
    category: 'restaurants',
    label: 'Restaurants',
    shortLabel: 'Restaurants',
    description: 'Dining venues',
  },
  synagogues: {
    category: 'synagogues',
    label: 'Synagogues',
    shortLabel: 'Synagogues',
    description: 'Religious sites',
  },
}

export const POI_CATEGORY_ICONS: Record<PoiCategory, LucideIcon> = {
  airbnb_listings: Home,
  coffee_shops: Coffee,
  educational_institutions: GraduationCap,
  hotel_listings: Hotel,
  matnasim: Building2,
  restaurants: UtensilsCrossed,
  synagogues: Landmark,
}

export const DEFAULT_POI_CATEGORY: PoiCategory = 'airbnb_listings'
