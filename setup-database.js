import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('Setting up database...\n');

  try {
    // Read the SQL file
    const sql = readFileSync(join(__dirname, 'database-setup.sql'), 'utf-8');

    console.log('Attempting to execute SQL setup...');
    console.log('Note: This requires direct SQL execution which may not be available via the anon key.\n');

    // Try to create a test trainer to verify the table exists or needs creation
    const { data: testCheck, error: checkError } = await supabase
      .from('trainers')
      .select('count')
      .limit(1);

    if (checkError) {
      if (checkError.message.includes('relation') || checkError.message.includes('does not exist')) {
        console.error('❌ The trainers table does not exist yet.');
        console.error('\nPlease run the following SQL in your Supabase SQL Editor:');
        console.error('(Dashboard → SQL Editor → New Query)\n');
        console.error('---SQL START---');
        console.log(sql);
        console.error('---SQL END---\n');
        process.exit(1);
      } else {
        console.error('Error checking database:', checkError.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Database table already exists and is accessible!');
      console.log('\nYou can now use the trainer map feature.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nTo set up the database manually:');
    console.error('1. Open your Supabase dashboard');
    console.error('2. Go to SQL Editor');
    console.error('3. Run the contents of database-setup.sql');
    process.exit(1);
  }
}

setupDatabase();
