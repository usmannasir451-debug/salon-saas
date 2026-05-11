-- Add price snapshot column to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT NULL;

-- Migrate existing records: sum prices from appointment_services junction
UPDATE appointments a
SET total_amount = COALESCE((
  SELECT SUM(s.price)
  FROM appointment_services aps
  JOIN services s ON s.id = aps.service_id
  WHERE aps.appointment_id = a.id
), 0)
WHERE a.total_amount IS NULL;

-- Fallback: for appointments with no junction rows, use direct service_id reference
UPDATE appointments a
SET total_amount = COALESCE((
  SELECT s.price FROM services s WHERE s.id = a.service_id
), 0)
WHERE a.total_amount IS NULL OR a.total_amount = 0;

-- Final fallback: set remaining nulls to 0
UPDATE appointments SET total_amount = 0 WHERE total_amount IS NULL;
