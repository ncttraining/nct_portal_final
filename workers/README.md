# Email Queue Worker

This directory contains the background email worker that processes emails from the queue.

## Setup

### 1. Install Dependencies

```bash
cd workers
npm install
```

### 2. Configure Environment

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=Your Company Name

# Worker Configuration (optional)
POLL_INTERVAL_MS=10000
BATCH_SIZE=10
MAX_CONCURRENT=3
LOG_LEVEL=info
```

### 3. Test the Worker

Run the worker in development mode to test:

```bash
npm start
```

You should see log output like:

```json
{"timestamp":"2024-12-01T12:00:00.000Z","level":"info","message":"Email worker starting","pollInterval":10000,"batchSize":10,"maxConcurrent":3}
{"timestamp":"2024-12-01T12:00:00.100Z","level":"info","message":"SMTP connection verified"}
```

### 4. Test Sending an Email

You can test the queue by inserting a test email directly into the database or by using the application to trigger an email.

## Production Deployment

### Option 1: PM2 (Recommended)

PM2 is a production process manager for Node.js applications.

#### Install PM2 globally:

```bash
npm install -g pm2
```

#### Start the worker:

```bash
cd workers
pm2 start ecosystem.config.cjs
```

#### Check status:

```bash
pm2 status
pm2 logs email-worker
```

#### Save PM2 configuration:

```bash
pm2 save
```

#### Auto-start on system boot:

```bash
pm2 startup
# Follow the instructions provided by the command
```

#### Useful PM2 commands:

```bash
pm2 restart email-worker    # Restart worker
pm2 stop email-worker       # Stop worker
pm2 delete email-worker     # Remove worker from PM2
pm2 logs email-worker       # View logs
pm2 monit                   # Monitor all processes
```

### Option 2: systemd Service

Create a systemd service file at `/etc/systemd/system/email-worker.service`:

```ini
[Unit]
Description=Email Queue Worker
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/project/workers
ExecStart=/usr/bin/node email-worker.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/email-worker/output.log
StandardError=append:/var/log/email-worker/error.log

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable email-worker
sudo systemctl start email-worker
sudo systemctl status email-worker
```

View logs:

```bash
sudo journalctl -u email-worker -f
```

### Option 3: Docker

Create a `Dockerfile` in the workers directory:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "email-worker.js"]
```

Build and run:

```bash
docker build -t email-worker .
docker run -d --name email-worker --env-file .env --restart always email-worker
```

## Monitoring

### Health Check

The worker logs a heartbeat every 60 seconds:

```json
{"timestamp":"2024-12-01T12:01:00.000Z","level":"debug","message":"Worker heartbeat"}
```

If you don't see heartbeats, the worker may have crashed.

### Check Queue Status

You can check the email queue status in the admin panel:

1. Log in as an admin user
2. Navigate to Administration > Email Queue
3. View statistics and email status

### Worker Status

To check if the worker is processing emails, look for processing logs:

```json
{"timestamp":"2024-12-01T12:02:00.000Z","level":"info","message":"Processing email batch","count":5}
{"timestamp":"2024-12-01T12:02:05.000Z","level":"info","message":"Batch processed","total":5,"success":5,"failed":0}
```

### Failed Emails

Failed emails will show in the queue with status `failed`. Check the error message in the Email Queue admin page or in the logs:

```json
{"timestamp":"2024-12-01T12:02:00.000Z","level":"error","message":"Failed to send email","emailId":"...","recipient":"...","error":"..."}
```

## Troubleshooting

### Worker won't start

1. Check that all environment variables are set correctly in `.env`
2. Verify SMTP credentials are correct
3. Test SMTP connection manually
4. Check logs for specific error messages

### Emails stuck in processing

If emails are stuck in `processing` status:

1. The worker may have crashed mid-processing
2. Update stuck emails manually:

```sql
UPDATE email_queue
SET status = 'pending', processing_started_at = NULL
WHERE status = 'processing' AND processing_started_at < NOW() - INTERVAL '5 minutes';
```

### High failure rate

1. Check SMTP server status
2. Verify SMTP credentials haven't expired
3. Check for rate limiting from SMTP provider
4. Review error messages in failed emails

### Worker consuming too much memory

1. Reduce `BATCH_SIZE` in `.env`
2. Reduce `MAX_CONCURRENT` in `.env`
3. Check for memory leaks in logs
4. Restart worker: `pm2 restart email-worker`

## Performance Tuning

### Adjust Polling Interval

- Faster polling (lower `POLL_INTERVAL_MS`) = more responsive but higher CPU usage
- Slower polling (higher `POLL_INTERVAL_MS`) = less CPU usage but slower email delivery
- Recommended: 5000-15000 ms (5-15 seconds)

### Adjust Batch Size

- Larger `BATCH_SIZE` = process more emails per cycle
- Smaller `BATCH_SIZE` = less memory usage, more database queries
- Recommended: 10-50 emails

### Adjust Concurrency

- Higher `MAX_CONCURRENT` = faster processing but more SMTP connections
- Lower `MAX_CONCURRENT` = slower processing but less load on SMTP server
- Recommended: 3-10 concurrent connections

### SMTP Connection Pool

The worker uses connection pooling with these defaults:

- Pool size: 5 connections
- Max messages per connection: 100
- Connection timeout: 30 seconds
- Idle timeout: 60 seconds

These are configured in `email-worker.js` and can be adjusted if needed.

## Maintenance

### Log Rotation

If using systemd, logs are stored in `/var/log/email-worker/`. Set up log rotation:

Create `/etc/logrotate.d/email-worker`:

```
/var/log/email-worker/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### Database Cleanup

Old emails should be cleaned up periodically. Create a cron job:

```bash
# Clean up sent emails older than 90 days
0 2 * * * psql -c "DELETE FROM email_queue WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '90 days';"

# Clean up failed emails older than 30 days
0 3 * * * psql -c "DELETE FROM email_queue WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '30 days';"
```

## Support

For issues or questions, check:

1. Worker logs: `pm2 logs email-worker`
2. Email Queue admin page for failed emails
3. Database email_queue table for stuck emails
4. SMTP provider documentation for rate limits
