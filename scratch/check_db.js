
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic env parsing for .env.local
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
);

async function test() {
  const { data, error } = await supabase.from('videourl').select('*').limit(5);
  if (error) {
    console.error('Error fetching videourl:', error);
  } else {
    console.log('Sample data from videourl:', JSON.stringify(data, null, 2));
  }
}

test();
