// supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ywiynndaowlifbqcsacc.supabase.co";    // Ex: https://ywiynndaowlifbqcsacc.supabase.co
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aXlubmRhb3dsaWZicWNzYWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4NzgyNzAsImV4cCI6MjA1NzQ1NDI3MH0.7xH0Dpq_XYPFDJ2OmPFO-It3C5BIV_vWVLiNu7p1BFA";                // A "anon key" do seu projeto no painel do Supabase

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
