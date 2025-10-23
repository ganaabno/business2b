// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://emccstdutlnvklhksbwz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY2NzdGR1dGxudmtsaGtzYnd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTMyNjAsImV4cCI6MjA3MDU2OTI2MH0.vbyytUJVi7tR18_2f6ltZ3HiLuMMVV7yLQUNS1LtLFM'; // use anon key for frontend testing

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
