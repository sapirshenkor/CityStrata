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
    label: 'נכסי Airbnb',
    shortLabel: 'Airbnb',
    description: 'נכסי שהייה לטווח קצר',
  },
  coffee_shops: {
    category: 'coffee_shops',
    label: 'בתי קפה',
    shortLabel: 'קפה',
    description: 'בתי קפה ומקומות ישיבה',
  },
  educational_institutions: {
    category: 'educational_institutions',
    label: 'חינוך',
    shortLabel: 'חינוך',
    description: 'בתי ספר ומוסדות חינוך',
  },
  hotel_listings: {
    category: 'hotel_listings',
    label: 'מלונות',
    shortLabel: 'מלונות',
    description: 'רשומות מלונות',
  },
  matnasim: {
    category: 'matnasim',
    label: 'מתנ"סים',
    shortLabel: 'מתנ"ס',
    description: 'מרכזים קהילתיים',
  },
  restaurants: {
    category: 'restaurants',
    label: 'מסעדות',
    shortLabel: 'מסעדות',
    description: 'מקומות הסעדה',
  },
  synagogues: {
    category: 'synagogues',
    label: 'בתי כנסת',
    shortLabel: 'בתי כנסת',
    description: 'אתרי דת ותפילה',
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
