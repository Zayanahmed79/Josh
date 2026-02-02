'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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

export async function uploadVideo(formData: FormData) {
    try {
        const file = formData.get('video') as File;
        const name = formData.get('name') as string;

        if (!file || !name) {
            throw new Error('Missing video file or name');
        }

        // Validate environment variables
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.S3_BUCKET_NAME) {
            throw new Error('AWS credentials or bucket configuration missing');
        }

        const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = `recording-${Date.now()}-${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${file.name.split('.').pop()}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filename,
            Body: buffer,
            ContentType: file.type,
        });

        await s3.send(command);
        console.log('Video uploaded to S3 successfully:', filename);

        const videoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;

        // Save to DB
        const saveRes = await saveRecording(name, videoUrl);
        if (saveRes.error) throw new Error(saveRes.error);

        return { success: true, videoUrl };
    } catch (error: any) {
        console.error('Upload Action Error:', error);
        return { error: error.message || 'Failed to upload video' };
    }
}

async function saveRecording(name: string, videoUrl: string) {
    try {
        console.log('saveRecording called with:', { name, videoUrl });
        const { error } = await supabase.from('videourl').insert({ name, url: videoUrl });
        if (error) throw error;
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
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase Load Error:', error);
        return { error: error.message };
    }
    return { data };
}

export async function getRecording(id: string) {
    const { data, error } = await supabase
        .from('videourl')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Supabase Fetch Error:', error);
        return { error: error.message };
    }
    return { data };
}

export async function deleteRecording(id: string) {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (session?.value !== 'admin') {
        return { error: 'Unauthorized' };
    }

    try {
        // 1. Get the recording details to find the S3 URL
        const { data: recording, error: fetchError } = await supabase
            .from('videourl')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !recording) {
            throw new Error(fetchError?.message || 'Recording not found');
        }

        // 2. Delete from S3
        const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const urlParts = recording.url.split('/');
        const filename = urlParts[urlParts.length - 1];

        const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filename,
        });

        await s3.send(deleteCommand);
        console.log('Video deleted from S3 successfully:', filename);

        // 3. Delete from Supabase DB
        const { error: deleteError } = await supabase
            .from('videourl')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        return { success: true };
    } catch (error: any) {
        console.error('Delete Action Error:', error);
        return { error: error.message || 'Failed to delete recording' };
    }
}
