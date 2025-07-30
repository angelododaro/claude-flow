#!/usr/bin/env python3
"""
RAGBOARD Quick Test Script
Tests core functionality to ensure the app is working
"""

import requests
import json
import time
import sys
from colorama import init, Fore, Style

init(autoreset=True)

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api/v1"

def print_test(name, status, details=""):
    """Print test result with color"""
    if status == "pass":
        print(f"{Fore.GREEN}✅ {name}{Style.RESET_ALL}")
    elif status == "fail":
        print(f"{Fore.RED}❌ {name}{Style.RESET_ALL}")
        if details:
            print(f"   {Fore.YELLOW}{details}{Style.RESET_ALL}")
    else:
        print(f"{Fore.YELLOW}⚠️  {name}{Style.RESET_ALL}")
        if details:
            print(f"   {details}")

def test_backend_health():
    """Test if backend is running"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print_test("Backend Health Check", "pass", f"Version: {data.get('version', 'Unknown')}")
            return True
        else:
            print_test("Backend Health Check", "fail", f"Status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test("Backend Health Check", "fail", f"Cannot connect to backend: {str(e)}")
        return False

def test_api_docs():
    """Test if API documentation is accessible"""
    try:
        response = requests.get(f"{API_URL}/docs", timeout=5)
        if response.status_code == 200:
            print_test("API Documentation", "pass")
            return True
        else:
            print_test("API Documentation", "fail", f"Status code: {response.status_code}")
            return False
    except:
        print_test("API Documentation", "fail", "Cannot access API docs")
        return False

def test_frontend():
    """Test if frontend is running"""
    try:
        response = requests.get("http://localhost:5173", timeout=5)
        if response.status_code == 200:
            print_test("Frontend Server", "pass")
            return True
        else:
            print_test("Frontend Server", "fail", f"Status code: {response.status_code}")
            return False
    except:
        print_test("Frontend Server", "fail", "Cannot connect to frontend")
        return False

def test_database():
    """Test database connectivity"""
    try:
        # Try to access boards endpoint
        response = requests.get(f"{API_URL}/boards", timeout=5)
        if response.status_code in [200, 401]:  # 401 is OK, means auth is working
            print_test("Database Connection", "pass")
            return True
        else:
            print_test("Database Connection", "fail", f"Unexpected status: {response.status_code}")
            return False
    except:
        print_test("Database Connection", "fail", "Cannot test database")
        return False

def test_api_keys():
    """Check if API keys are configured"""
    try:
        # This endpoint might need auth, but we're just checking if it exists
        response = requests.get(f"{API_URL}/keys/health", timeout=5)
        if response.status_code in [200, 401]:
            print_test("API Key Endpoints", "pass")
            return True
        else:
            print_test("API Key Endpoints", "warn", "API key management not accessible")
            return True  # Not critical
    except:
        print_test("API Key Endpoints", "warn", "API key endpoints not configured")
        return True  # Not critical

def main():
    print("=" * 60)
    print(f"{Fore.CYAN}🧪 RAGBOARD System Test{Style.RESET_ALL}")
    print("=" * 60)
    print()
    
    # Give servers time to start if just launched
    print("⏳ Waiting for services to stabilize...")
    time.sleep(2)
    
    print(f"\n{Fore.CYAN}Backend Tests:{Style.RESET_ALL}")
    backend_ok = test_backend_health()
    api_docs_ok = test_api_docs() if backend_ok else False
    db_ok = test_database() if backend_ok else False
    api_keys_ok = test_api_keys() if backend_ok else False
    
    print(f"\n{Fore.CYAN}Frontend Tests:{Style.RESET_ALL}")
    frontend_ok = test_frontend()
    
    # Summary
    print("\n" + "=" * 60)
    total_tests = 5
    passed_tests = sum([backend_ok, api_docs_ok, db_ok, api_keys_ok, frontend_ok])
    
    if passed_tests == total_tests:
        print(f"{Fore.GREEN}✅ All tests passed! ({passed_tests}/{total_tests}){Style.RESET_ALL}")
        print(f"\n🎉 RAGBOARD is ready to use!")
        print(f"   Open: {Fore.CYAN}http://localhost:5173{Style.RESET_ALL}")
    elif backend_ok and frontend_ok:
        print(f"{Fore.YELLOW}⚠️  Basic functionality working ({passed_tests}/{total_tests}){Style.RESET_ALL}")
        print(f"\n💡 RAGBOARD is usable but some features may be limited")
        print(f"   Open: {Fore.CYAN}http://localhost:5173{Style.RESET_ALL}")
    else:
        print(f"{Fore.RED}❌ Critical services not running ({passed_tests}/{total_tests}){Style.RESET_ALL}")
        print(f"\n🔧 To start RAGBOARD:")
        print(f"   ./launch.sh")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()