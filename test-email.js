require('dotenv').config();
const nodemailer = require('nodemailer');
const dns = require('dns');
const net = require('net');

// Helper function to check if the host is reachable
function checkHostConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    // Set a timeout of 5 seconds
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log(`Successfully connected to ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.error(`Connection to ${host}:${port} timed out`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (error) => {
      console.error(`Error connecting to ${host}:${port}: ${error.message}`);
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

// Check DNS resolution
async function checkDns(hostname) {
  try {
    console.log(`Resolving DNS for ${hostname}...`);
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve(hostname, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    console.log(`DNS resolved: ${hostname} -> ${addresses.join(', ')}`);
    return true;
  } catch (error) {
    console.error(`DNS resolution failed for ${hostname}: ${error.message}`);
    return false;
  }
}

async function testEmail() {
  try {
    console.log('======= EMAIL SERVICE TEST =======');
    console.log('Environment variables:');
    console.log(`- EMAIL_HOST: ${process.env.EMAIL_HOST}`);
    console.log(`- EMAIL_PORT: ${process.env.EMAIL_PORT}`);
    console.log(`- EMAIL_USER: ${process.env.EMAIL_USER}`);
    console.log(`- EMAIL_FROM: ${process.env.EMAIL_FROM}`);
    console.log(`- EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '******' : 'NOT SET'}`);
    
    // Check DNS resolution
    const dnsResolved = await checkDns(process.env.EMAIL_HOST);
    if (!dnsResolved) {
      console.error('❌ DNS resolution failed. Check your EMAIL_HOST setting or internet connection.');
    }
    
    // Check direct connection
    console.log(`Testing direct socket connection to ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}...`);
    const canConnect = await checkHostConnection(process.env.EMAIL_HOST, process.env.EMAIL_PORT);
    if (!canConnect) {
      console.error('❌ Cannot establish TCP connection to email server.');
      console.error('Possible causes:');
      console.error('1. Firewall blocking outbound connections');
      console.error('2. Email provider blocking connections from your IP');
      console.error('3. Incorrect hostname or port');
      console.error('4. Network connectivity issues');
    }
    
    console.log('\nCreating SMTP transport with following settings:');
    const config = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: parseInt(process.env.EMAIL_PORT, 10) === 465, // Port 465 requires secure: true
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 30000,     // 30 seconds
      tls: {
        rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
      },
      debug: true // Enable debug output
    };
    
    console.log(JSON.stringify(config, null, 2));
    
    // Create transporter
    console.log('Creating transporter...');
    const transporter = nodemailer.createTransport(config);
    
    // Verify connection
    console.log('Verifying connection (this may take up to 30 seconds)...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    // Ask if user wants to send a test email
    console.log('\nConnection verified. Do you want to send a test email? (y/n)');
    process.stdin.once('data', async (data) => {
      const input = data.toString().trim().toLowerCase();
      
      if (input === 'y' || input === 'yes') {
        // Setup email data
        const fromName = process.env.EMAIL_FROM || 'Performance Tracker';
        const mailOptions = {
          from: `"${fromName}" <${process.env.EMAIL_USER}>`, // Correct format with name and email
          to: 'tharungv4@gmail.com',
          subject: 'Email Connection Test',
          text: 'If you receive this email, the email service is configured correctly.',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
              <h2 style="color: #2c3e50;">Email Test Successful</h2>
              <p>This email confirms that your SMTP settings are working correctly.</p>
              <p><strong>Server:</strong> ${process.env.EMAIL_HOST}</p>
              <p><strong>Port:</strong> ${process.env.EMAIL_PORT}</p>
              <p><strong>Username:</strong> ${process.env.EMAIL_USER}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
          `
        };
        
        // Send email
        console.log('Sending test email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
      } else {
        console.log('Test email sending skipped.');
      }
      
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    if (error.code === 'ESOCKET') {
      console.error('Socket error: Unable to establish connection with the email server.');
    } else if (error.code === 'EAUTH') {
      console.error('Authentication failed: Check your username and password.');
    } else if (error.code === 'ETIMEOUT') {
      console.error('Connection timed out: The email server did not respond in time.');
    }
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testEmail(); 