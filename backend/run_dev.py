#!/usr/bin/env python3
"""
Development server runner for FastAPI backend.
This script configures uvicorn to only watch the backend directory,
preventing errors when node_modules or other non-Python directories are missing.
"""
import subprocess
import sys
import os

# Get the project root directory (parent of backend/)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(project_root, "backend")

# Change to project root to run uvicorn
os.chdir(project_root)

# Build uvicorn command with proper exclusions
cmd = [
    sys.executable,
    "-m",
    "uvicorn",
    "backend.fastapi_app:app",
    "--reload",
    "--host", "0.0.0.0",
    "--port", "8000",
    "--reload-exclude", "node_modules/*",
    "--reload-exclude", "apps/*",
    "--reload-exclude", "packages/*",
    "--reload-dir", "backend",
]

print("🚀 Starting FastAPI development server...")
print(f"📁 Project root: {project_root}")
print(f"📁 Watching: {backend_dir}")
print("🔧 Excluding: node_modules, apps, packages from reload watch")
print("=" * 60)

try:
    subprocess.run(cmd, check=True)
except KeyboardInterrupt:
    print("\n\n👋 Server stopped by user")
    sys.exit(0)
except subprocess.CalledProcessError as e:
    print(f"\n❌ Server error: {e}")
    sys.exit(1)


