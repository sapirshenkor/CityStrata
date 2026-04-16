import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFamilyProfile,
  getFamilyDashboard,
  getFamilyProfile,
  getFamilyProfiles,
  updateFamilyProfile,
} from '../../services/api'
import { familyKeys } from '../queryKeys'

export function useFamilyDashboard() {
  return useQuery({
    queryKey: familyKeys.dashboard(),
    queryFn: async () => {
      const { data } = await getFamilyDashboard()
      return data
    },
  })
}

export function useFamilyProfiles() {
  return useQuery({
    queryKey: familyKeys.profiles(),
    queryFn: async () => {
      const { data } = await getFamilyProfiles()
      return data
    },
  })
}

export function useFamilyProfile(profileUuid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: familyKeys.profile(profileUuid ?? ''),
    queryFn: async () => {
      const { data } = await getFamilyProfile(profileUuid!)
      return data
    },
    enabled: enabled && Boolean(profileUuid),
  })
}

export function useCreateFamilyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await createFamilyProfile(payload)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: familyKeys.all })
    },
  })
}

export function useUpdateFamilyProfile(profileUuid: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await updateFamilyProfile(profileUuid!, payload)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: familyKeys.all })
    },
  })
}
