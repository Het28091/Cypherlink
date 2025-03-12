// server.js
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize app
const app = express();
app.use(cors());
app.use(express.json());

// AWS configuration
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const cloudWatchLogs = new AWS.CloudWatchLogs();

const BUCKET_NAME = 'your-unique-secure-bucket-name';
const LOG_GROUP = '/aws/file-storage-app';
const LOG_STREAM = 'application-logs';

// File upload configuration
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to log activity
async function logActivity(action, details) {
  const timestamp = new Date().toISOString();
  const logId = uuidv4();
  
  // Log to CloudWatch
  try {
    await cloudWatchLogs.putLogEvents({
      logGroupName: LOG_GROUP,
      logStreamName: LOG_STREAM,
      logEvents: [
        {
          message: JSON.stringify({ action, details, timestamp }),
          timestamp: Date.now()
        }
      ]
    }).promise();
  } catch (err) {
    console.error("CloudWatch logging error:", err);
  }
  
  // Log to DynamoDB
  try {
    await dynamoDB.put({
      TableName: 'ActivityLogs',
      Item: {
        logId,
        timestamp,
        action,
        details: JSON.stringify(details)
      }
    }).promise();
  } catch (err) {
    console.error("DynamoDB logging error:", err);
  }
}

// Encrypt file
function encryptFile(buffer, password) {
  const algorithm = 'aes-256-ctr';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encryptedBuffer = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  
  return encryptedBuffer;
}

// Decrypt file
function decryptFile(encryptedBuffer, password) {
  const algorithm = 'aes-256-ctr';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = encryptedBuffer.slice(0, 16);
  const encryptedContent = encryptedBuffer.slice(16);
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  return Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
}

// Upload file endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const encryptionKey = req.body.encryptionKey || 'default-password';
    const fileId = uuidv4();
    const encryptedBuffer = encryptFile(file.buffer, encryptionKey);
    
    // Upload to S3
    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: `files/${fileId}`,
      Body: encryptedBuffer,
      ContentType: file.mimetype,
      Metadata: {
        'original-name': encodeURIComponent(file.originalname)
      }
    }).promise();
    
    // Save metadata to DynamoDB
    await dynamoDB.put({
      TableName: 'FileMetadata',
      Item: {
        fileId,
        fileName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        encrypted: true
      }
    }).promise();
    
    // Log the activity
    await logActivity('FILE_UPLOAD', {
      fileId,
      fileName: file.originalname,
      size: file.size
    });
    
    res.status(200).json({
      success: true,
      fileId,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
});

// Download file endpoint
app.get('/api/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { encryptionKey } = req.query;
    
    if (!encryptionKey) {
      return res.status(400).json({
        success: false,
        message: 'Encryption key is required'
      });
    }
    
    // Get file metadata
    const metadata = await dynamoDB.get({
      TableName: 'FileMetadata',
      Key: { fileId }
    }).promise();
    
    if (!metadata.Item) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Get file from S3
    const s3Object = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: `files/${fileId}`
    }).promise();
    
    // Decrypt file
    const decryptedBuffer = decryptFile(s3Object.Body, encryptionKey);
    
    // Log activity
    await logActivity('FILE_DOWNLOAD', {
      fileId,
      fileName: metadata.Item.fileName
    });
    
    // Set headers and send file
    res.setHeader('Content-Type', metadata.Item.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.Item.fileName}"`);
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file',
      error: error.message
    });
  }
});

// List files endpoint
app.get('/api/files', async (req, res) => {
  try {
    const result = await dynamoDB.scan({
      TableName: 'FileMetadata'
    }).promise();
    
    await logActivity('LIST_FILES', {
      count: result.Items.length
    });
    
    res.status(200).json({
      success: true,
      files: result.Items
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing files',
      error: error.message
    });
  }
});

// Delete file endpoint
app.delete('/api/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Get file metadata first
    const metadata = await dynamoDB.get({
      TableName: 'FileMetadata',
      Key: { fileId }
    }).promise();
    
    if (!metadata.Item) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete from S3
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: `files/${fileId}`
    }).promise();
    
    // Delete metadata from DynamoDB
    await dynamoDB.delete({
      TableName: 'FileMetadata',
      Key: { fileId }
    }).promise();
    
    // Log activity
    await logActivity('FILE_DELETE', {
      fileId,
      fileName: metadata.Item.fileName
    });
    
    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message
    });
  }
});

// Get logs endpoint
app.get('/api/logs', async (req, res) => {
  try {
    const result = await dynamoDB.scan({
      TableName: 'ActivityLogs'
    }).promise();
    
    res.status(200).json({
      success: true,
      logs: result.Items
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});