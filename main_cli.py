# main.py - Command-line interface for the file sharing system

import os
import time
import getpass
from database_operations import (
    create_tables_if_not_exist, 
    authenticate_user, 
    register_user, 
    list_user_files, 
    get_file_metadata,
    save_file_metadata,
    populate_sample_data
)
from s3_operations import create_bucket_if_not_exists, upload_file, download_file
from aws_config import MAX_FILE_SIZE

def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    """Print application header."""
    clear_screen()
    print("=" * 60)
    print("CLOUD FILE SHARING SYSTEM".center(60))
    print("=" * 60)
    print()

def login_menu():
    """Display login menu and handle user authentication."""
    while True:
        print_header()
        print("1. Login")
        print("2. Register")
        print("3. Exit")
        print()
        
        choice = input("Select an option (1-3): ")
        
        if choice == '1':
            username = input("Username: ")
            password = getpass.getpass("Password: ")
            
            success, message = authenticate_user(username, password)
            if success:
                print("\nLogin successful!")
                time.sleep(1)
                return username
            else:
                print(f"\nLogin failed: {message}")
                time.sleep(2)
        
        elif choice == '2':
            username = input("New username: ")
            while True:
                password = getpass.getpass("Password: ")
                confirm_password = getpass.getpass("Confirm password: ")
                
                if password == confirm_password:
                    break
                print("Passwords don't match. Try again.")
            
            success, message = register_user(username, password)
            if success:
                print(f"\n{message}")
                print("You can now login with your credentials.")
            else:
                print(f"\nRegistration failed: {message}")
            time.sleep(2)
        
        elif choice == '3':
            print("\nGoodbye!")
            exit(0)
        
        else:
            print("\nInvalid choice. Please try again.")
            time.sleep(1)

def file_operations_menu(username):
    """Display and handle file operations menu."""
    while True:
        print_header()
        print(f"Logged in as: {username}")
        print()
        print("1. Upload a file")
        print("2. Download a file")
        print("3. List my files")
        print("4. Logout")
        print()
        
        choice = input("Select an option (1-4): ")
        
        if choice == '1':
            upload_file_menu(username)
        
        elif choice == '2':
            download_file_menu(username)
        
        elif choice == '3':
            list_files_menu(username)
        
        elif choice == '4':
            print("\nLogging out...")
            time.sleep(1)
            return
        
        else:
            print("\nInvalid choice. Please try again.")
            time.sleep(1)

def upload_file_menu(username):
    """Handle file upload operation."""
    print_header()
    print("FILE UPLOAD".center(60))
    print("-" * 60)
    print(f"Maximum file size: {MAX_FILE_SIZE/1024/1024}MB")
    print()
    
    file_path = input("Enter the full path to the file: ")
    description = input("Enter a description (optional): ")
    
    if not os.path.exists(file_path):
        print("\nFile not found. Please check the path and try again.")
        time.sleep(2)
        return
    
    print("\nUploading file...")
    success, result = upload_file(file_path, username)
    
    if success:
        # Save metadata to DynamoDB
        metadata_success, file_id = save_file_metadata(
            result['filename'],
            result['s3_key'],
            result['size'],
            username,
            description
        )
        
        if metadata_success:
            print("\nFile uploaded successfully!")
            print(f"File ID: {file_id}")
        else:
            print(f"\nFile uploaded but metadata could not be saved: {file_id}")
    else:
        print(f"\nUpload failed: {result}")
    
    input("\nPress Enter to continue...")

def list_files_menu(username):
    """Display user's files."""
    print_header()
    print("MY FILES".center(60))
    print("-" * 60)
    
    files = list_user_files(username)
    
    if not files:
        print("You haven't uploaded any files yet.")
    else:
        print(f"{'FILE ID':<36} | {'FILENAME':<20} | {'SIZE':<10} | {'UPLOAD DATE':<20}")
        print("-" * 90)
        
        for file in files:
            size_kb = int(file['size']) / 1024
            size_display = f"{size_kb:.1f} KB"
            print(f"{file['file_id']:<36} | {file['filename']:<20} | {size_display:<10} | {file['upload_date'][:19]}")
    
    input("\nPress Enter to continue...")

def download_file_menu(username):
    """Handle file download operation."""
    print_header()
    print("FILE DOWNLOAD".center(60))
    print("-" * 60)
    
    # First list the user's files
    files = list_user_files(username)
    
    if not files:
        print("You haven't uploaded any files yet.")
        input("\nPress Enter to continue...")
        return
    
    print(f"{'#':<3} | {'FILENAME':<20} | {'SIZE':<10} | {'UPLOAD DATE':<20}")
    print("-" * 60)
    
    for i, file in enumerate(files, 1):
        size_kb = int(file['size']) / 1024
        size_display = f"{size_kb:.1f} KB"
        print(f"{i:<3} | {file['filename']:<20} | {size_display:<10} | {file['upload_date'][:19]}")
    
    print("\nEnter the number of the file you want to download (or 0 to cancel):")
    try:
        choice = int(input("> "))
        if choice == 0:
            return
        
        if 1 <= choice <= len(files):
            selected_file = files[choice-1]
            
            # Additional security check - re-authenticate
            print("\nPlease re-enter your credentials to confirm download:")
            username_check = input("Username: ")
            password = getpass.getpass("Password: ")
            
            auth_success, _ = authenticate_user(username_check, password)
            
            if auth_success and username_check == username:
                # Ask for download location
                download_dir = input("\nEnter download directory (or press Enter for current directory): ")
                if not download_dir:
                    download_dir = "."
                
                if not os.path.exists(download_dir):
                    print(f"Directory {download_dir} does not exist. Creating it...")
                    os.makedirs(download_dir, exist_ok=True)
                
                download_path = os.path.join(download_dir, selected_file['filename'])
                
                print("\nDownloading file...")
                success, message = download_file(selected_file['s3_key'], download_path)
                
                if success:
                    print(f"\nFile downloaded successfully to {download_path}")
                else:
                    print(f"\nDownload failed: {message}")
            else:
                print("\nAuthentication failed. Download cancelled.")
        else:
            print("\nInvalid selection.")
    except ValueError:
        print("\nInvalid input. Please enter a number.")
    
    input("\nPress Enter to continue...")

def initialize_system():
    """Initialize AWS resources and sample data."""
    print("Initializing system...")
    # Create DynamoDB tables
    create_tables_if_not_exist()
    
    # Create S3 bucket
    create_bucket_if_not_exists()
    
    # Populate sample data
    populate_sample_data()
    
    print("System initialized successfully.")

def main():
    """Main application entry point."""
    try:
        initialize_system()
        while True:
            username = login_menu()
            file_operations_menu(username)
    except KeyboardInterrupt:
        print("\n\nProgram terminated by user.")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {str(e)}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()
