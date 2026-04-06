export const hotelManagementKeys = {
  all: ['hotels-management'] as const,
  list: () => [...hotelManagementKeys.all, 'list'] as const,
}
