-- Migration: Fix api_keys.key_prefix column size
-- The prefix format "ag_live_xxxxxxxx..." requires more than 12 chars

ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE VARCHAR(30);
