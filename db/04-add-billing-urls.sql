-- Migration: Add receipt and invoice tracking columns
ALTER TABLE public.payments
  ADD COLUMN receipt_url TEXT,
  ADD COLUMN invoice_url TEXT;
