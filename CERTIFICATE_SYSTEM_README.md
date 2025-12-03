# Certificate Management System

## Overview

The certificate management system allows you to create, customize, generate, and verify training certificates for different course types. The system is fully integrated with the course booking workflow.

## Features Implemented

### 1. Database Structure
- **course_types**: Different types of courses (Forklift, First Aid, MHFA, CPC, Manual Handling)
- **certificate_templates**: Customizable certificate templates with configurable fields
- **certificates**: Issued certificates with unique numbers
- **certificate_verification_log**: Public verification tracking

### 2. Certificate Template Builder (`/certificate-templates`)
- Create custom certificate templates for each course type
- Upload background images (your own certificate designs)
- Add and position fields on certificates:
  - Candidate name
  - Certificate number
  - Course dates
  - Trainer name
  - Custom fields as needed
- Configure field properties:
  - Position (X, Y coordinates)
  - Size (width, height)
  - Font size and family
  - Color
  - Text alignment (left, center, right)
  - Bold and italic styling
- Visual preview of template with field overlays

### 3. Course Type Integration
- Each booking can now have a course type assigned
- Bookings dropdown in the booking modal shows available course types
- Candidates in bookings have a "passed" checkbox
- Only passed candidates can receive certificates

### 4. Certificate Generation (Coming Soon)
- Certificates will be automatically generated for passed candidates
- Unique certificate numbers generated per course type (e.g., FLT-2025-00001)
- Expiry dates calculated based on course type validity period
- PDFs stored in Supabase storage

### 5. Certificate Management (`/certificates`)
- View all issued certificates
- Filter by:
  - Course type
  - Status (issued, expired, revoked)
  - Date range
  - Search by candidate name or certificate number
- Grouped display by course type
- Download certificate PDFs
- Send certificates via email (coming soon)
- Certificate status badges (issued, expired, revoked)

### 6. Certificate Verification (Public)
- Public page for certificate verification
- No login required
- Enter certificate number to verify
- Shows certificate details for valid certificates
- Indicates revoked or expired certificates
- Logs all verification attempts

## Workflow

### Setting Up Certificate Templates

1. Navigate to "Certificate Templates" from portal home
2. Select a course type
3. Click "Create Template"
4. Upload your certificate background image
5. Add and configure fields:
   - Use default fields (candidate name, cert number, dates, trainer)
   - Add custom fields as needed
   - Position fields by adjusting X/Y coordinates
   - Style fields with fonts, colors, alignment
6. Preview the template
7. Save the template

### Creating Courses and Issuing Certificates

1. Create a booking in "Course Booking & Schedule"
2. Select the course type from the dropdown
3. Add candidates to the booking
4. After the course is complete:
   - Open the booking
   - Check the "passed" checkbox (✓) for candidates who passed
   - Save the booking
5. Certificates are now ready to be generated (manual generation for now, will be automatic)

### Verifying Certificates

1. Anyone can visit the verification page (no login needed)
2. Enter the certificate number (e.g., FLT-2025-00001)
3. Click "Verify"
4. System shows:
   - Valid certificates with full details
   - Expired certificates with expiry date
   - Revoked certificates with reason
   - Invalid message for non-existent certificates

## Database Tables

### course_types
Pre-populated with 5 course types:
- Forklift Training (FLT) - 36 months validity
- First Aid (FA) - 36 months validity
- Mental Health First Aid (MHFA) - 36 months validity
- CPC Driver Training (CPC) - 60 months validity
- Manual Handling (MH) - 36 months validity

### certificate_templates
- Links to course_types
- Stores background image URL
- Contains fields_config (JSON array of field definitions)
- Page dimensions for PDF generation

### certificates
- Unique certificate_number (format: CODE-YEAR-NNNNN)
- Links to booking, candidate, course_type, trainer
- Stores PDF URL
- Tracks issue_date, expiry_date
- Status: issued, revoked, expired
- sent_at timestamp for email tracking

### bookings (enhanced)
- Added course_type_id field
- Links booking to specific course type for certificate generation

### booking_candidates (enhanced)
- Added passed boolean field
- Only passed candidates can receive certificates

## Next Steps (To Be Implemented)

### Certificate Generation
- Implement PDF generation using canvas or PDF library
- Merge template background with field data
- Generate unique certificate numbers automatically
- Store generated PDFs in Supabase storage
- Add "Generate Certificates" button in booking modal for passed candidates

### Email System
- Create course-specific email templates
- Add certificate attachment to emails
- Implement "Send Certificate" functionality
- Bulk send for multiple candidates
- Track email delivery status

### Certificate Revocation
- Add revocation UI in certificate management
- Require reason for revocation
- Update certificate status
- Log revocation date and reason

### Advanced Features
- QR code on certificates linking to verification page
- Certificate reissue for lost certificates
- Bulk certificate generation for multiple bookings
- Certificate expiry notifications
- Certificate statistics and reporting
- Export certificates list to CSV/Excel

## File Structure

```
src/
├── lib/
│   └── certificates.ts          # Certificate data functions
├── pages/
│   ├── CertificateTemplates.tsx # Template builder interface
│   ├── Certificates.tsx         # Certificate management
│   └── CertificateVerification.tsx # Public verification page
├── components/
│   └── BookingModal.tsx         # Enhanced with course type and passed checkbox
└── App.tsx                      # Navigation with certificate pages

supabase/
└── migrations/
    └── *_create_certificate_system.sql # Database schema
```

## Important Notes

1. **Background Images**: Upload your own certificate design images. The system positions text fields on top of these backgrounds.

2. **Field Positioning**: Use X/Y coordinates to position fields. The preview shows exactly where fields will appear.

3. **Certificate Numbers**: Automatically generated in format: `COURSECODE-YEAR-#####` (e.g., FLT-2025-00001)

4. **Validity Periods**: Configured per course type. System automatically calculates expiry dates.

5. **Public Verification**: The verification page is accessible without login for employers and regulatory bodies to verify certificates.

6. **Data Security**: All RLS policies properly configured. Public can only read non-revoked certificates for verification.

## Support

For questions or issues with the certificate system, refer to:
- Database migration: `supabase/migrations/*_create_certificate_system.sql`
- Type definitions: `src/lib/certificates.ts`
- UI components: `src/pages/Certificate*.tsx`
