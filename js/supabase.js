// =========================================================
// MABIJUFIT — CONEXÃO SUPABASE
// =========================================================

const SUPABASE_URL =
    "https://mzpvdtoofxepnmuwlxxh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_RZkLXmshXJ081eDOJfthnA_EIjRv5fR";


const supabaseClient =
    window.supabase?.createClient ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    ) : null;
