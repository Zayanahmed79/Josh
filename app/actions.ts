'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabase } from '@/lib/supabase'

export async function login(prevState: any, formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const cookieStore = await cookies()
        cookieStore.set('session', 'admin', { secure: true, httpOnly: true, path: '/', maxAge: 60 * 60 * 24 })
        return { success: true }
    } else {
        return { error: 'Invalid credentials' }
    }
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.delete('session')
    redirect('/login')
}

export async function getUploadUrl(filename: string, contentType: string) {
    try {
        console.log('getUploadUrl called with:', { filename, contentType });

        // Validate environment variables
        if (!process.env.AWS_ACCESS_KEY_ID) {
            throw new Error('AWS_ACCESS_KEY_ID is not set');
        }
        if (!process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS_SECRET_ACCESS_KEY is not set');
        }
        if (!process.env.AWS_REGION) {
            throw new Error('AWS_REGION is not set');
        }
        if (!process.env.S3_BUCKET_NAME) {
            throw new Error('S3_BUCKET_NAME is not set');
        }

        const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filename,
            ContentType: contentType,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        console.log('Generated presigned URL successfully');
        return { url };
    } catch (error: any) {
        console.error('S3 Error:', error);
        return { error: error.message || 'Failed to generate upload URL' };
    }
}

export async function saveRecording(name: string, videoUrl: string) {
    try {
        console.log('saveRecording called with:', { name, videoUrl });

        // Validate environment variables
        if (!process.env.SUPABASE_URL) {
            throw new Error('SUPABASE_URL is not set');
        }
        if (!process.env.SUPABASE_KEY) {
            throw new Error('SUPABASE_KEY is not set');
        }

        const { data, error } = await supabase.from('videourl').insert({ name, video_url: videoUrl });

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        console.log('Recording saved successfully:', data);
        return { success: true };
    } catch (error: any) {
        console.error('Supabase Error:', error);
        return { error: error.message || 'Failed to save recording' };
    }
}

export async function getRecordings() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (session?.value !== 'admin') {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('videourl')
        .select('*');

    if (error) {
        console.error('Supabase Load Error:', error);
        return { error: error.message };
    }
    return { data };
}
