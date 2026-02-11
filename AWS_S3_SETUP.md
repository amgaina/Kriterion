# AWS S3 Setup Guide for Kriterion

This guide will help you set up AWS S3 for storing student submission files.

## Prerequisites

- AWS Account
- AWS CLI installed (optional but recommended)

## Step-by-Step Setup

### 1. Create an S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click **"Create bucket"**
3. Configure the bucket:
   - **Bucket name**: `kriterion-submissions` (or your preferred name)
   - **Region**: `us-east-1` (or your preferred region)
   - **Object Ownership**: ACLs disabled (recommended)
   - **Block Public Access**: Keep all public access blocked (recommended for security)
   - **Bucket Versioning**: Enable (optional, helps with file recovery)
   - **Default encryption**: Enable with SSE-S3
4. Click **"Create bucket"**

### 2. Create an IAM User for S3 Access

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **"Users"** → **"Add users"**
3. User details:
   - **User name**: `kriterion-s3-user`
   - **Access type**: Select **"Programmatic access"**
4. Click **"Next: Permissions"**

### 3. Attach S3 Policy to User

1. Select **"Attach existing policies directly"**
2. Click **"Create policy"**
3. Use the JSON tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "KriterionS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObjectMetadata",
        "s3:PutObjectMetadata"
      ],
      "Resource": [
        "arn:aws:s3:::kriterion-submissions",
        "arn:aws:s3:::kriterion-submissions/*"
      ]
    }
  ]
}
```

4. Click **"Review policy"**
5. Name it: `KriterionS3Policy`
6. Click **"Create policy"**
7. Go back to user creation, refresh policies, and attach `KriterionS3Policy`
8. Click **"Next: Tags"** (optional) → **"Next: Review"** → **"Create user"**

### 4. Get Access Keys

1. After user creation, you'll see:
   - **Access key ID**
   - **Secret access key**
2. **IMPORTANT**: Download the CSV or copy these credentials immediately
3. You won't be able to see the secret key again!

### 5. Configure Kriterion Backend

1. Open your `.env` file in the backend directory
2. Add the following environment variables:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIA...your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=kriterion-submissions
USE_S3_STORAGE=true
```

3. Replace with your actual values:
   - `AWS_ACCESS_KEY_ID`: The access key ID from step 4
   - `AWS_SECRET_ACCESS_KEY`: The secret access key from step 4
   - `AWS_REGION`: The region where you created your bucket
   - `AWS_S3_BUCKET_NAME`: Your bucket name

### 6. Install Required Packages

```bash
cd backend
pip install boto3 botocore
```

Or install from requirements.txt:

```bash
pip install -r requirements.txt
```

### 7. Test S3 Connection

Create a test script `test_s3.py`:

```python
import boto3
from botocore.exceptions import ClientError
import os
from dotenv import load_dotenv

load_dotenv()

def test_s3_connection():
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION')
        )

        bucket_name = os.getenv('AWS_S3_BUCKET_NAME')

        # Test bucket access
        response = s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        print(f"✅ Successfully connected to S3 bucket: {bucket_name}")
        print(f"✅ Region: {os.getenv('AWS_REGION')}")
        return True

    except ClientError as e:
        print(f"❌ Failed to connect to S3: {str(e)}")
        return False

if __name__ == "__main__":
    test_s3_connection()
```

Run the test:

```bash
python test_s3.py
```

## S3 Bucket Structure

Files will be organized in S3 as follows:

```
kriterion-submissions/
└── submissions/
    └── {assignment_id}/
        └── {student_id}/
            └── {submission_id}/
                ├── 20240208_143022_main.py
                ├── 20240208_143022_utils.py
                └── 20240208_143022_test.py
```

## Security Best Practices

1. **Never commit AWS credentials** to git
2. **Use IAM users** instead of root account
3. **Enable MFA** on your AWS account
4. **Rotate access keys** regularly (every 90 days)
5. **Enable CloudTrail** for S3 bucket auditing
6. **Set up bucket lifecycle policies** to archive old submissions
7. **Enable versioning** to prevent accidental deletions

## Cost Optimization

### Estimated Costs (as of 2024)

- **Storage**: ~$0.023 per GB/month
- **PUT requests**: $0.005 per 1,000 requests
- **GET requests**: $0.0004 per 1,000 requests

### For 100 students with 10 assignments each:

- Average file size: 50 KB per submission
- Total storage: ~50 MB = **$0.001/month**
- Total requests: ~1,000 uploads + 3,000 downloads = **$0.006/month**
- **Total estimated cost: ~$0.01/month**

### Cost-Saving Tips:

1. Set up **lifecycle policies** to move old submissions to cheaper storage (Glacier)
2. Enable **Intelligent-Tiering** for automatic cost optimization
3. Use **S3 Transfer Acceleration** only if needed (adds cost)
4. Clean up test/temporary files regularly

## Troubleshooting

### Error: Access Denied

- Check IAM policy has correct permissions
- Verify bucket name matches in policy and .env
- Ensure credentials are correct

### Error: Bucket does not exist

- Verify bucket name spelling
- Check bucket is in the correct region
- Ensure you have ListBucket permission

### Error: Invalid access key

- Regenerate access keys in IAM
- Update .env file with new keys
- Restart backend server

## Switching Between S3 and Local Storage

To use **local file storage** instead of S3:

1. Set in `.env`:

```bash
USE_S3_STORAGE=false
```

2. Ensure local directories exist:

```bash
mkdir -p /tmp/kriterion/submissions
```

3. Restart backend server

## Backup Strategy

### Recommended approach:

1. Enable **S3 Versioning** on your bucket
2. Set up **S3 Cross-Region Replication** for disaster recovery
3. Create **lifecycle policy** to move old versions to Glacier after 30 days
4. Use **AWS Backup** for automated backups

## Monitoring

### Set up CloudWatch alarms for:

- Number of objects in bucket
- Bucket size
- Request count
- Error rates

### Enable S3 Server Access Logging:

1. Go to bucket → Properties → Server access logging
2. Create a separate logging bucket
3. Enable logging

## Support

For issues or questions:

- AWS S3 Documentation: https://docs.aws.amazon.com/s3/
- AWS Support: https://console.aws.amazon.com/support/
- Kriterion GitHub Issues: [Your repo URL]

---

**Last Updated**: February 2026
