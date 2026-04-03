import type { AxiosResponse } from 'axios'
import api from '@/services/api'
import type { PoiCategory, PoiEntityRow, PoiListPage } from './types'

const base = (category: PoiCategory) => `/api/poi/${category}`

const DEFAULT_PAGE_SIZE = 10

export async function fetchPoiList(
  category: PoiCategory,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
  search?: string,
): Promise<PoiListPage> {
  const q = search?.trim()
  const res: AxiosResponse<PoiListPage> = await api.get(base(category), {
    params: {
      page,
      page_size: pageSize,
      ...(q ? { search: q } : {}),
    },
  })
  return res.data
}

export async function createPoi(
  category: PoiCategory,
  body: Record<string, unknown>,
): Promise<PoiEntityRow> {
  const res: AxiosResponse<PoiEntityRow> = await api.post(base(category), body)
  return res.data
}

export async function updatePoi(
  category: PoiCategory,
  id: string,
  body: Record<string, unknown>,
): Promise<PoiEntityRow> {
  const res: AxiosResponse<PoiEntityRow> = await api.patch(`${base(category)}/${id}`, body)
  return res.data
}

export async function deletePoi(category: PoiCategory, id: string): Promise<void> {
  await api.delete(`${base(category)}/${id}`)
}
