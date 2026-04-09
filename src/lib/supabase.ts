import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qaikndonceuyajqielfq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhaWtuZG9uY2V1eWFqcWllbGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzYxMjksImV4cCI6MjA5MTMxMjEyOX0.PO_RM4CWZAj-m5ZS0sEuujMTB2gzbbKIE1j_OIG0Wqs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
