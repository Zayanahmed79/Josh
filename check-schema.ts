import { supabase } from './lib/supabase';

async function checkSchema() {
    const { data, error } = await supabase.from('videourl').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found, trying to get columns via RPC or other means...');
        // If no data, we might not be able to get keys this way easily.
    }
}

checkSchema();
