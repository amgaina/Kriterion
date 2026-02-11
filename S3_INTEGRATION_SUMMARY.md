# S3 Integration Summary

## ✅ What Was Implemented

### 1. S3 Storage Service (`backend/app/services/s3_storage.py`)

A complete AWS S3 integration service with the following features:

- **File Upload**: Upload submission files to S3 with organized folder structure
- **File Download**: Download files from S3 to local storage for grading
- **Presigned URLs**: Generate temporary download links for secure file access
- **File Deletion**: Remove files from S3 when needed
- **File Listing**: List all files for a specific submission
- **Metadata Storage**: Store submission, student, and assignment IDs with each file
- **File Hashing**: SHA-256 hash calculation for duplicate detection

### 2. Updated Submission Endpoint (`backend/app/api/v1/endpoints/submissions.py`)

Enhanced the submission creation endpoint to:

- Upload files to S3 instead of local storage (when enabled)
- Store S3 URLs in the database `file_path` field
- Calculate and store file hashes
- Support both S3 and local storage modes
- Better error handling and logging
- File size validation
- Audit logging for all submissions

### 3. Configuration Updates (`backend/app/core/config.py`)

Added new environment variables:

- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_S3_BUCKET_NAME`: S3 bucket name
- `USE_S3_STORAGE`: Toggle between S3 and local storage

### 4. Dependencies (`backend/requirements.txt`)

Added AWS SDK:

- `boto3==1.34.20`: AWS SDK for Python
- `botocore==1.34.20`: Low-level AWS interface

### 5. Documentation

- **`.env.example`**: Complete example environment file with all variables
- **`AWS_S3_SETUP.md`**: Comprehensive setup guide with step-by-step instructions

## 📋 Required Environment Variables

Add these to your `.env` file:

```bash
# AWS S3 Configuration (REQUIRED)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=kriterion-submissions
USE_S3_STORAGE=true
```

## 🚀 How It Works

### File Upload Flow:

1. Student uploads files from frontend
2. Backend receives files via `/api/v1/submissions` endpoint
3. If `USE_S3_STORAGE=true`:
   - Files are uploaded to S3 with organized path structure
   - S3 URL is stored in database `submission_files.file_path`
   - File hash is calculated and stored
4. If `USE_S3_STORAGE=false`:
   - Files are saved to local directory
   - Local path is stored in database

### S3 File Structure:

```
submissions/
  └── {assignment_id}/
      └── {student_id}/
          └── {submission_id}/
              ├── 20240208_143022_main.py
              └── 20240208_143022_utils.py
```

### Database Storage:

The `submission_files` table stores:

- `filename`: Original filename
- `file_path`: S3 URL (e.g., `https://bucket.s3.region.amazonaws.com/...`)
- `file_hash`: SHA-256 hash for integrity checking
- Additional metadata (submission_id, upload time, etc.)

## 🔧 Setup Steps

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Create S3 Bucket

Follow instructions in `AWS_S3_SETUP.md`

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your AWS credentials
```

### 4. Test Connection

```bash
python test_s3.py  # (create this test file from the guide)
```

### 5. Start Backend

```bash
uvicorn app.main:app --reload
```

## 🔐 Security Features

1. **IAM Permissions**: Uses specific IAM user with limited S3 permissions
2. **File Hashing**: SHA-256 hashing for file integrity verification
3. **Metadata**: Stores submission context with each file
4. **Presigned URLs**: Temporary access URLs that expire
5. **Private Bucket**: Files not publicly accessible

## 💰 Cost Estimate

For a course with 100 students × 10 assignments:

- **Storage**: ~50 MB = $0.001/month
- **Requests**: ~4,000 = $0.006/month
- **Total**: ~$0.01/month

Very affordable! 🎉

## 🔄 Switching Storage Modes

### Use S3 (Recommended for Production):

```bash
USE_S3_STORAGE=true
```

### Use Local Storage (Development/Testing):

```bash
USE_S3_STORAGE=false
```

## 📊 Features

- ✅ Multi-file uploads per submission
- ✅ File size validation
- ✅ File type validation (by extension)
- ✅ Late submission detection
- ✅ Attempt number tracking
- ✅ Automatic file organization
- ✅ Audit logging
- ✅ Error handling and rollback
- ✅ Concurrent upload support
- ✅ SHA-256 file hashing

## 🐛 Troubleshooting

### Common Issues:

**"Access Denied" error:**

- Check AWS credentials in .env
- Verify IAM policy permissions
- Ensure bucket exists in specified region

**"Bucket not found" error:**

- Verify bucket name spelling
- Check bucket region matches AWS_REGION

**"Invalid credentials" error:**

- Regenerate AWS access keys
- Update .env file
- Restart backend server

**Local storage fallback:**

- Set `USE_S3_STORAGE=false`
- Files will save to `/tmp/kriterion/submissions/`

## 📝 Next Steps

1. ✅ S3 integration complete
2. ⏭️ Update frontend to handle file uploads
3. ⏭️ Implement automated grading with S3 file retrieval
4. ⏭️ Add file download endpoint with presigned URLs
5. ⏭️ Set up S3 lifecycle policies for cost optimization

## 🎯 Testing Checklist

- [ ] Upload single file
- [ ] Upload multiple files
- [ ] Check files appear in S3 bucket
- [ ] Verify database entries have S3 URLs
- [ ] Test file size limits
- [ ] Test late submission handling
- [ ] Test max attempts limit
- [ ] Test with local storage mode
- [ ] Test error handling

---

**Implementation Status**: ✅ Complete and Ready for Testing

**Files Modified**:

- `backend/app/services/s3_storage.py` (new)
- `backend/app/api/v1/endpoints/submissions.py` (updated)
- `backend/app/core/config.py` (updated)
- `backend/requirements.txt` (updated)
- `backend/.env.example` (new)
- `AWS_S3_SETUP.md` (new)
