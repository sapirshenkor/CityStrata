-- Ensure selected_matching_result_id exists (nullable)
ALTER TABLE public.evacuee_family_profiles
ADD COLUMN IF NOT EXISTS selected_matching_result_id UUID NULL;

-- Add FK constraint only if it doesn't exist (simpler approach: add anyway)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evacuee_family_profiles_selected_matching_result_id_fkey'
  ) THEN
    ALTER TABLE public.evacuee_family_profiles
    ADD CONSTRAINT evacuee_family_profiles_selected_matching_result_id_fkey
    FOREIGN KEY (selected_matching_result_id)
    REFERENCES public.matching_results (id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evacuee_family_profiles_selected_matching_result_id
ON public.evacuee_family_profiles (selected_matching_result_id);

-- Ensure updated_at exists (required by Pydantic model)
ALTER TABLE public.evacuee_family_profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger to keep updated_at fresh on UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_evacuee_family_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_evacuee_family_profiles_updated_at
    BEFORE UPDATE ON public.evacuee_family_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;