from cryptography.fernet import Fernet
import os

# Generate a static key for the MVP (In production, load from env variables)
KEY_FILE = "secret.key"

def get_key():
    if not os.path.exists(KEY_FILE):
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as key_file:
            key_file.write(key)
    with open(KEY_FILE, "rb") as key_file:
        return key_file.read()

cipher_suite = Fernet(get_key())

def encrypt_file(file_path):
    """Encrypts a file in place using AES-256 (Fernet)"""
    with open(file_path, 'rb') as f:
        data = f.read()
    encrypted_data = cipher_suite.encrypt(data)
    with open(file_path, 'wb') as f:
        f.write(encrypted_data)

def decrypt_file(file_path, out_path=None):
    """Decrypts a file. If out_path is provided, writes to out_path, else in place."""
    with open(file_path, 'rb') as f:
        encrypted_data = f.read()
    try:
        decrypted_data = cipher_suite.decrypt(encrypted_data)
    except:
        # If it fails to decrypt, assume it's already decrypted (backward compatibility)
        decrypted_data = encrypted_data
        
    write_path = out_path if out_path else file_path
    with open(write_path, 'wb') as f:
        f.write(decrypted_data)
    return write_path
