// Script to update your .env file with correct email settings
const fs = require('fs');
const path = require('path');

try {
  console.log('Fixing email configuration...');
  
  // Path to .env file
  const envFile = path.join(__dirname, '.env');
  
  // Read the current .env file
  let envContent = fs.readFileSync(envFile, 'utf8');
  
  // Updates to make
  const updates = [
    // Remove secure setting as it's now determined by the port
    { find: /EMAIL_SECURE=.*/g, replace: '' },
    
    // Remove Ethereal setting as it's been removed from the code
    { find: /EMAIL_USE_ETHEREAL=.*/g, replace: '' },
    
    // Fix the FROM format - properly format the email address
    { 
      find: /EMAIL_FROM=(.+)/g, 
      replace: (match, p1) => {
        if (p1.includes('@')) return match; // Already a valid email
        return `EMAIL_FROM=${p1}`;  // Keep the display name, will be formatted in code
      }
    },
    
    // Fix any typos in email addresses
    { 
      find: /tharungv4@gmail\.con/g, 
      replace: 'tharungv4@gmail.com'
    }
  ];
  
  // Apply all updates
  updates.forEach(update => {
    envContent = envContent.replace(update.find, update.replace);
  });
  
  // Add any missing essential config
  if (!envContent.includes('EMAIL_ENABLED=')) {
    envContent += '\nEMAIL_ENABLED=true';
  }
  
  if (!envContent.includes('EMAIL_ALERTS_ENABLED=')) {
    envContent += '\nEMAIL_ALERTS_ENABLED=true';
  }
  
  if (!envContent.includes('EMAIL_TLS_REJECT_UNAUTHORIZED=')) {
    envContent += '\nEMAIL_TLS_REJECT_UNAUTHORIZED=true';
  }
  
  // Save the updated .env file
  fs.writeFileSync(envFile, envContent);
  
  console.log('Email configuration fixed successfully!');
  console.log('Please restart your server for changes to take effect.');
} catch (error) {
  console.error('Error fixing email configuration:', error.message);
} 