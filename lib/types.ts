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
