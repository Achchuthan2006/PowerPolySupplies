import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only create the client when both values exist to avoid runtime errors.
export const supabase = (url && key) ? createClient(url, key) : null;
