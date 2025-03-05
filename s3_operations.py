# s3_operations.py - S3 operations for file storage

import os
import boto3
from botocore.exceptions import ClientError
from aws_config import AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, S3_BUCKET_NAME, MAX_FILE_SIZE

# Initialize S3 client
s3_client = boto3.client(
    's3',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY
)

def create_bucket_if_not_exists():
    """Create S3 bucket if it doesn't exist."""
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET_NAME)
        print(f"S3 bucket '{S3_BUCKET_NAME}' already exists")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            # Bucket doesn't exist, create it
            try:
                if AWS_REGION == 'ap-south-1':
                    s3_client.create_bucket(Bucket=S3_BUCKET_NAME)
                else:
                    s3_client.create_bucket(
                        Bucket=S3_BUCKET_NAME,
                        CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                    )
                print(f"Created S3 bucket: {S3_BUCKET_NAME}")
            except Exception as create_error:
                print(f"Error creating bucket: {str(create_error)}")
                return False
        else:
            print(f"Error checking bucket: {str(e)}")
            return False
    
    return True

def upload_file(file_path, username):
    """Upload a file to S3."""
    if not os.path.exists(file_path):
        return False, "File does not exist"
    
    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE:
        return False, f"File exceeds maximum size limit of {MAX_FILE_SIZE/1024/1024}MB"
    
    try:
        filename = os.path.basename(file_path)
        s3_key = f"{username}/{filename}"
        
        s3_client.upload_file(file_path, S3_BUCKET_NAME, s3_key)
        return True, {"s3_key": s3_key, "size": file_size, "filename": filename}
    except Exception as e:
        return False, f"Upload error: {str(e)}"

def download_file(s3_key, download_path):
    """Download a file from S3."""
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(download_path), exist_ok=True)
        
        s3_client.download_file(S3_BUCKET_NAME, s3_key, download_path)
        return True, f"File downloaded successfully to {download_path}"
    except Exception as e:
        return False, f"Download error: {str(e)}"
