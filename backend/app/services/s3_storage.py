"""
AWS S3 Storage Service - Handle file uploads to S3
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError
from typing import Optional, BinaryIO
import hashlib
import os
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from app.core.config import settings
from app.core.logging import logger


class S3StorageService:
    """Service for managing file uploads to AWS S3"""

    def __init__(self):
        self._s3_client = None
        self._bucket_name = None

    @property
    def s3_client(self):
        """Lazy-initialize S3 client (ensures config is loaded)"""
        if self._s3_client is None:
            key = getattr(settings, 'AWS_ACCESS_KEY_ID', '') or ''
            secret = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '') or ''
            region = getattr(settings, 'AWS_REGION', 'us-east-1') or 'us-east-1'
            if not key or not secret:
                raise Exception(
                    "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"
                )
            self._s3_client = boto3.client(
                's3',
                aws_access_key_id=key.strip(),
                aws_secret_access_key=secret.strip(),
                region_name=region.strip(),
                config=Config(
                    retries={'max_attempts': 3, 'mode': 'standard'},
                    signature_version='s3v4'
                )
            )
        return self._s3_client

    @property
    def bucket_name(self) -> str:
        if self._bucket_name is None:
            self._bucket_name = (getattr(settings, 'AWS_S3_BUCKET_NAME', '') or 'kriterion-submissions').strip()
            if not self._bucket_name:
                raise Exception("AWS_S3_BUCKET_NAME is not set in .env")
        return self._bucket_name
    
    def upload_submission_file(
        self,
        file_content: BinaryIO,
        filename: str,
        submission_id: int,
        student_id: int,
        assignment_id: int
    ) -> dict:
        """
        Upload a submission file to S3
        
        Args:
            file_content: File binary content
            filename: Original filename
            submission_id: ID of the submission
            student_id: ID of the student
            assignment_id: ID of the assignment
            
        Returns:
            dict with s3_url, s3_key, and file_hash
        """
        try:
            # Generate unique S3 key
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            file_extension = Path(filename).suffix
            s3_key = f"submissions/{assignment_id}/{student_id}/{submission_id}/{filename}"
            
            # Calculate file hash
            file_content.seek(0)
            file_hash = hashlib.sha256(file_content.read()).hexdigest()
            file_content.seek(0)
            
            # Upload to S3
            self.s3_client.upload_fileobj(
                file_content,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'ContentType': self._get_content_type(file_extension),
                    'Metadata': {
                        'submission_id': str(submission_id),
                        'student_id': str(student_id),
                        'assignment_id': str(assignment_id),
                        'original_filename': filename,
                        'file_hash': file_hash
                    }
                }
            )
            
            # Generate S3 URL (quote key for special chars in filenames)
            region = getattr(settings, 'AWS_REGION', 'us-east-1') or 'us-east-1'
            s3_url = f"https://{self.bucket_name}.s3.{region}.amazonaws.com/{quote(s3_key, safe='/')}"
            
            logger.info(f"File uploaded to S3: {s3_key}")
            
            return {
                's3_url': s3_url,
                's3_key': s3_key,
                'file_hash': file_hash
            }
            
        except NoCredentialsError as e:
            logger.error(f"S3 credentials missing: {e}")
            raise Exception(
                "AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"
            ) from e
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code', 'Unknown')
            msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"S3 upload failed [{code}]: {msg}")
            raise Exception(f"S3 upload failed ({code}): {msg}") from e
    
    def download_submission_file(self, s3_key: str, local_path: str) -> str:
        """
        Download a file from S3 to local path
        
        Args:
            s3_key: S3 object key
            local_path: Local file path to save
            
        Returns:
            Local file path
        """
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # Download file
            self.s3_client.download_file(
                self.bucket_name,
                s3_key,
                local_path
            )
            
            logger.info(f"File downloaded from S3: {s3_key} to {local_path}")
            return local_path
            
        except ClientError as e:
            logger.error(f"S3 download failed: {str(e)}")
            raise Exception(f"Failed to download file from S3: {str(e)}")
    
    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """
        Generate a presigned URL for temporary file access
        
        Args:
            s3_key: S3 object key
            expiration: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Presigned URL
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return url
            
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {str(e)}")
            raise Exception(f"Failed to generate presigned URL: {str(e)}")
    
    def delete_file(self, s3_key: str) -> bool:
        """
        Delete a file from S3
        
        Args:
            s3_key: S3 object key
            
        Returns:
            True if successful
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            logger.info(f"File deleted from S3: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"S3 delete failed: {str(e)}")
            raise Exception(f"Failed to delete file from S3: {str(e)}")
    
    def list_submission_files(self, submission_id: int) -> list:
        """
        List all files for a submission
        
        Args:
            submission_id: ID of the submission
            
        Returns:
            List of file keys
        """
        try:
            prefix = f"submissions/"
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Filter by submission_id in metadata
                    head = self.s3_client.head_object(
                        Bucket=self.bucket_name,
                        Key=obj['Key']
                    )
                    if head.get('Metadata', {}).get('submission_id') == str(submission_id):
                        files.append(obj['Key'])
            
            return files
            
        except ClientError as e:
            logger.error(f"Failed to list S3 files: {str(e)}")
            return []
    
    def _get_content_type(self, file_extension: str) -> str:
        """Get content type based on file extension"""
        content_types = {
            '.py': 'text/x-python',
            '.java': 'text/x-java',
            '.js': 'application/javascript',
            '.ts': 'application/typescript',
            '.cpp': 'text/x-c++src',
            '.c': 'text/x-csrc',
            '.h': 'text/x-chdr',
            '.hpp': 'text/x-c++hdr',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
        }
        return content_types.get(file_extension.lower(), 'application/octet-stream')


# Singleton instance
s3_service = S3StorageService()
