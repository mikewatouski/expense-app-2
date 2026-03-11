<!-- supabase -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  // reemplazá estas constantes con las tuyas
  const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGci…';

  window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>

<script src="app.js"></script>