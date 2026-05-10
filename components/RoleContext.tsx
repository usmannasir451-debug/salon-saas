'use client'

import { createContext, useContext } from 'react'
import type { UserRole } from '@/lib/types'

export interface UserCtx {
  role: UserRole
  ownerId: string
  staffId?: string
  permissions?: string[] | null
}

const defaultCtx: UserCtx = { role: 'owner', ownerId: '' }
export const RoleContext = createContext<UserCtx>(defaultCtx)
export const useUserContext = () => useContext(RoleContext)

export function RoleProvider({ value, children }: { value: UserCtx; children: React.ReactNode }) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}
