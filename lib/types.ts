export type UserRole = 'owner' | 'manager' | 'receptionist' | 'cashier' | 'staff'

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

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

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
