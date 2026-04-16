export const familyKeys = {
  all: ['family'] as const,
  dashboard: () => [...familyKeys.all, 'dashboard'] as const,
  profiles: () => [...familyKeys.all, 'profiles'] as const,
  profile: (uuid: string) => [...familyKeys.all, 'profile', uuid] as const,
}
