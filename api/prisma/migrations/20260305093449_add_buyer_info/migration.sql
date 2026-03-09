/*
  Warnings:

  - Added the required column `buyer_email` to the `tickets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buyer_name` to the `tickets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buyer_phone` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "buyer_email" TEXT NOT NULL,
ADD COLUMN     "buyer_name" TEXT NOT NULL,
ADD COLUMN     "buyer_phone" TEXT NOT NULL;
