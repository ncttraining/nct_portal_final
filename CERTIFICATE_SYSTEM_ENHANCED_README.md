# Enhanced Certificate Management System

## Overview

The enhanced certificate management system provides a complete course-based certificate issuance workflow. Issue certificates directly from completed courses, capture course-specific details, and manage certificate validity periods flexibly.

## Major Enhancements Implemented

### 1. Course-Based Certificate Issuance

**New Page: View / Issue Certificates**

The certificate page now has two main sections:

#### Issue Certificates Tab
- Displays all courses with passed candidates who don't yet have certificates
- Shows each course as a card with:
  - Course type, title, and dates
  - Trainer and client information
  - List of all passed candidates
  - Number of certificates pending vs issued
  - "Issue Certificates" button for easy access

#### View Issued Certificates Tab
- View all previously issued certificates
- Organized by course type
- Advanced filtering options

### 2. Course-Specific Field Collection

**Dynamic Fields Per Course Type**

Each course type can now have required fields that must be filled when issuing certificates:

**Forklift Training (FLT):**
- Equipment Types Trained (text)
- License Category (dropdown: B1-B7)

**First Aid (FA):**
- Qualification Level (dropdown)
- Assessment Result (dropdown)

**Mental Health First Aid (MHFA):**
- Specialization Area (dropdown)

**CPC Driver Training (CPC):**
- Module Numbers Completed (text)
- Hours Completed (number)

**Manual Handling (MH):**
- Equipment Categories Covered (text)

These fields are:
- Defined in the database per course type
- Automatically displayed in the issuance modal
- Validated before certificate generation
- Stored with each certificate
- Visible in certificate details

### 3. Certificate Issuance Modal

**Streamlined Workflow:**

1. Click "Issue Certificates" on a course
2. Modal opens showing all passed candidates
3. Select which candidates to issue certificates for
4. Fill in required course-specific fields
5. System shows calculated expiry dates
6. Issue all selected certificates at once
7. Progress indicator shows issuance status

**Features:**
- Bulk selection with "Select All" / "Deselect All"
- Individual field entry per candidate
- Validation of required fields
- Real-time progress tracking
- Error handling and reporting

### 4. Flexible Certificate Validity Periods

**Validity Configuration:**
- Each course type has configurable validity period (in months)
- Can be set to "No expiry" (null value)
- Current validity periods:
  - Forklift: 36 months (3 years)
  - First Aid: 36 months (3 years)
  - Mental Health First Aid: 36 months (3 years)
  - CPC: 60 months (5 years)
  - Manual Handling: 36 months (3 years)

**Automatic Expiry Calculation:**
- Issue date + validity months = expiry date
- Calculated automatically during issuance
- Displayed before issuing for verification

### 5. Expiry Status Indicators

**Visual Status Badges:**

- **Valid (Green)**: Certificate is valid with days remaining shown
- **Expiring Soon (Amber)**: Certificate expires within 3 months
- **Expired (Red)**: Certificate has passed expiry date
- **No Expiry (Grey)**: Certificate has no expiration

**Expiry Filtering:**
- Filter certificates by expiry status
- Find expiring certificates proactively
- Monitor certificate lifecycle

### 6. Enhanced Booking Integration

**Certificate Status in Booking Modal:**

After saving a booking, the modal now shows:
- Number of passed candidates
- Certificate readiness indicator
- Visual feedback with icons

Status indicators:
- "No passed candidates" (grey)
- "X candidates ready for certificates" (amber with award icon)

### 7. Bulk Certificate Operations

The issuance modal supports:
- Select multiple candidates at once
- Issue all selected certificates in one operation
- Progress bar showing issuance status
- Success/failure reporting
- Individual error messages if any fail

## Complete Workflow Example

### Setting Up a Course Type

1. Course types are pre-configured with validity periods
2. Each type has defined required fields
3. Fields can be customized in the database

### Running a Course and Issuing Certificates

**Step 1: Create Booking**
- Navigate to Course Booking & Schedule
- Create a new booking
- Select course type (e.g., "Forklift Training")
- Add candidates to the booking
- Save the booking

**Step 2: Mark Passed Candidates**
- After course completion, open the booking
- Check the green checkmark (✓) for candidates who passed
- Save the booking
- Status indicator shows "X candidates ready for certificates"

**Step 3: Issue Certificates**
- Navigate to View / Issue Certificates
- Switch to "Issue Certificates" tab
- Find your course in the list
- Click "Issue Certificates" button

**Step 4: Fill Course Details**
- Modal opens showing all passed candidates
- All candidates selected by default
- Fill in required course-specific fields:
  - For Forklift: Equipment types and License category
  - Fields can be filled individually or applied to all
- Review calculated expiry dates

**Step 5: Generate Certificates**
- Click "Issue X Certificates"
- Progress bar shows generation status
- Success message confirms completion

**Step 6: View and Manage**
- Switch to "View Issued Certificates" tab
- Find certificates by course type
- View certificate details including course-specific data
- Download PDFs (when PDF generation is implemented)
- Send via email (when email system is implemented)

### Verifying a Certificate

**Public Verification (No Login Required):**
1. Visit certificate verification page
2. Enter certificate number (e.g., FLT-2025-00001)
3. Click "Verify"
4. System shows:
   - Valid certificates with full details
   - Expiry status
   - Course-specific information
   - Revocation status if applicable

## Database Schema Enhancements

### course_types Table (Enhanced)
```sql
- required_fields (jsonb): Array of field definitions
- certificate_field_mappings (jsonb): Maps fields to template
- certificate_validity_months (integer): Validity period in months
```

### certificates Table (Enhanced)
```sql
- course_specific_data (jsonb): Stores course field values
- expiry_date (date): Calculated from issue_date + validity
- All existing fields...
```

## Filtering and Search Capabilities

### Issue Certificates Tab
- Filter by course type
- Filter by date range
- See only courses with pending certificates

### View Certificates Tab
- Filter by course type
- Filter by certificate status (issued/expired/revoked)
- Filter by expiry status (valid/expiring soon/expired)
- Filter by date range
- Search by candidate name or certificate number

## Key Features Summary

✅ **Course-based issuance** - Issue certificates from courses, not individual searches
✅ **Course-specific fields** - Capture required information per course type
✅ **Flexible validity** - Different validity periods per course type
✅ **Expiry tracking** - Visual indicators and filtering for expiring certificates
✅ **Bulk operations** - Issue multiple certificates at once
✅ **Progress tracking** - Real-time progress during bulk operations
✅ **Status indicators** - Clear visual feedback throughout the system
✅ **Data validation** - Required fields enforced before issuance
✅ **Audit trail** - All certificate data stored with course details

## What's Still To Come

### PDF Generation
- Render certificates using template and data
- Merge background images with positioned fields
- Generate downloadable PDFs
- Store in Supabase storage

### Email System
- Course-specific email templates
- Automatic certificate attachment
- Bulk email sending
- Delivery tracking

### Advanced Features
- QR codes on certificates
- Certificate reissue functionality
- Expiry reminder notifications
- Certificate analytics and reporting
- Export to CSV/Excel

## Technical Implementation

### File Structure
```
src/
├── lib/
│   └── certificates.ts               # Enhanced with new functions
├── pages/
│   ├── CertificateTemplates.tsx      # Template builder
│   ├── ViewIssueCertificates.tsx     # New course-based issuance
│   └── CertificateVerification.tsx   # Public verification
├── components/
│   ├── BookingModal.tsx              # Enhanced with status
│   └── CertificateIssuanceModal.tsx  # New issuance modal
└── App.tsx                            # Updated navigation

supabase/migrations/
├── *_create_certificate_system.sql
└── *_enhance_certificate_system_course_fields.sql
```

### Key Functions
- `getBookingsWithPendingCertificates()` - Fetch courses needing certificates
- `issueCertificate()` - Generate certificate with validation
- `calculateExpiryDate()` - Compute expiry from validity period
- `getExpiryStatus()` - Determine validity status
- `getDaysUntilExpiry()` - Calculate remaining validity

## Configuration

### Adding New Course Types

To add a new course type with custom fields:

```sql
INSERT INTO course_types (
  name,
  code,
  description,
  duration_days,
  certificate_validity_months,
  required_fields
) VALUES (
  'New Course',
  'NC',
  'Description',
  1,
  36,
  '[
    {
      "name": "field_name",
      "label": "Field Label",
      "type": "text",
      "required": true,
      "placeholder": "Hint text"
    }
  ]'::jsonb
);
```

### Modifying Validity Periods

```sql
UPDATE course_types
SET certificate_validity_months = 48
WHERE code = 'FLT';
```

### Adding Fields to Existing Course Type

```sql
UPDATE course_types
SET required_fields = required_fields || '[
  {
    "name": "new_field",
    "label": "New Field",
    "type": "dropdown",
    "required": false,
    "options": ["Option 1", "Option 2"]
  }
]'::jsonb
WHERE code = 'FLT';
```

## User Benefits

1. **Faster Workflow**: Issue certificates directly from course view
2. **Data Integrity**: Required fields ensure complete information
3. **Flexibility**: Different validity periods per course type
4. **Visibility**: Clear status indicators throughout the system
5. **Bulk Processing**: Handle multiple candidates efficiently
6. **Audit Compliance**: Complete data trail for each certificate
7. **Easy Verification**: Public verification without login

## Support and Maintenance

For issues or questions:
- Check database migrations for schema details
- Review `src/lib/certificates.ts` for business logic
- Examine component files for UI implementation
- Test with sample data before production use

The system is production-ready for certificate issuance, tracking, and verification. PDF generation and email functionality are the remaining pieces to complete the full workflow.
