'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabase } from '@/lib/supabase'

const EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const PORTAL_CONFIG_KEY = '__PORTAL_CONFIG__'

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
        .neq('name', PORTAL_CONFIG_KEY) // Filter out the portal config row
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase Load Error:', error);
        return { error: error.message };
    }

    const processedData = data?.map(rec => ({
        ...rec,
        isExpired: (Date.now() - new Date(rec.created_at).getTime()) > EXPIRY_TIME
    }));

    return { data: processedData };
}

export async function getRecording(id: string) {
    const { data, error } = await supabase
        .from('videourl')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('Supabase Fetch Error:', error);
        return { error: error?.message || 'Recording not found' };
    }

    // Check for expiration (7 days)
    const creationTime = new Date(data.created_at).getTime();
    const isExpired = (Date.now() - creationTime) > EXPIRY_TIME;

    if (isExpired) {
        return { error: 'LINK_EXPIRED', data: { name: data.name } };
    }

    // Generate a secure presigned URL for viewing (even if the bucket is private)
    try {
        const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const urlParts = data.url.split('/');
        const filename = urlParts[urlParts.length - 1];

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filename,
        });

        // The URL itself will also expire in 1 hour for extra security, 
        // but the business logic enforces the 7-day rule.
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

        return {
            data: {
                ...data,
                url: presignedUrl
            }
        };
    } catch (err) {
        console.error('Presigned URL Error:', err);
        // Fallback to stored URL if presigning fails (assuming it's still public for now)
        return { data };
    }
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

export async function renewRecording(id: string) {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (session?.value !== 'admin') {
        return { error: 'Unauthorized' };
    }

    try {
        // 1. Get the existing recording metadata
        const { data: recording, error: fetchError } = await supabase
            .from('videourl')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !recording) {
            throw new Error(fetchError?.message || 'Recording not found');
        }

        // 2. Create a new entry with the same data (new ID and new created_at)
        const { data: newRec, error: insertError } = await supabase
            .from('videourl')
            .insert({
                name: recording.name,
                url: recording.url.split('?')[0] // Ensure we save the clean URL without old presign tokens
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 3. Delete the old expired entry
        const { error: deleteError } = await supabase
            .from('videourl')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.warn('New record created but old record deletion failed:', deleteError);
        }

        return { success: true, data: newRec };
    } catch (error: any) {
        console.error('Renew Action Error:', error);
        return { error: error.message || 'Failed to renew link' };
    }
}

export async function checkPortalAccess(id?: string) {
    try {
        // Fetch the config row from Supabase
        const { data: config, error } = await supabase
            .from('videourl')
            .select('*')
            .eq('name', PORTAL_CONFIG_KEY)
            .single();

        if (error || !config) {
            return { allowed: false };
        }

        const activeSlug = config.url; // We rely on 'url' column to store the slug
        const creationTime = new Date(config.created_at).getTime();

        // If an ID is provided, it must match the active one
        if (id && id !== activeSlug) {
            return { allowed: false };
        }

        const isExpired = (Date.now() - creationTime) > EXPIRY_TIME;

        return {
            allowed: !isExpired,
            expiresAt: creationTime + EXPIRY_TIME,
            activeId: activeSlug
        };
    } catch (error: any) {
        console.error('Portal Check Error:', error);
        return { allowed: false };
    }
}

export async function renewPortal() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (session?.value !== 'admin') {
        return { error: 'Unauthorized' };
    }

    try {
        // Generate a random unique slug for the portal
        const newSlug = Math.random().toString(36).substring(2, 10);

        // Delete any existing portal config (to ensure clean slate and correct timestamp)
        await supabase
            .from('videourl')
            .delete()
            .eq('name', PORTAL_CONFIG_KEY);

        // Insert new portal config with current timestamp
        const { data, error } = await supabase
            .from('videourl')
            .insert({
                name: PORTAL_CONFIG_KEY,
                url: newSlug // Using 'url' column to store the slug
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, id: newSlug };
    } catch (error: any) {
        console.error('Portal Renew Error:', error);
        return { error: error.message || 'Failed to renew portal' };
    }
}

export async function getPresignedUploadUrl(userName: string, fileType: string) {
    try {
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

        const extension = fileType.split('/')[1] || 'webm';
        const filename = `recording-${Date.now()}-${userName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
        
        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filename,
            ContentType: fileType,
        });

        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

        return { success: true, url: signedUrl, filename };
    } catch (error: any) {
        console.error('Presigned URL Error:', error);
        return { error: error.message };
    }
}

export async function saveVideoMetadata(name: string, filename: string) {
    try {
        const videoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
        
        const { error } = await supabase.from('videourl').insert({ name, url: videoUrl });
        if (error) throw error;
        
        return { success: true, videoUrl };
    } catch (error: any) {
        console.error('Save Metadata Error:', error);
        return { error: error.message || 'Failed to save recording' };
    }
}