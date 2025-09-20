// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Replace process.env with actual values for local dev
const supabaseUrl = "https://emccstdutlnvklhksbwz.supabase.co";
const supabaseAnonKey = "vbyytUJVi7tR18_2f6ltZ3HiLuMMVV7yLQUNS1LtLFM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
