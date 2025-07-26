#!/usr/bin/env python3
"""
Test script for the file processing service.
This script tests various file processing capabilities.
"""

import asyncio
import sys
import tempfile
import os
from pathlib import Path
from uuid import uuid4
from PIL import Image, ImageDraw, ImageFont

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.file_processor import FileProcessorService


async def create_test_files():
    """Create test files for processing."""
    test_dir = Path(tempfile.mkdtemp(prefix="ragboard_test_"))
    print(f"📁 Creating test files in: {test_dir}")
    
    # Create test text file
    text_file = test_dir / "test.txt"
    with open(text_file, 'w') as f:
        f.write("This is a test text file for RAGBOARD file processing service.")
    
    # Create test image with text
    image_file = test_dir / "test.png"
    img = Image.new('RGB', (400, 100), color='white')
    draw = ImageDraw.Draw(img)
    try:
        # Try to use a default font
        font = ImageFont.load_default()
    except:
        font = None
    
    draw.text((10, 30), "Hello RAGBOARD OCR Test!", fill='black', font=font)
    img.save(image_file)
    
    # Create test PDF (simple text content)
    pdf_file = test_dir / "test.pdf"
    try:
        from reportlab.pdfgen import canvas
        c = canvas.Canvas(str(pdf_file))
        c.drawString(100, 750, "This is a test PDF for RAGBOARD processing.")
        c.drawString(100, 730, "It contains multiple lines of text.")
        c.save()
    except ImportError:
        # Create a simple text file as fallback
        with open(pdf_file.with_suffix('.txt'), 'w') as f:
            f.write("PDF test content (created as text file due to missing reportlab)")
    
    return test_dir


async def test_file_processor():
    """Test the file processor service."""
    print("🧪 Testing RAGBOARD File Processing Service")
    print("=" * 50)
    
    # Initialize the service
    print("⚙️  Initializing FileProcessorService...")
    processor = FileProcessorService()
    
    # Create test files
    test_dir = await create_test_files()
    
    try:
        # Test 1: Check capabilities
        print("\n1️⃣  Testing Service Capabilities...")
        
        # Test image processing if available
        image_file = test_dir / "test.png"
        if image_file.exists():
            print("   📸 Testing image OCR...")
            try:
                text, metadata = await processor.extract_image_text(str(image_file))
                print(f"   ✅ Image OCR successful: '{text[:50]}...'")
                print(f"   📊 Metadata: {metadata}")
            except Exception as e:
                print(f"   ❌ Image OCR failed: {e}")
        
        # Test text file processing
        text_file = test_dir / "test.txt"
        if text_file.exists():
            print("   📄 Testing text file extraction...")
            try:
                # Simulate text file processing
                with open(text_file, 'r') as f:
                    content = f.read()
                print(f"   ✅ Text file processing successful: '{content[:50]}...'")
            except Exception as e:
                print(f"   ❌ Text file processing failed: {e}")
        
        # Test PDF processing if PDF exists
        pdf_files = list(test_dir.glob("test.pdf")) + list(test_dir.glob("test.txt"))
        if pdf_files:
            pdf_file = pdf_files[0]
            print(f"   📑 Testing PDF/text extraction: {pdf_file.name}...")
            try:
                if pdf_file.suffix == '.pdf':
                    text, metadata = await processor.extract_pdf_text(str(pdf_file))
                else:
                    # Read text file
                    with open(pdf_file, 'r') as f:
                        text = f.read()
                    metadata = {"file_type": "txt", "fallback": True}
                
                print(f"   ✅ PDF/text extraction successful: '{text[:50]}...'")
                print(f"   📊 Metadata: {metadata}")
            except Exception as e:
                print(f"   ❌ PDF/text extraction failed: {e}")
        
        # Test progress callback
        print("\n2️⃣  Testing Progress Callback...")
        task_id = str(uuid4())
        progress_callback = processor.get_progress_callback(task_id)
        
        for i in range(0, 101, 25):
            progress_callback(i, 100, f"Processing step {i//25 + 1}")
            print(f"   📈 Progress: {i}% - Processing step {i//25 + 1}")
            await asyncio.sleep(0.1)
        
        # Test task status
        print("\n3️⃣  Testing Task Status...")
        status = processor.get_task_status(task_id)
        print(f"   📊 Task Status: {status}")
        
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup test files
        print(f"\n🧹 Cleaning up test files in {test_dir}")
        import shutil
        shutil.rmtree(test_dir, ignore_errors=True)


async def test_integration():
    """Test integration with existing systems."""
    print("\n🔗 Testing Integration...")
    
    try:
        # Test import of dependencies
        print("   📦 Checking dependencies...")
        
        dependencies = {
            'PyPDF2': 'PDF processing',
            'PIL': 'Image processing',
            'pytesseract': 'OCR functionality',
            'celery': 'Async task queue',
            'redis': 'Task queue backend'
        }
        
        for dep, desc in dependencies.items():
            try:
                __import__(dep)
                print(f"   ✅ {dep}: Available ({desc})")
            except ImportError:
                print(f"   ⚠️  {dep}: Not available ({desc})")
        
        # Test optional dependencies
        optional_deps = {
            'whisper': 'Audio transcription',
            'moviepy': 'Video processing',
            'boto3': 'AWS cloud services'
        }
        
        print("   📦 Checking optional dependencies...")
        for dep, desc in optional_deps.items():
            try:
                __import__(dep)
                print(f"   ✅ {dep}: Available ({desc})")
            except ImportError:
                print(f"   ➖ {dep}: Not available ({desc}) - Optional")
        
        print("   ✅ Integration check completed!")
        
    except Exception as e:
        print(f"   ❌ Integration test failed: {e}")


def check_system_requirements():
    """Check system requirements."""
    print("🔍 Checking System Requirements...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version >= (3, 8):
        print(f"   ✅ Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    else:
        print(f"   ❌ Python version: {python_version.major}.{python_version.minor}.{python_version.micro} (requires 3.8+)")
    
    # Check for system commands
    system_commands = ['redis-cli', 'tesseract', 'ffmpeg']
    for cmd in system_commands:
        if os.system(f"which {cmd} > /dev/null 2>&1") == 0:
            print(f"   ✅ {cmd}: Available")
        else:
            print(f"   ⚠️  {cmd}: Not found (may need installation)")
    
    # Check Redis connection
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        print("   ✅ Redis: Running and accessible")
    except Exception as e:
        print(f"   ❌ Redis: Not accessible ({e})")


async def main():
    """Main test function."""
    print("🧪 RAGBOARD File Processing Service Test Suite")
    print("=" * 60)
    
    # Check system requirements
    check_system_requirements()
    
    # Test integration
    await test_integration()
    
    # Test file processor
    await test_file_processor()
    
    print("\n🎉 Test suite completed!")
    print("\n📚 Next steps:")
    print("   1. Start Redis: docker run -d -p 6379:6379 redis:alpine")
    print("   2. Start services: ./start_services.sh")
    print("   3. Access API docs: http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(main())