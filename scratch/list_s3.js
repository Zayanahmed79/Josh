
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Basic env parsing for .env.local
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const s3 = new S3Client({
  region: env['AWS_REGION'] || 'us-east-1',
  credentials: {
    accessKeyId: env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: env['AWS_SECRET_ACCESS_KEY'],
  },
});

async function test() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: env['S3_BUCKET_NAME'],
      Prefix: 'recording-1776186259857-milica_lukic',
    });
    const response = await s3.send(command);
    console.log('S3 List results:', JSON.stringify(response.Contents, null, 2));
  } catch (err) {
    console.error('S3 List error:', err);
  }
}

test();
