
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function test() {
  const { data, error } = await supabase.from('videourl').select('*').limit(5)
  if (error) {
    console.error('Error fetching videourl:', error)
  } else {
    console.log('Sample data from videourl:', JSON.stringify(data, null, 2))
  }
}

test()
