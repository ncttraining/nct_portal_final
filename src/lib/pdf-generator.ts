import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { getCertificateTemplate } from './certificates';
import type { CertificateField } from './certificates';

const TEMPLATE_WIDTH = 2480;
const TEMPLATE_HEIGHT = 3508;

export async function generateCertificatePDF(
  certificateId: string,
  certificateData: {
    certificate_number: string;
    candidate_name: string;
    trainer_name: string;
    course_name?: string;
    course_date_start: string;
    course_date_end: string;
    issue_date: string;
    expiry_date: string | null;
    course_specific_data: Record<string, any>;
  },
  templateId: string
): Promise<string> {
  const template = await getCertificateTemplate(templateId);

  if (!template) {
    throw new Error('Certificate template not found');
  }

  const pdfDoc = await PDFDocument.create();

  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const scaleX = pageWidth / TEMPLATE_WIDTH;
  const scaleY = pageHeight / TEMPLATE_HEIGHT;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  if (template.background_image_url) {
    try {
      const imageResponse = await fetch(template.background_image_url);
      const imageBytes = await imageResponse.arrayBuffer();

      let backgroundImage;
      const contentType = imageResponse.headers.get('content-type');

      if (contentType?.includes('png')) {
        backgroundImage = await pdfDoc.embedPng(imageBytes);
      } else if (contentType?.includes('jpg') || contentType?.includes('jpeg')) {
        backgroundImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        throw new Error('Unsupported image format');
      }

      page.drawImage(backgroundImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    } catch (error) {
      console.error('Error loading background image:', error);
    }
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const courseDateRange = `${formatDate(certificateData.course_date_start)} - ${formatDate(certificateData.course_date_end)}`;

  const fieldValueMap: Record<string, string> = {
    certificate_number: certificateData.certificate_number,
    candidate_name: certificateData.candidate_name,
    trainer_name: certificateData.trainer_name,
    course_name: certificateData.course_name || '',
    course_date_start: formatDate(certificateData.course_date_start),
    course_date_end: formatDate(certificateData.course_date_end),
    course_date: courseDateRange,
    issue_date: formatDate(certificateData.issue_date),
    expiry_date: certificateData.expiry_date ? formatDate(certificateData.expiry_date) : 'N/A',
    ...certificateData.course_specific_data,
  };

  console.log('Certificate data:', certificateData);
  console.log('Field value map:', fieldValueMap);
  console.log('Template fields:', template.fields_config);

  for (const field of template.fields_config) {
    const value = fieldValueMap[field.name] || '';

    console.log(`Field ${field.name}: value="${value}"`);

    if (!value) continue;

    const selectedFont = field.bold ? fontBold : (field.italic ? fontItalic : font);

    const hexColor = field.color.replace('#', '');
    const r = parseInt(hexColor.substring(0, 2), 16) / 255;
    const g = parseInt(hexColor.substring(2, 4), 16) / 255;
    const b = parseInt(hexColor.substring(4, 6), 16) / 255;

    const scaledFontSize = field.fontSize * scaleY;
    const textWidth = selectedFont.widthOfTextAtSize(value, scaledFontSize);
    const scaledFieldWidth = field.width * scaleX;

    // Calculate x position based on alignment within the field's width
    let xPosition = field.x * scaleX;
    if (field.align === 'center') {
      // Center text within the field width
      xPosition = (field.x * scaleX) + (scaledFieldWidth / 2) - (textWidth / 2);
    } else if (field.align === 'right') {
      // Right-align text within the field width
      xPosition = (field.x * scaleX) + scaledFieldWidth - textWidth;
    }
    // For 'left' alignment, xPosition stays at field.x * scaleX

    const yPosition = pageHeight - (field.y * scaleY) - scaledFontSize;

    page.drawText(value, {
      x: xPosition,
      y: yPosition,
      size: scaledFontSize,
      font: selectedFont,
      color: rgb(r, g, b),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

  const fileName = `${certificateData.certificate_number}.pdf`;
  const filePath = `certificates/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error('Error uploading PDF:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('certificates')
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from('certificates')
    .update({ certificate_pdf_url: publicUrl })
    .eq('id', certificateId);

  if (updateError) {
    console.error('Error updating certificate with PDF URL:', updateError);
    throw updateError;
  }

  return publicUrl;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
