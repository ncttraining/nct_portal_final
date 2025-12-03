# Database Setup Instructions

The NCT Internal Portal uses Supabase for data storage. Follow these steps to set up the database:

## Step 1: Access Supabase Dashboard

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**

## Step 2: Execute the Setup SQL

Copy and paste the entire contents of `database-setup.sql` into the SQL Editor and click **Run**.

This will:
- Create the `trainers` table with all required fields
- Enable Row Level Security (RLS)
- Create policies for authenticated users
- Add indexes for better performance

## Step 3: Verify the Setup

After running the SQL, verify the setup by:

1. Go to **Table Editor** in your Supabase dashboard
2. You should see a new table called `trainers`
3. Check the **Authentication** → **Policies** section to ensure RLS policies are active

## Step 4: Test the Application

1. Start your development server: `npm run dev`
2. Navigate to the Trainer Map from the portal home
3. Try adding a test trainer to verify everything works

## Database Schema

The `trainers` table includes:

- **Contact Information**: name, telephone, email, address fields, postcode
- **Professional Details**: day_rate, rtitb_number, rtitb_expiry
- **Insurance**: insurance_expiry, insurance_file_name, insurance_url
- **Location**: latitude, longitude (auto-geocoded from postcode)
- **Equipment**: truck_types (array of MHE equipment categories)
- **Metadata**: created_at, updated_at timestamps

## Troubleshooting

### Issue: "relation 'trainers' does not exist"
- Make sure you ran the SQL in `database-setup.sql`
- Verify you're connected to the correct Supabase project

### Issue: "permission denied for table trainers"
- Check that RLS policies were created
- Verify you're authenticated (may need to add auth to the app)

### Issue: Can't see trainers on the map
- Make sure the postcode geocoding is working
- Check browser console for any errors
- Verify your Supabase URL and keys in `.env` are correct

## Security Notes

- Row Level Security (RLS) is enabled by default
- Current policies allow all authenticated users to read/write trainers
- For production, you may want to restrict write access to admin users only
- Never commit your `.env` file to version control
