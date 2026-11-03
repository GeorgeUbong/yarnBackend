-- Restore the field used by authentication and profile endpoints.
ALTER TABLE "User" ADD COLUMN "profileImage" VARCHAR(7000000);
