# db_operations.py - Database operations for user management and file metadata

import boto3
import hashlib
import datetime
import uuid
from aws_config import AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, USER_TABLE_NAME, FILE_TABLE_NAME

# Initialize DynamoDB client
dynamodb = boto3.resource(
    'dynamodb',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY
)

# Connect to tables
user_table = dynamodb.Table(USER_TABLE_NAME)
file_table = dynamodb.Table(FILE_TABLE_NAME)


def create_tables_if_not_exist():
    """Create DynamoDB tables if they don't exist."""
    existing_tables = [table.name for table in list(dynamodb.tables.all())]

    if USER_TABLE_NAME not in existing_tables:
        print(f"Creating user table: {USER_TABLE_NAME}")
        dynamodb.create_table(
            TableName=USER_TABLE_NAME,
            KeySchema=[
                {'AttributeName': 'username', 'KeyType': 'HASH'}  # Primary key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'username', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
        )
        # Wait for table to be created
        waiter = dynamodb.meta.client.get_waiter('table_exists')
        waiter.wait(TableName=USER_TABLE_NAME)

    if FILE_TABLE_NAME not in existing_tables:
        print(f"Creating file table: {FILE_TABLE_NAME}")
        try:
            dynamodb.create_table(
                TableName=FILE_TABLE_NAME,
                KeySchema=[
                    {'AttributeName': 'file_id', 'KeyType': 'HASH'}  # Primary key
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'file_id', 'AttributeType': 'S'},
                    {'AttributeName': 'owner', 'AttributeType': 'S'}
                ],
                GlobalSecondaryIndexes=[
                    {
                        'IndexName': 'OwnerIndex',
                        'KeySchema': [
                            {'AttributeName': 'owner', 'KeyType': 'HASH'},
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
                    }
                ],
                ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            )
            # Wait for table to be created
            waiter = dynamodb.meta.client.get_waiter('table_exists')
            waiter.wait(TableName=FILE_TABLE_NAME)
        except Exception as e:
            print(f"Error creating file table: {str(e)}")

    print("Tables are ready")


def hash_password(password):
    """Hash a password for storage."""
    return hashlib.sha256(password.encode()).hexdigest()


def register_user(username, password):
    """Register a new user."""
    try:
        user_exists = get_user(username)
        if user_exists:
            return False, "Username already exists"

        # Use 'username' as the key name to match table schema
        user_table.put_item(
            Item={
                'username': username,  # This matches the key schema
                'password_hash': hash_password(password),
                'created_at': datetime.datetime.now().isoformat(),
                'last_login': datetime.datetime.now().isoformat()
            }
        )
        return True, "User registered successfully"
    except Exception as e:
        return False, f"Error registering user: {str(e)}"


def authenticate_user(username, password):
    """Authenticate a user."""
    try:
        user = get_user(username)
        if not user:
            return False, "User not found"

        if user['password_hash'] == hash_password(password):
            # Update last login time
            user_table.update_item(
                Key={'username': username},
                UpdateExpression="set last_login=:t",
                ExpressionAttributeValues={':t': datetime.datetime.now().isoformat()},
                ReturnValues="UPDATED_NEW"
            )
            return True, "Authentication successful"
        else:
            return False, "Incorrect password"
    except Exception as e:
        return False, f"Authentication error: {str(e)}"


def get_user(username):
    """Get user details."""
    try:
        response = user_table.get_item(Key={'username': username})
        return response.get('Item')
    except Exception as e:
        print(f"Error getting user: {str(e)}")
        return None


def save_file_metadata(filename, s3_key, file_size, owner, description=""):
    """Save file metadata to DynamoDB."""
    file_id = str(uuid.uuid4())
    try:
        file_table.put_item(
            Item={
                'file_id': file_id,
                'filename': filename,
                's3_key': s3_key,
                'size': file_size,
                'upload_date': datetime.datetime.now().isoformat(),
                'owner': owner,
                'description': description
            }
        )
        return True, file_id
    except Exception as e:
        return False, f"Error saving file metadata: {str(e)}"


def get_file_metadata(file_id):
    """Get file metadata by ID."""
    try:
        response = file_table.get_item(Key={'file_id': file_id})
        return response.get('Item')
    except Exception:
        return None


def list_user_files(username):
    """List all files owned by a user."""
    try:
        response = file_table.query(
            IndexName='OwnerIndex',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('owner').eq(username)
        )
        return response.get('Items', [])
    except Exception as e:
        print(f"Error listing user files: {str(e)}")
        return []


# Function to populate sample data
def populate_sample_data():
    """Populate sample users and files for testing."""
    # Sample users
    sample_users = [
        {'username': 'alice', 'password': 'pass123'},
        {'username': 'bob', 'password': 'secure456'},
        {'username': 'charlie', 'password': 'charlie789'}
    ]

    for user in sample_users:
        success, message = register_user(user['username'], user['password'])
        print(f"Adding user {user['username']}: {message}")

    print("Sample data populated successfully")