import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';
import fs from 'fs';
import hbs from 'nodemailer-express-handlebars';
import logger from '../utils/logger';
import config from '../config/config';

/**
 * Email template data interface
 */
export interface EmailTemplateData {
  [key: string]: any;
}

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

/**
 * Email options interface
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  text?: string;
  html?: string;
  templateData?: EmailTemplateData;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
}

/**
 * Service for sending emails
 */
class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;
  private queue: EmailOptions[] = [];
  private processingQueue = false;
  private readonly MAX_RETRIES = 3;
  private retryTimeout = 60000; // 1 minute

  constructor() {
    // Initialize on service creation if environment allows
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  public initialize(): boolean {
    try {
      // Skip initialization if email is disabled
      if (!config.email.enabled) {
        logger.info('Email service is disabled');
        return false;
      }

      // Create nodemailer transporter
      const transportOptions = this.getTransportOptions();
      this.transporter = nodemailer.createTransport(transportOptions);

      // Setup template engine if templates directory exists
      const templatesDir = path.join(process.cwd(), 'src/templates/emails');
      if (fs.existsSync(templatesDir)) {
        const handlebarOptions = {
          viewEngine: {
            extName: '.hbs',
            partialsDir: path.join(templatesDir, 'partials'),
            layoutsDir: path.join(templatesDir, 'layouts'),
            defaultLayout: 'main.hbs',
          },
          viewPath: templatesDir,
          extName: '.hbs'
        };

        this.transporter.use('compile', hbs(handlebarOptions));
      }

      // Verify connection
      this.verifyConnection();

      // Process any queued emails
      if (this.queue.length > 0) {
        this.processQueue();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize email service', 
        error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get transport options based on environment
   */
  private getTransportOptions(): any {
    // Use SMTP in production or development, JSON file in test
    if (config.nodeEnv === 'test') {
      // In test environment, use JSON transport
      return {
        jsonTransport: true
      };
    } else {
      // Use the configured SMTP server for both production and development
      return {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465, // Port 465 requires secure: true
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass
        },
        tls: {
          rejectUnauthorized: config.email.tls.rejectUnauthorized
        },
        // Connection timeouts
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,   // 30 seconds 
        socketTimeout: 30000,     // 30 seconds
        // Add debugging in development
        ...(config.nodeEnv !== 'production' ? { debug: true } : {})
      };
    }
  }

  /**
   * Verify connection to mail server
   */
  private async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      // Set a reasonable timeout for verification
      const verifyPromise = this.transporter.verify();
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          clearTimeout(timeout);
          reject(new Error('SMTP verification timed out after 30 seconds'));
        }, 30000);
      });
      
      // Race the verification against the timeout
      await Promise.race([verifyPromise, timeoutPromise]);
      
      logger.info('Email service connected successfully');
      return true;
    } catch (error) {
      // Log specific error codes
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
          logger.error('Email service connection timed out - check firewall or network settings');
        } else if (error.message.includes('EAUTH')) {
          logger.error('Email authentication failed - check username and password');
        } else if (error.message.includes('ESOCKET')) {
          logger.error('Email socket error - check host and port settings');
        } else {
          logger.error(`Email service connection failed: ${error.message}`);
        }
      } else {
        logger.error('Email service connection failed', new Error(String(error)));
      }
      
      return false;
    }
  }

  /**
   * Send an email
   */
  public async sendEmail(options: EmailOptions, retryCount = 0): Promise<boolean> {
    if (!config.email.enabled) {
      logger.warn('Email service is disabled. Not sending email.');
      return false;
    }

    // If not initialized or transporter is null, queue the email
    if (!this.initialized || !this.transporter) {
      this.queue.push(options);
      if (!this.processingQueue) {
        // Try to initialize and process queue
        this.initialize();
      }
      return false;
    }

    try {
      // Format the from address correctly if it doesn't contain < >
      let fromAddress = options.from || config.email.defaultFrom;
      if (fromAddress && !fromAddress.includes('<') && !fromAddress.includes('@')) {
        fromAddress = `"${fromAddress}" <${config.email.auth.user}>`;
      }

      // Prepare email data
      const mailOptions: any = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments || []
      };

      // Add content: either template, html, or text
      if (options.template && options.templateData) {
        mailOptions.template = options.template;
        mailOptions.context = options.templateData;
      } else if (options.html) {
        mailOptions.html = options.html;
      } else if (options.text) {
        mailOptions.text = options.text;
      } else {
        throw new Error('Email content not provided. Use template, html, or text.');
      }

      // Send mail
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);

      // Retry if not exceeding max retries
      if (retryCount < this.MAX_RETRIES) {
        logger.info(`Retrying email (${retryCount + 1}/${this.MAX_RETRIES})...`);
        
        // Exponential backoff
        const delay = this.retryTimeout * Math.pow(2, retryCount);
        
        setTimeout(() => {
          this.sendEmail(options, retryCount + 1);
        }, delay);
      } else {
        logger.error('Max retries reached. Email not sent.');
      }
      
      return false;
    }
  }

  /**
   * Process queued emails
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.queue.length === 0 || !this.transporter) {
      return;
    }

    this.processingQueue = true;
    
    try {
      // Create a copy of the queue and clear it
      const emailsToSend = [...this.queue];
      this.queue = [];

      logger.info(`Processing ${emailsToSend.length} queued emails`);

      // Send each email
      for (const options of emailsToSend) {
        await this.sendEmail(options);
      }
    } catch (error) {
      logger.error('Error processing email queue', 
        error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.processingQueue = false;
      
      // Process any new emails that were added during this process
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Send a system alert email
   */
  public async sendSystemAlert(subject: string, message: string, critical = false): Promise<boolean> {
    if (!config.email.enabled || !config.email.alerts.enabled) {
      logger.warn('Email alerts are disabled. Not sending alert.');
      return false;
    }

    const recipients = critical
      ? config.email.alerts.criticalRecipients
      : config.email.alerts.recipients;

    if (!recipients || recipients.length === 0) {
      logger.warn('No alert recipients configured. Not sending alert.');
      return false;
    }

    return this.sendEmail({
      to: recipients,
      subject: `[${config.nodeEnv.toUpperCase()}] ${critical ? 'CRITICAL ' : ''}ALERT: ${subject}`,
      template: 'alert',
      templateData: {
        subject,
        message,
        critical,
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        systemName: config.appName || 'Performance Tracking System'
      }
    });
  }

  /**
   * Send a performance report email
   */
  public async sendPerformanceReport(recipient: string, reportData: any): Promise<boolean> {
    return this.sendEmail({
      to: recipient,
      subject: 'Performance System Report',
      template: 'performance-report',
      templateData: {
        ...reportData,
        timestamp: new Date().toLocaleString(),
        recipient: recipient.split('@')[0]
      }
    });
  }

  /**
   * Shutdown the email service
   */
  public shutdown(): void {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.initialized = false;
      logger.info('Email service shut down');
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService; 