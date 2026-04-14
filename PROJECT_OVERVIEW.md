# Video Recording & Management Platform

## 📋 Executive Summary (For Non-Technical Users)

This is a **video recording and management platform** that allows people to record videos through their web browser and share them with administrators. Think of it as a simple, professional video collection system.

### What Does This Platform Do?

**For Video Contributors (Public Users):**
- Access a unique recording link shared by administrators
- Record videos directly in their web browser using their camera and microphone
- Enter their name before recording
- Preview their recording before submitting
- Submit videos that are automatically saved and organized

**For Administrators:**
- Access a secure dashboard to view all submitted videos
- Copy and share a permanent recording link with others
- Watch, manage, and organize all submitted videos
- Search for videos by contributor name
- Delete videos when needed
- Copy individual video links to share specific recordings

### Key Features at a Glance

✅ **Browser-Based Recording** - No app downloads needed, works in any modern web browser  
✅ **Secure Access** - Admin dashboard protected by login credentials  
✅ **Permanent Links** - Recording links never expire, making it easy to collect videos over time  
✅ **Professional Interface** - Clean, modern design that's easy to use  
✅ **Cloud Storage** - Videos are securely stored in the cloud (Amazon S3)  
✅ **Mobile Friendly** - Works on phones, tablets, and computers  

### Common Use Cases

- **Customer Testimonials** - Collect video testimonials from satisfied customers
- **Job Applications** - Request video introductions from job candidates
- **Feedback Collection** - Gather video feedback from users or clients
- **Event Submissions** - Collect video entries for contests or events
- **Support Requests** - Allow customers to record and submit video bug reports

---

## 🔧 Technical Documentation (For Developers)

### Technology Stack

**Frontend Framework:**
- Next.js 16.1.6 (React 19.2.3)
- TypeScript 5
- Tailwind CSS 4 (styling)
- Framer Motion (animations)

**Backend & Infrastructure:**
- Next.js Server Actions (API layer)
- Supabase (PostgreSQL database)
- AWS S3 (video storage)
- AWS SDK v3 (S3 client & presigned URLs)

**Key Libraries:**
- `@supabase/supabase-js` - Database client
- `@aws-sdk/client-s3` - S3 operations
- `@aws-sdk/s3-request-presigner` - Secure URL generation
- `lucide-react` - Icon library
- `sonner` - Toast notifications
- `clsx` & `tailwind-merge` - Utility styling

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Login Page   │  │ Record Page  │  │  Dashboard   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Server Actions (API)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • login()           • uploadVideo()                   │   │
│  │ • logout()          • getRecordings()                 │   │
│  │ • deleteRecording() • checkPortalAccess()             │   │
│  │ • getPresignedUploadUrl() • saveVideoMetadata()      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
        ┌──────────────────┐  ┌──────────────────┐
        │   Supabase DB    │  │     AWS S3       │
        │  (PostgreSQL)    │  │  (Video Files)   │
        │                  │  │                  │
        │ • videourl table │  │ • Video blobs    │
        │ • Portal config  │  │ • Presigned URLs │
        └──────────────────┘  └──────────────────┘
```

### Database Schema

**Table: `videourl`**

| Column      | Type      | Description                                    |
|-------------|-----------|------------------------------------------------|
| id          | UUID      | Primary key (auto-generated)                   |
| name        | TEXT      | Contributor name or special key                |
| url         | TEXT      | S3 URL or portal slug                          |
| created_at  | TIMESTAMP | Auto-generated timestamp                       |

**Special Row:**
- `name = '__PORTAL_CONFIG__'` stores the active portal slug in the `url` column

### Core Workflows

#### 1. Video Recording Flow

```
User visits /record/{portal-id}
    ↓
checkPortalAccess() validates the portal ID
    ↓
User enters name → clicks "Start Recording"
    ↓
Browser MediaRecorder API captures video/audio
    ↓
User clicks "Stop Recording" → preview shown
    ↓
User clicks "Submit"
    ↓
getPresignedUploadUrl() generates secure S3 upload URL
    ↓
Client uploads video directly to S3 via presigned URL
    ↓
saveVideoMetadata() saves record to Supabase
    ↓
Success screen with "Record Another" option
```

#### 2. Admin Dashboard Flow

```
Admin visits /login
    ↓
Credentials validated against environment variables
    ↓
Session cookie set → redirect to /dashboard
    ↓
getRecordings() fetches all videos from Supabase
    ↓
Dashboard displays video grid with:
    • Video preview (hover to play)
    • Contributor name & timestamp
    • Copy link button
    • Delete button
    • Search & pagination
```

#### 3. Video Viewing Flow

```
User visits /v/{video-id}
    ↓
getRecording() fetches metadata from Supabase
    ↓
Generates presigned S3 URL (1-hour expiry)
    ↓
Video player renders with secure URL
```

### Key Files & Responsibilities

**Pages:**
- `app/page.tsx` - Root redirect to dashboard
- `app/login/page.tsx` - Admin authentication
- `app/dashboard/page.tsx` - Server component wrapper
- `app/dashboard/DashboardClient.tsx` - Main admin interface
- `app/record/[id]/page.tsx` - Public recording portal
- `app/v/[id]/page.tsx` - Video viewer

**Core Logic:**
- `app/actions.ts` - All server actions (API layer)
- `lib/supabase.ts` - Supabase client initialization
- `lib/utils.ts` - Utility functions

**Configuration:**
- `next.config.ts` - Next.js configuration
- `tailwind.config.js` - Styling configuration
- `.env.local` - Environment variables (not in repo)

### Environment Variables Required

```bash
# Admin Authentication
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
```

### Security Features

1. **Admin Authentication**
   - Session-based authentication with HTTP-only cookies
   - Credentials stored in environment variables
   - Protected routes check session before rendering

2. **Video Upload Security**
   - Presigned URLs with 10-minute expiry for uploads
   - Direct client-to-S3 upload (no server intermediary)
   - Content-Type validation

3. **Video Access Security**
   - Presigned URLs with 1-hour expiry for viewing
   - Portal access validation before recording
   - Database-level access control

4. **CORS & Bucket Configuration**
   - S3 bucket configured for secure uploads
   - CORS policy allows browser uploads
   - Private bucket with presigned URL access

### API Endpoints (Server Actions)

| Action                    | Purpose                                  | Auth Required |
|---------------------------|------------------------------------------|---------------|
| `login()`                 | Authenticate admin user                  | No            |
| `logout()`                | Clear session and redirect               | Yes           |
| `uploadVideo()`           | Legacy upload method (not used)          | No            |
| `getPresignedUploadUrl()` | Generate secure S3 upload URL            | No            |
| `saveVideoMetadata()`     | Save video record to database            | No            |
| `getRecordings()`         | Fetch all videos for dashboard           | Yes           |
| `getRecording()`          | Fetch single video with presigned URL    | No            |
| `deleteRecording()`       | Delete video from S3 and database        | Yes           |
| `checkPortalAccess()`     | Validate portal ID and get status        | No            |
| `renewPortal()`           | Generate new portal slug                 | Yes           |

### Development Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Deployment Considerations

**Recommended Platforms:**
- Vercel (optimal for Next.js)
- AWS Amplify
- Netlify

**Pre-deployment Checklist:**
- ✅ Configure all environment variables in hosting platform
- ✅ Set up S3 bucket with proper CORS configuration
- ✅ Create Supabase project and `videourl` table
- ✅ Test video recording and upload flow
- ✅ Verify admin authentication works
- ✅ Check presigned URL generation

**S3 Bucket Configuration:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://your-domain.com"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### Performance Optimizations

1. **Video Handling**
   - Direct client-to-S3 upload (no server bottleneck)
   - Presigned URLs reduce server load
   - Video preview uses object URLs (no re-download)

2. **UI/UX**
   - Hover-to-play video previews
   - Pagination for large video collections
   - Optimistic UI updates with toast notifications

3. **Caching**
   - Static assets cached by CDN
   - Server-side rendering for initial page load
   - Client-side navigation for instant transitions

### Known Issues & Limitations

1. **Browser Compatibility**
   - MediaRecorder API requires modern browsers
   - Safari may have codec limitations (fallback to webm)

2. **File Size**
   - No explicit file size limit (S3 default: 5GB per object)
   - Large videos may take time to upload on slow connections

3. **Portal Management**
   - Single permanent portal link (no multi-portal support)
   - Portal renewal generates new slug but old links remain valid

### Future Enhancement Opportunities

- 📊 Analytics dashboard (view counts, upload trends)
- 🏷️ Video tagging and categorization
- 📧 Email notifications on new submissions
- 🎨 Custom branding for recording portal
- 📱 Native mobile app for better recording quality
- 🔐 Multi-admin support with role-based access
- 💾 Video transcoding for optimized playback
- 📝 Automatic transcription and captions

---

## 📞 Support & Maintenance

### Troubleshooting Common Issues

**Issue: Videos not uploading**
- Check AWS credentials in environment variables
- Verify S3 bucket CORS configuration
- Check browser console for errors

**Issue: Admin login not working**
- Verify ADMIN_EMAIL and ADMIN_PASSWORD in .env.local
- Clear browser cookies and try again
- Check server logs for authentication errors

**Issue: Portal access denied**
- Verify portal slug exists in database
- Check Supabase connection
- Ensure `__PORTAL_CONFIG__` row exists

### Monitoring & Logs

- Check Vercel/hosting platform logs for server errors
- Monitor S3 bucket usage and costs
- Review Supabase dashboard for database performance
- Set up alerts for failed uploads or authentication issues

---

## 📄 License & Credits

This project uses:
- Next.js (MIT License)
- React (MIT License)
- Tailwind CSS (MIT License)
- Supabase (Apache 2.0 License)
- AWS SDK (Apache 2.0 License)

---

**Last Updated:** March 6, 2026  
**Version:** 0.1.0  
**Status:** Production Ready
