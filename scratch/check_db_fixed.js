
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mwvzlaoracpnhbxbznze.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13dnpsYW9yYWNwbmhieGJ6bnplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzM2MTUsImV4cCI6MjA3NzI0OTYxNX0.9G1J0gQpw7wXqgZNqkMcVjUZcPOkbFAwNy1kZuSH-GQ'
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
