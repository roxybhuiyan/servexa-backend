-- Preserve legacy links and records; new service orders do not require slots.
ALTER TABLE "Booking" ALTER COLUMN "slotId" DROP NOT NULL;
