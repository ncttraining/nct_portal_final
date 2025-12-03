<?php

require_once __DIR__ . '/config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON in request body']);
    exit;
}

$to = $data['to'] ?? null;
$templateKey = $data['templateKey'] ?? null;
$templateData = $data['templateData'] ?? [];
$subject = $data['subject'] ?? '';
$htmlBody = $data['htmlBody'] ?? '';
$textBody = $data['textBody'] ?? '';
$attachments = $data['attachments'] ?? [];

if (!$to) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Recipient email is required']);
    exit;
}

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
    exit;
}

try {
    if ($templateKey) {
        $template = fetchTemplate($templateKey);

        if (!$template) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Template not found: $templateKey"]);
            exit;
        }

        $subject = renderTemplate($template['subject_template'], $templateData);
        $htmlBody = renderTemplate($template['body_html'], $templateData);
        $textBody = $template['body_text']
            ? renderTemplate($template['body_text'], $templateData)
            : strip_tags($htmlBody);
    }

    if (!$subject || !$htmlBody) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Subject and body are required']);
        exit;
    }

    $result = sendEmail($to, $subject, $htmlBody, $textBody, $attachments);

    if ($result['success']) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Email sent successfully']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $result['error']]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

function fetchTemplate($templateKey) {
    $url = SUPABASE_URL . '/rest/v1/email_templates?template_key=eq.' . urlencode($templateKey) . '&select=*';

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . SUPABASE_ANON_KEY,
        'Authorization: Bearer ' . SUPABASE_ANON_KEY,
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return null;
    }

    $templates = json_decode($response, true);
    return !empty($templates) ? $templates[0] : null;
}

function renderTemplate($template, $data) {
    $result = $template;
    foreach ($data as $key => $value) {
        $placeholder = '{{' . $key . '}}';
        $result = str_replace($placeholder, $value ?? '', $result);
    }
    return $result;
}

function sendEmail($to, $subject, $htmlBody, $textBody, $attachments = []) {
    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        require_once __DIR__ . '/../vendor/autoload.php';
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USERNAME;
        $mail->Password   = SMTP_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;

        $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addAddress($to);

        $mail->CharSet = 'UTF-8';
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = $textBody;

        // Handle attachments
        foreach ($attachments as $attachment) {
            if (isset($attachment['url']) && isset($attachment['filename'])) {
                // Fetch the file from URL
                $fileContent = file_get_contents($attachment['url']);
                if ($fileContent !== false) {
                    $mail->addStringAttachment($fileContent, $attachment['filename']);
                }
            }
        }

        $mail->send();
        return ['success' => true];

    } catch (Exception $e) {
        return ['success' => false, 'error' => 'Failed to send email: ' . $e->getMessage()];
    }
}
