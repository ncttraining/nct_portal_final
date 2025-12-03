# Deployment Guide

## Prerequisites
- Server with PHP 7.4+ and Node.js 18+
- Composer installed
- Git installed
- Web server (Apache/Nginx) configured

## Initial Deployment Steps

### 1. On Your Local Machine

```bash
# Create a GitHub/GitLab repository and add remote
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

### 2. On Your Server

```bash
# Navigate to your web root
cd /var/www/html  # or your web root path

# Clone the repository
git clone <your-repo-url> .

# Install PHP dependencies
composer require phpmailer/phpmailer

# Install Node dependencies
npm install

# Build the frontend
npm run build
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your production values
nano .env
```

Add your Supabase credentials:
```
VITE_SUPABASE_URL=https://ihamryqtzkepskhryslm.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_EMAIL_API_URL=https://nctapp.nationalcompliancetraining.co.uk/api/send-email.php
```

### 4. Web Server Configuration

#### For Apache (with mod_rewrite)

Create/update `.htaccess` in your web root:

```apache
# Serve frontend from dist/
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # API requests go to api/ folder
  RewriteRule ^api/ - [L]

  # Frontend - serve from dist/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /dist/index.html [L]
</IfModule>

# Protect sensitive files
<FilesMatch "^\.env">
  Order allow,deny
  Deny from all
</FilesMatch>
```

#### For Nginx

```nginx
server {
    listen 80;
    server_name nctapp.nationalcompliancetraining.co.uk;
    root /var/www/html/dist;

    index index.html;

    # API requests
    location /api/ {
        try_files $uri $uri/ /api/$uri.php?$query_string;
    }

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Protect sensitive files
    location ~ /\.env {
        deny all;
    }
}
```

### 5. Set Permissions

```bash
# Set proper permissions
chmod 755 api/
chmod 644 api/*.php
chmod 644 .env
chown -R www-data:www-data .  # or your web server user
```

### 6. Verify Installation

Test the email API:
```bash
curl -X POST https://nctapp.nationalcompliancetraining.co.uk/api/send-email.php \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","htmlBody":"<p>Test</p>"}'
```

## Future Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild frontend
npm run build

# Restart web server if needed
sudo systemctl restart apache2  # or nginx
```

## Security Notes

1. **Never commit `.env`** - It contains sensitive credentials
2. **Use HTTPS** - Ensure SSL certificate is installed
3. **Update `.htaccess`/nginx config** - Protect sensitive files
4. **Regular backups** - Back up your database regularly
5. **Keep dependencies updated** - Run `composer update` and `npm update` periodically

## Troubleshooting

### Email not sending
- Check PHP error logs: `tail -f /var/log/apache2/error.log`
- Verify SMTP credentials in `api/config.php`
- Test SMTP connection from server

### Frontend not loading
- Check that `dist/` folder exists
- Verify web server is serving from correct directory
- Check browser console for errors

### API not accessible
- Verify `api/` folder permissions
- Check web server configuration
- Ensure PHP is installed and enabled
