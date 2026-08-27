-- ==============================================================================
-- FlowGuard AI — Module 3: Persistence Layer (Supabase Setup)
-- Database schema, Storage buckets, and Permissive RLS policies for Hackathon MVP
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. THE AUDIT TABLE (events)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    camera_id TEXT NOT NULL,
    anomaly_type TEXT NOT NULL DEFAULT 'tailgating',
    confidence_score NUMERIC(4, 2) DEFAULT 0.95,
    snapshot_url TEXT
);

-- Index for fast queries by camera and recency
CREATE INDEX IF NOT EXISTS idx_events_camera_created_at 
ON public.events (camera_id, created_at DESC);

-- ==============================================================================
-- 2. THE STORAGE BUCKETS (flowguard-snapshots & anomaly-snapshots)
-- ==============================================================================
-- Create 'flowguard-snapshots' bucket as PUBLIC
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'flowguard-snapshots',
    'flowguard-snapshots',
    true,
    52428800, -- 50MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Create 'anomaly-snapshots' bucket as fallback
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'anomaly-snapshots',
    'anomaly-snapshots',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES (HACKATHON MODE)
-- ==============================================================================
-- HACKATHON MVP: Permissive RLS. Do not use in production without Service Role Keys.

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Safely drop all variations of existing policies on events table
DROP POLICY IF EXISTS "Allow public read and write on events" ON public.events;
DROP POLICY IF EXISTS "Allow public read access on events" ON public.events;
DROP POLICY IF EXISTS "Allow public insert access on events" ON public.events;
DROP POLICY IF EXISTS "Allow public all access on events" ON public.events;

-- Permissive policy for events table: full SELECT and INSERT access
CREATE POLICY "Allow public read and write on events"
ON public.events
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Drop existing storage policies on storage.objects
DROP POLICY IF EXISTS "Public Access - View snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Public Access - Upload snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Public Access - Update snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Public Access - View flowguard snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Public Access - Upload flowguard snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Public Access - Update flowguard snapshots" ON storage.objects;

-- Permissive policy: View images from both flowguard-snapshots and anomaly-snapshots
CREATE POLICY "Public Access - View snapshots"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id IN ('flowguard-snapshots', 'anomaly-snapshots'));

-- Permissive policy: Upload images
CREATE POLICY "Public Access - Upload snapshots"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id IN ('flowguard-snapshots', 'anomaly-snapshots'));

-- Permissive policy: Update images
CREATE POLICY "Public Access - Update snapshots"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id IN ('flowguard-snapshots', 'anomaly-snapshots'))
WITH CHECK (bucket_id IN ('flowguard-snapshots', 'anomaly-snapshots'));
