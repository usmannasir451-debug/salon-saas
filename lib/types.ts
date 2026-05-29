export type UserRole = 'owner' | 'regional_manager' | 'manager' | 'receptionist' | 'cashier' | 'staff'

export type DiscountType = 'fixed' | 'percentage'
export type DiscountReason = 'loyalty' | 'promo' | 'staff_discount' | 'birthday' | 'other'
export type PaymentMethod = string

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
  joining_date?: string | null
  gender?: 'male' | 'female' | 'other' | null
  designation?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  salary_type?: SalaryType | null
  fixed_amount?: number | null
  commission_percentage?: number | null
  leave_allowance?: number | null
  is_active: boolean
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
  deal_id?: string | null
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
  appointment_services?: { services: Service }[]
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
  tax_percentage?: number
  loyalty_enabled?: boolean
  loyalty_earn_pct?: number
  loyalty_expiry_days?: number | null
  subscription_status?: 'active' | 'suspended'
  expense_categories?: string[] | null
  expense_budgets?: Record<string, number> | null
  max_branches?: number | null
  max_staff?: number | null
  enabled_modules?: string[] | null
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
  display_name?: string | null
  permissions?: string[] | null
  last_set_password?: string | null
  staff_id?: string | null
  status: 'pending' | 'active' | 'inactive'
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
  deal_id?: string | null
  payment_method: PaymentMethod
  subtotal: number
  discount_type?: DiscountType
  discount_value: number
  discount_amount: number
  discount_reason?: DiscountReason
  loyalty_redeemed?: number
  total: number
  payment_status: 'unpaid' | 'paid'
  notes?: string
  created_at: string
  services?: Service
  staff?: StaffMember
  walk_in_services?: { services: Service }[]
}

export type ExpenseCategory =
  | 'staff_refreshments'
  | 'salon_materials'
  | 'inventory'
  | 'utilities'
  | 'rent'
  | 'marketing'
  | 'miscellaneous'

export type Expense = {
  id: string
  user_id: string
  branch_id?: string | null
  category: string
  description: string
  amount: number
  expense_date: string
  paid_by?: string | null
  notes?: string | null
  receipt_url?: string | null
  approval_status?: 'pending' | 'approved'
  is_recurring: boolean
  created_at: string
}

export type InventoryItem = {
  id: string
  user_id: string
  name: string
  category: string
  quantity: number
  unit: string
  reorder_level: number
  cost_price: number
  supplier?: string
  created_at: string
}

export type StockAdjustment = {
  id: string
  user_id: string
  item_id: string
  adjustment: number
  reason: string
  adjusted_by?: string
  created_at: string
}

export type SalaryType = 'fixed' | 'commission' | 'both'

export type StaffSalary = {
  id: string
  user_id: string
  staff_id: string
  salary_type: SalaryType
  fixed_amount: number
  commission_pct: number
  created_at: string
  staff?: StaffMember
}

export type PayrollEntry = {
  id: string
  user_id: string
  staff_id: string
  month: string
  fixed_salary: number
  revenue_generated: number
  commission_earned: number
  total_payable: number
  prorata_pct?: number | null
  prorata_detail?: string | null
  attendance_present_days?: number | null
  attendance_working_days?: number | null
  attendance_deduction?: number | null
  attendance_detail?: string | null
  is_paid: boolean
  paid_date?: string
  paid_method?: string
  notes?: string
  created_at: string
  staff?: StaffMember
}

export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave' | 'holiday'

export type AttendanceRecord = {
  id?: string
  owner_id: string
  staff_id: string
  date: string
  status: AttendanceStatus
  branch_id?: string | null
  notes?: string | null
  created_at?: string
  staff?: Pick<StaffMember, 'id' | 'name'>
}

export type Deal = {
  id: string
  user_id: string
  name: string
  description?: string | null
  price: number
  validity_days?: number | null
  is_active: boolean
  created_at: string
  deal_services?: { services: Service }[]
}

export type LoyaltyTransaction = {
  id: string
  user_id: string
  client_phone: string
  client_name?: string | null
  transaction_type: 'earned' | 'redeemed'
  amount: number
  reference_id?: string | null
  reference_type?: 'appointment' | 'walk_in' | null
  notes?: string | null
  created_at: string
}

export type CustomInventoryCategory = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type Lead = {
  id: string
  name: string
  phone: string
  salon_name: string
  branches: string
  city: string
  source: string
  message: string | null
  status: 'new' | 'contacted' | 'converted' | 'lost'
  notes: string | null
  created_at: string
}
