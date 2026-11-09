ALTER TABLE "TravelProfile"
  DROP CONSTRAINT "TravelProfile_userId_fkey",
  ADD CONSTRAINT "TravelProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
