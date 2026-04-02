/** Hotel row returned by GET/PATCH/POST /api/hotels-management */

export interface HotelRow {
  uuid: string
  hotelid: number
  url: string | null
  name: string
  description: string | null
  type: string | null
  rating_value: number | null
  location_fulladdress: string | null
  coordinates_latitude: number
  coordinates_longitude: number
  semel_yish: number
  stat_2022: number
  imported_at: string
}

export interface HotelCreateInput {
  name: string
  location_fulladdress: string
  type?: string | null
  description?: string | null
  url?: string | null
  rating_value?: number | null
}

export type HotelUpdateInput = Partial<HotelCreateInput>
