
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function configureCors() {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    console.error("Error: S3_BUCKET_NAME is not set in .env.local");
    return;
  }

  console.log(`Configuring CORS for bucket: ${bucketName}...`);

  const corsRules = [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["PUT", "POST", "GET", "HEAD"], // PUT is critical for uploads
      AllowedOrigins: ["https://josh-virid.vercel.app", "*"], // Allow localhost and others (adjust '*' for production)
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ];

  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: corsRules,
      },
    });

    await s3.send(command);
    console.log("Successfully configured CORS!");
    console.log("You can now verify the upload.");
  } catch (error) {
    console.error("Error configuring CORS:", error);
  }
}

configureCors();
