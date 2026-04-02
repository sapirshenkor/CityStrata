import type { AxiosResponse } from 'axios'
import api from '@/services/api'
import type { HotelCreateInput, HotelRow, HotelUpdateInput } from './types'

const BASE = '/api/hotels-management'

export async function fetchHotels(): Promise<HotelRow[]> {
  const res: AxiosResponse<HotelRow[]> = await api.get(BASE)
  return res.data
}

export async function createHotel(body: HotelCreateInput): Promise<HotelRow> {
  const res: AxiosResponse<HotelRow> = await api.post(BASE, body)
  return res.data
}

export async function updateHotel(uuid: string, body: HotelUpdateInput): Promise<HotelRow> {
  const res: AxiosResponse<HotelRow> = await api.patch(`${BASE}/${uuid}`, body)
  return res.data
}

export async function deleteHotel(uuid: string): Promise<void> {
  await api.delete(`${BASE}/${uuid}`)
}
