-- Performance Module (PMM) gaps per PRD Section 4.7
-- PMM-005: Scanned Document Upload
-- PMM-003/004: DPCR & BPCR support (ratingType already includes 'dpcr' and 'bpcr')

-- Add scanned_doc_url column to performance_ratings
ALTER TABLE performance_ratings
ADD COLUMN IF NOT EXISTS scanned_doc_url VARCHAR(500);

COMMENT ON COLUMN performance_ratings.scanned_doc_url IS 'Supabase Storage URL for uploaded scanned IPCRF/OPCRF/DPCR/BPCR documents per cycle per employee/unit (PMM-005)';
