export type UserRole = 'owner' | 'regional_manager' | 'manager' | 'receptionist' | 'cashier' | 'staff'

export type DiscountType = 'fixed' | 'percentage'
export type DiscountReason = 'loyalty' | 'promo' | 'staff_discount' | 'birthday' | 'other'
export type PaymentMethod = 'cash' | 'card' | 'jazzcash' | 'easypaisa'

export type Service = {
  id: string
  user_id: string
  name: string
  duration: number
  price: number
  created_at: string
}

export type StaffMember = {
  id: string
  user_id: string
  name: string
  phone: string
  linked_user_id?: string | null
  created_at: string
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type Appointment = {
  id: string
  user_id: string
  client_name: string
  client_phone?: string
  service_id: string
  staff_id: string
  branch_id?: string
  appointment_date: string
  appointment_time: string
  status: AppointmentStatus
  payment_status: 'unpaid' | 'paid'
  discount_amount: number
  discount_type?: DiscountType
  discount_reason?: DiscountReason
  feedback?: string | null
  notes?: string
  created_at: string
  services?: Service
  staff?: StaffMember
}

export type Profile = {
  id: string
  email: string
  full_name?: string
  salon_name?: string
  salon_logo_url?: string
  salon_primary_color?: string
  salon_address?: string
  salon_phone?: string
  salon_email?: string
  salon_timezone?: string
  salon_currency?: string
  max_discount_owner?: number
  max_discount_manager?: number
  max_discount_cashier?: number
  created_at: string
}

export type Branch = {
  id: string
  user_id: string
  name: string
  address?: string
  phone?: string
  created_at: string
}

export type SalonMember = {
  id: string
  owner_id: string
  member_user_id: string | null
  email: string
  role: Exclude<UserRole, 'owner'>
  staff_id?: string | null
  status: 'pending' | 'active'
  invited_at: string
  joined_at?: string | null
  staff?: { id: string; name: string } | null
}

export type WalkIn = {
  id: string
  user_id: string
  client_name?: string
  client_phone?: string
  service_id?: string
  staff_id?: string
  branch_id?: string
  payment_method: PaymentMethod
  subtotal: number
  discount_type?: DiscountType
  discount_value: number
  discount_amount: number
  discount_reason?: DiscountReason
  total: number
  payment_status: 'unpaid' | 'paid'
  notes?: string
  created_at: string
  services?: Service
  staff?: StaffMember
}
