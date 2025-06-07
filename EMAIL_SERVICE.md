# Email Service Documentation

The Performance Tracking System includes a robust email service built with Nodemailer that supports templating, various transport methods, and production-ready features.

## Features

- **Transport Options**: SMTP for production, JSON for testing
- **HTML Templates**: Handlebars template support with layouts and partials
- **Retry Mechanism**: Exponential backoff for failed email delivery
- **Queueing**: Email queueing when service is unavailable
- **Environment Awareness**: Different configurations for development, testing, and production
- **Specialized Email Types**: System alerts and performance reports
- **Template Management**: Central repository for email templates
- **Graceful Shutdown**: Proper cleanup on application termination

## Setup Instructions

### 1. Environment Variables

Add the following variables to your `.env` file:

```env
# Email Configuration
EMAIL_ENABLED=true                      # Enable/disable email service (true/false)
EMAIL_HOST=smtp.example.com             # SMTP server hostname (e.g., smtp.titan.email)
EMAIL_PORT=587                          # SMTP server port (587 for TLS, 465 for SSL)
EMAIL_USER=your-email@example.com       # SMTP username
EMAIL_PASSWORD=your-password            # SMTP password
EMAIL_FROM=Your Name                    # Sender name (will be formatted with your email automatically)
EMAIL_TLS_REJECT_UNAUTHORIZED=true      # Reject unauthorized TLS certificates (set to false for self-signed certs)

# Alert Recipients
EMAIL_ALERTS_ENABLED=true               # Enable/disable email alerts (true/false)
EMAIL_ALERT_RECIPIENTS=admin@example.com,ops@example.com
EMAIL_ALERT_CRITICAL_RECIPIENTS=admin@example.com,manager@example.com,ops@example.com
```

### Special Configuration for Common Email Providers

#### Titan Email

```env
EMAIL_HOST=smtp.titan.email
EMAIL_PORT=465                  # Use port 465 with SSL
EMAIL_USER=your@domain.com      # Your full Titan email address
EMAIL_PASSWORD=your-password
EMAIL_FROM=Your Company Name    # Will be formatted as "Your Company Name <your@domain.com>"
```

#### Gmail

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=your-app-password  # Use App Password, not your Gmail password
EMAIL_FROM=Your Name
```

#### Office 365

```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your.email@outlook.com
EMAIL_PASSWORD=your-password
EMAIL_FROM=Your Name
```

### 2. Email Templates

Email templates are stored in `src/templates/emails/` and use Handlebars (.hbs) format:

- **Layouts**: `src/templates/emails/layouts/` - Contains main layout templates
- **Partials**: `src/templates/emails/partials/` - Contains reusable components
- **Templates**: `src/templates/emails/` - Contains individual email templates

### 3. Service Setup

The email service is automatically initialized on application start. It is accessible via:

```typescript
import emailService from '../services/emailService';
```

## Usage Examples

### Sending a Basic Email

```typescript
await emailService.sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello World',
  text: 'This is a plain text email'
});
```

### Sending a Template Email

```typescript
await emailService.sendEmail({
  to: 'recipient@example.com',
  subject: 'Welcome to Our Platform',
  template: 'welcome',
  templateData: {
    name: 'John Doe',
    activationLink: 'https://example.com/activate'
  }
});
```

### Sending with Attachments

```typescript
await emailService.sendEmail({
  to: 'recipient@example.com',
  subject: 'Your Report',
  template: 'report',
  templateData: { reportData },
  attachments: [
    {
      filename: 'report.pdf',
      path: '/path/to/report.pdf',
      contentType: 'application/pdf'
    }
  ]
});
```

### Sending System Alerts

```typescript
await emailService.sendSystemAlert(
  'Database Connection Issue',
  'The system has lost connection to the primary database for more than 5 minutes.',
  true // critical
);
```

### Sending Performance Reports

```typescript
await emailService.sendPerformanceReport(
  'admin@example.com',
  performanceData
);
```

## API Endpoints

The following API endpoints are available for sending emails:

- **POST /api/v1/email/alert**
  - Send a system alert email
  - Body: `{ "subject": "Alert Subject", "message": "Alert message", "critical": true }`

- **POST /api/v1/email/report**
  - Send a performance report email
  - Body: `{ "email": "recipient@example.com" }`

## Production Considerations

1. **Security**:
   - Store email credentials securely (environment variables, secrets manager)
   - Use TLS/SSL for SMTP connections
   - Avoid sending sensitive information in emails

2. **Performance**:
   - Consider using a dedicated email service like SendGrid or Mailgun for high volume
   - Enable queueing for better handling of spikes in email volume

3. **Reliability**:
   - Monitor email delivery and bounce rates
   - Implement proper error handling and retries

4. **Compliance**:
   - Ensure emails comply with regulations (GDPR, CAN-SPAM, etc.)
   - Include unsubscribe options in marketing emails

## Email Templates Included

1. **Alert Template**: For system alerts and notifications
2. **Performance Report**: For sending system performance reports

## Customizing Templates

To create a new email template:

1. Create a new `.hbs` file in `src/templates/emails/`
2. Design your template using Handlebars syntax
3. Use existing partials or create new ones as needed
4. Reference the main layout or create a custom one

## Troubleshooting

### Common Issues

1. **Connection Refused**:
   - Check if the SMTP server is running and accessible
   - Verify that firewall rules allow outbound connections to the email server

2. **Authentication Failed**:
   - Check username and password
   - Ensure account has permissions to send emails

3. **Template Not Found**:
   - Check the template path and name
   - Ensure the template file exists and has .hbs extension

4. **TLS Certificate Errors**:
   - For self-signed certificates, set `EMAIL_TLS_REJECT_UNAUTHORIZED=false`
   - For production, ensure certificates are valid

## Logging

Email operations are logged using the application's logger. Look for log entries with:
- `[INFO]` for successful operations
- `[ERROR]` for failed operations
- `[WARN]` for potential issues 