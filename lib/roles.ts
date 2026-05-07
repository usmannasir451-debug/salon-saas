import type { UserRole } from './types'

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  regional_manager: 'Regional Manager',
  manager: 'Manager',
  receptionist: 'Receptionist',
  cashier: 'Cashier',
  staff: 'Staff',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-primary/10 text-primary border-primary/20',
  regional_manager: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  manager: 'bg-blue-50 text-blue-700 border-blue-200',
  receptionist: 'bg-purple-50 text-purple-700 border-purple-200',
  cashier: 'bg-green-50 text-green-700 border-green-200',
  staff: 'bg-orange-50 text-orange-700 border-orange-200',
}

export const ROLE_NAV: Record<UserRole, string[]> = {
  owner: ['/dashboard', '/appointments', '/calendar', '/walkin', '/services', '/staff', '/clients', '/branches', '/team', '/settings'],
  regional_manager: ['/dashboard', '/branches'],
  manager: ['/dashboard', '/appointments', '/calendar', '/walkin', '/services', '/staff', '/clients', '/branches'],
  receptionist: ['/appointments', '/calendar', '/walkin', '/clients'],
  cashier: ['/appointments', '/calendar', '/walkin'],
  staff: ['/appointments'],
}

export function canCreate(role: UserRole): boolean {
  return ['owner', 'manager', 'receptionist'].includes(role)
}

export function canEdit(role: UserRole): boolean {
  return ['owner', 'manager', 'receptionist'].includes(role)
}

export function canDelete(role: UserRole): boolean {
  return ['owner', 'manager'].includes(role)
}

export function canMarkPayment(role: UserRole): boolean {
  return ['owner', 'manager', 'cashier'].includes(role)
}

export function canApplyDiscount(role: UserRole): boolean {
  return ['owner', 'manager', 'cashier'].includes(role)
}

export function canAccessSettings(role: UserRole): boolean {
  return role === 'owner'
}
