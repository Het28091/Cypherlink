# config.py - AWS credentials and configuration

# AWS credentials
AWS_ACCESS_KEY = "AKIA2HVQ5GDQ5S2CTF66"
AWS_SECRET_KEY = "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"
AWS_REGION = "ap-south-1"

# S3 configuration
S3_BUCKET_NAME = 'cypherlink-files'

# DynamoDB configuration
USER_TABLE_NAME = 'Users'
FILE_TABLE_NAME = 'Files'

# File size limit (in bytes) - 100MB
MAX_FILE_SIZE = 100 * 1024 * 1024
