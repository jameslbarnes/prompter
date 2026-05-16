// Load environment variables from .env file
require('dotenv').config();

const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const sgMail = require('@sendgrid/mail');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const fs = require('fs');

// Initialize Firebase Admin SDK
let db = null;
try {
  // Check if we're in a production environment or if service account is provided
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Use service account from environment variable (JSON string)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else if (process.env.NODE_ENV !== 'production' && fs.existsSync('firebase-service-account.local.json')) {
    // Local credential files are intentionally ignored by git.
    const serviceAccount = require('../../firebase-service-account.local.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    console.warn('Firebase service account not configured');
  }
  if (admin.apps.length) {
    console.log('Firebase Admin SDK initialized successfully');
    db = admin.firestore();
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  console.warn('Continuing without Firebase - custom interviews will not be available');
}

// Initialize Google Cloud Storage
let storage;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'prompter-media';

try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    storage = new Storage({ credentials });
  } else if (process.env.NODE_ENV !== 'production' && fs.existsSync('google-cloud-credentials.local.json')) {
    const credentials = JSON.parse(fs.readFileSync('google-cloud-credentials.local.json'));
    storage = new Storage({ credentials });
  } else {
    storage = null;
    console.warn('Google Cloud Storage credentials not configured');
  }
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
  storage = null;
}

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not set - email sending will be disabled');
}

// Configuration constants
const config = {
  PORT: process.env.PORT || 3001,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3001',
  GCS_BUCKET_NAME,
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    }
  }
};

module.exports = {
  config,
  db,
  storage,
  sgMail,
  stripe,
  admin
};
