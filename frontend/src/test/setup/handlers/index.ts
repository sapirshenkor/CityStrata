import { authHandlers } from './auth.handlers'
import { familyHandlers } from './family.handlers'
import { mapHandlers } from './map.handlers'
import { recommendationsHandlers } from './recommendations.handlers'

export const handlers = [...authHandlers, ...mapHandlers, ...familyHandlers, ...recommendationsHandlers]
