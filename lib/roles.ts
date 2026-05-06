import type { UserRole } from './types'

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  receptionist: 'Receptionist',
  cashier: 'Cashier',
  staff: 'Staff',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-primary/10 text-primary border-primary/20',
  manager: 'bg-blue-50 text-blue-700 border-blue-200',
  receptionist: 'bg-purple-50 text-purple-700 border-purple-200',
  cashier: 'bg-green-50 text-green-700 border-green-200',
  staff: 'bg-orange-50 text-orange-700 border-orange-200',
}

export const ROLE_NAV: Record<UserRole, string[]> = {
  owner: ['/dashboard', '/appointments', '/services', '/staff', '/clients', '/branches', '/team'],
  manager: ['/dashboard', '/appointments', '/services', '/staff', '/clients', '/branches'],
  receptionist: ['/appointments', '/clients'],
  cashier: ['/appointments'],
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
