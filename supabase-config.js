// Kunci publishable aman di frontend; keamanan data dijaga oleh RLS.
const SUPABASE_URL = "https://zdytadeichqhgxbjpsws.supabase.co";
const SUPABASE_KEY = "sb_publishable_2ZE95yvkgPjROBz8F2dHBQ_WDS0B1Fl";

// Jangan beri nama variabel "supabase": nama itu sudah dipakai library
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);