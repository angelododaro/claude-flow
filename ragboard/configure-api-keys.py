#!/usr/bin/env python3
"""
RAGBOARD API Key Configuration Helper
This script helps you properly configure API keys for RAGBOARD
"""

import os
import sys
from pathlib import Path
import shutil
from datetime import datetime

def print_header():
    print("=" * 60)
    print("🔑 RAGBOARD API Key Configuration Helper")
    print("=" * 60)
    print()

def check_env_files():
    """Check which .env files exist"""
    backend_env = Path("backend/.env")
    backend_env_example = Path("backend/.env.example")
    root_env_local = Path(".env.local")
    
    print("📁 Checking environment files...")
    print(f"   backend/.env: {'✅ Exists' if backend_env.exists() else '❌ Not found'}")
    print(f"   .env.local: {'✅ Exists' if root_env_local.exists() else '❌ Not found'}")
    print()
    
    return backend_env, backend_env_example, root_env_local

def read_env_file(filepath):
    """Read and parse .env file"""
    env_vars = {}
    if filepath.exists():
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars

def update_backend_env(backend_env, api_keys):
    """Update backend .env file with API keys"""
    # Backup existing file
    if backend_env.exists():
        backup_path = backend_env.with_suffix('.env.backup.' + datetime.now().strftime('%Y%m%d_%H%M%S'))
        shutil.copy(backend_env, backup_path)
        print(f"📦 Backed up existing .env to: {backup_path}")
    
    # Read existing content
    existing_content = []
    existing_keys = set()
    
    if backend_env.exists():
        with open(backend_env, 'r') as f:
            for line in f:
                stripped = line.strip()
                if stripped and '=' in stripped and not stripped.startswith('#'):
                    key = stripped.split('=', 1)[0].strip()
                    if key in api_keys:
                        # Replace with new value
                        existing_content.append(f"{key}={api_keys[key]}\n")
                        existing_keys.add(key)
                    else:
                        existing_content.append(line)
                else:
                    existing_content.append(line)
    
    # Add new keys that weren't in the file
    new_keys = []
    for key, value in api_keys.items():
        if key not in existing_keys and value:
            new_keys.append(f"{key}={value}\n")
    
    # Write updated content
    with open(backend_env, 'w') as f:
        f.writelines(existing_content)
        if new_keys:
            f.write("\n# API Keys added by configuration script\n")
            f.writelines(new_keys)
    
    print(f"✅ Updated backend/.env with API keys")

def main():
    print_header()
    
    # Change to RAGBOARD directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check environment files
    backend_env, backend_env_example, root_env_local = check_env_files()
    
    # Read .env.local for any existing keys
    print("🔍 Checking for API keys in .env.local...")
    env_local_vars = read_env_file(root_env_local)
    
    api_keys = {}
    
    # Check for keys in .env.local
    key_mapping = {
        'VITE_OPENAI_API_KEY': 'OPENAI_API_KEY',
        'VITE_CLAUDE_API_KEY': 'ANTHROPIC_API_KEY',
        'OPENAI_API_KEY': 'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY': 'ANTHROPIC_API_KEY',
        'LANGCHAIN_API_KEY': 'LANGCHAIN_API_KEY',
        'REQUESTY_API_KEY': 'REQUESTY_API_KEY'
    }
    
    for local_key, backend_key in key_mapping.items():
        if local_key in env_local_vars and env_local_vars[local_key]:
            api_keys[backend_key] = env_local_vars[local_key]
            print(f"   Found {backend_key}")
    
    # Interactive input for missing keys
    print("\n📝 Enter your API keys (press Enter to skip):")
    
    required_keys = [
        ('OPENAI_API_KEY', 'OpenAI API Key (starts with sk-)'),
        ('ANTHROPIC_API_KEY', 'Anthropic API Key (starts with sk-ant-)'),
        ('LANGCHAIN_API_KEY', 'LangChain API Key (optional, starts with lsv2_pt_)'),
        ('REQUESTY_API_KEY', 'Requesty API Key (optional, starts with sk-)')
    ]
    
    for key, description in required_keys:
        if key not in api_keys or not api_keys[key]:
            value = input(f"   {description}: ").strip()
            if value:
                api_keys[key] = value
    
    # Update backend .env file
    if api_keys:
        print("\n🔧 Updating backend configuration...")
        
        # Create backend .env if it doesn't exist
        if not backend_env.exists() and backend_env_example.exists():
            shutil.copy(backend_env_example, backend_env)
            print("   Created backend/.env from template")
        
        update_backend_env(backend_env, api_keys)
        
        print("\n✅ Configuration complete!")
        print("\n🚀 To start RAGBOARD, run:")
        print("   ./launch.sh")
    else:
        print("\n⚠️  No API keys configured.")
        print("   RAGBOARD will run but AI features will be disabled.")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()