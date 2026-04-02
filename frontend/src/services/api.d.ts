import type { AxiosInstance, AxiosResponse } from 'axios'

declare const api: AxiosInstance
export default api

export function getAuthToken(): string | null
export function setAuthToken(token: string | null): void

type ApiRes = AxiosResponse<unknown>

export function getStatisticalAreas(): Promise<ApiRes>
export function getStatisticalArea(stat2022: number): Promise<ApiRes>
export function getStatisticalAreaSummary(stat2022: number): Promise<ApiRes>
export function getInstitutions(params?: Record<string, unknown>): Promise<ApiRes>
export function getInstitution(institutionCode: string): Promise<ApiRes>
export function getAirbnbListings(params?: Record<string, unknown>): Promise<ApiRes>
export function getRestaurants(params?: Record<string, unknown>): Promise<ApiRes>
export function getCoffeeShops(params?: Record<string, unknown>): Promise<ApiRes>
export function getHotels(params?: Record<string, unknown>): Promise<ApiRes>
export function getMatnasim(params?: Record<string, unknown>): Promise<ApiRes>
export function getOSMFacilities(params?: Record<string, unknown>): Promise<ApiRes>
export function getOSMFacilityTypes(): Promise<ApiRes>
export function getSynagogues(params?: Record<string, unknown>): Promise<ApiRes>
export function analyzeEvacuation(data: unknown): Promise<ApiRes>
export function getNearbyResources(params: unknown): Promise<ApiRes>
export function runClustering(k?: number): Promise<ApiRes>
export function getClusterAssignments(runId?: string | null): Promise<ApiRes>
export function getClusterProfiles(runId?: string | null): Promise<ApiRes>
export function getRecommendations(): Promise<ApiRes>
export function getRecommendationByProfile(profileUuid: string): Promise<ApiRes>
export function getRecommendationsOverview(): Promise<ApiRes>
export function getMatchingResultForProfile(profileUuid: string): Promise<ApiRes>
export function runMatchingForProfile(profileUuid: string): Promise<ApiRes>
export function runTacticalForProfile(profileUuid: string): Promise<ApiRes>
export function runCommunityTactical(familyUuids: string[]): Promise<ApiRes>
