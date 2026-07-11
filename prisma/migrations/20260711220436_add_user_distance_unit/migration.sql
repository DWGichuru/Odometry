-- CreateEnum
CREATE TYPE "DistanceUnit" AS ENUM ('KM', 'MI');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'MI';
