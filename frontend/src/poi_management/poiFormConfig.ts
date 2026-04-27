import type { PoiCategory } from './types'

/** UI copy and field labels aligned with DB column names per category. */
export interface PoiFormFieldConfig {
  /** Short noun phrase for dialog titles, e.g. "Airbnb listing", "Coffee shop" */
  addRecordTitle: string
  /** Subtitle under the dialog title */
  dialogDescription: string
  nameLabel: string
  namePlaceholder: string
  addressLabel: string
  addressPlaceholder: string
  /** Shown under address for geocoding-backed categories */
  addressHint?: string
  typeField: false | { label: string; placeholder: string }
  /** Shown under optional rating input when present */
  ratingHint?: string
}

const GEOCODE_HINT =
  'משמש לגיאוקוד - מומלץ להזין כתובת מלאה שהשרת יכול לזהות (עיר ורחוב).'

export const POI_FORM_FIELD_CONFIG: Record<PoiCategory, PoiFormFieldConfig> = {
  airbnb_listings: {
    addRecordTitle: 'נכס Airbnb',
    dialogDescription:
      'הזינו פרטי נכס לשהייה קצרה. הקואורדינטות יישמרו לאחר גיאוקוד הכתובת.',
    nameLabel: 'כותרת',
    namePlaceholder: 'כותרת הנכס',
    addressLabel: 'מיקום / כתובת קצרה',
    addressPlaceholder: 'אזור או שורת כתובת',
    addressHint:
      'מוצג כשורת המיקום של הנכס. הקואורדינטות נקבעות לאחר גיאוקוד.',
    typeField: false,
  },
  coffee_shops: {
    addRecordTitle: 'בית קפה',
    dialogDescription:
      'הזינו פרטי מקום, כתובת ושעות פעילות. הרחוב משמש לגיאוקוד קואורדינטות.',
    nameLabel: 'שם המקום',
    namePlaceholder: 'שם בית הקפה',
    addressLabel: 'כתובת רחוב',
    addressPlaceholder: 'רחוב, עיר',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  restaurants: {
    addRecordTitle: 'מסעדה',
    dialogDescription:
      'הזינו פרטי מסעדה, כתובת וקישורים. הרחוב משמש לגיאוקוד מיקום.',
    nameLabel: 'שם המסעדה',
    namePlaceholder: 'שם המסעדה',
    addressLabel: 'רחוב (מיקום)',
    addressPlaceholder: 'רחוב, עיר',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  hotel_listings: {
    addRecordTitle: 'מלון',
    dialogDescription:
      'הזינו פרטי מלון. הכתובת המלאה עוברת גיאוקוד בעת יצירת הרשומה.',
    nameLabel: 'שם המלון',
    namePlaceholder: 'שם הנכס',
    addressLabel: 'כתובת מלאה',
    addressPlaceholder: 'כתובת מלאה לגיאוקוד',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  matnasim: {
    addRecordTitle: 'מתנ"ס',
    dialogDescription:
      'הזינו פרטי מרכז קהילתי, איש קשר, תפוסה ופרטי מיגון. הכתובת עוברת גיאוקוד.',
    nameLabel: 'שם המרכז',
    namePlaceholder: 'שם המרכז הקהילתי',
    addressLabel: 'כתובת מלאה',
    addressPlaceholder: 'רחוב ועיר',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  educational_institutions: {
    addRecordTitle: 'מוסד חינוך',
    dialogDescription:
      'הזינו פרטי מוסד חינוך. הכתובת עוברת גיאוקוד לצורך מיקום במפה.',
    nameLabel: 'שם המוסד',
    namePlaceholder: 'שם בית ספר או מוסד',
    addressLabel: 'כתובת מלאה',
    addressPlaceholder: 'רחוב ועיר',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  synagogues: {
    addRecordTitle: 'בית כנסת',
    dialogDescription:
      'הזינו שם וסוג בעברית או באנגלית, וכתובת לגיאוקוד בעת יצירה.',
    nameLabel: 'שם',
    namePlaceholder: 'שם באנגלית',
    addressLabel: 'כתובת',
    addressPlaceholder: 'כתובת רחוב',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
}

export function getPoiFormFieldConfig(category: PoiCategory): PoiFormFieldConfig {
  return POI_FORM_FIELD_CONFIG[category]
}
