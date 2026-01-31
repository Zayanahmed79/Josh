# Debugging Upload Failure

## What I Added

I've added detailed logging at every step of the upload process to help identify exactly where it's failing.

## How to Debug

1. **Open Browser Console** (F12)
2. **Record a video** and click "Submit Video"
3. **Check the console** for step-by-step logs

## Expected Console Output

You should see logs like this:

```
Step 1: Uploading with MIME type: video/webm;codecs=vp8,opus filename: recording-1738345678-test_user.webm blob size: 1392026
Step 2: Getting presigned URL...
getUploadUrl called with: {filename: 'recording-...', contentType: 'video/webm;codecs=vp8,opus'}
Generated presigned URL successfully
Step 2 result: {url: 'https://accounts-52.s3.amazonaws.com/...'}
Step 3: Uploading to S3...
Step 3 result: 200 OK
Step 4: Video URL: https://accounts-52.s3.amazonaws.com/recording-...
Step 5: Saving to database...
saveRecording called with: {name: 'Test User', videoUrl: 'https://...'}
Recording saved successfully
Step 5 result: {success: true}
```

## Common Errors and Solutions

### Error: "Failed to fetch"
**Cause**: Server action isn't being called properly
**Solution**: Check if the dev server is running (`npm run dev`)

### Error: "AWS_ACCESS_KEY_ID is not set"
**Cause**: Environment variables not loaded
**Solution**: 
1. Restart the dev server
2. Make sure `.env` file is in the root directory
3. Check that all AWS variables are filled in

### Error: "SUPABASE_URL is not set"
**Cause**: Supabase environment variables missing
**Solution**: Check `.env` file has `SUPABASE_URL` and `SUPABASE_KEY`

### Error: "Upload failed: 403 Forbidden"
**Cause**: AWS credentials are invalid or bucket permissions wrong
**Solution**: 
1. Verify AWS credentials in `.env`
2. Check S3 bucket exists and has correct permissions
3. Verify bucket name is correct

### Error: "Insert error" from Supabase
**Cause**: Database table structure mismatch
**Solution**: 
1. Check table name is `videourl`
2. Verify table has columns: `name` (text) and `video_url` (text)
3. Check Supabase key has insert permissions

## Next Steps

1. **Try uploading again** with the console open
2. **Copy the error message** from the console
3. **Share the specific step** where it fails (Step 1, 2, 3, 4, or 5)
4. I'll help you fix the specific issue

## Quick Checklist

- [ ] Dev server is running (`npm run dev`)
- [ ] `.env` file exists in root directory
- [ ] All environment variables are filled in (no empty values)
- [ ] Browser console is open (F12)
- [ ] You can see the step-by-step logs
