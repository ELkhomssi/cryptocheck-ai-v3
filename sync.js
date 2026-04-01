const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const vars = {};
env.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0 && !l.startsWith('#')) {
    vars[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  }
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(vars['NEXT_PUBLIC_SUPABASE_URL'], vars['SUPABASE_SERVICE_ROLE_KEY']);

supabase.auth.admin.listUsers().then(({ data, error }) => {
  if (error) { console.error('ERROR:', error.message); return; }
  console.log('Found', data.users.length, 'users');
  
  Promise.all(data.users.map(u =>
    supabase.from('profiles').upsert({
      id: u.id,
      email: u.email,
      confirmed_at: u.confirmed_at || null,
      trial_started_at: u.created_at,
      referral_source: 'direct',
      is_pro: false,
      plan: 'free'
    }, { onConflict: 'id' }).then(({ error: e }) => {
      if (e) console.error('ERR', u.email, e.message);
      else console.log('OK', u.email);
    })
  )).then(() => {
    supabase.from('profiles').select('email, trial_started_at').then(({ data: p }) => {
      console.log('\nProfiles in DB:', p?.length);
      p?.forEach(x => console.log('-', x.email, x.trial_started_at));
    });
  });
});
