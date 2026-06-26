#!/usr/bin/env python3
"""
DeadlineZero - Production Deployment & Packaging Utility
This script automates production builds, verifies system integrity,
packages application assets, and provides direct guides for Google Cloud Run deployment.
"""

import os
import sys
import json
import shutil
import subprocess
import zipfile
from datetime import datetime

# ANSI escape codes for beautiful terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log_info(message):
    print(f"{Colors.BLUE}[INFO]{Colors.ENDC} {message}")

def log_success(message):
    print(f"{Colors.GREEN}[SUCCESS]{Colors.ENDC} {Colors.BOLD}{message}{Colors.ENDC}")

def log_warning(message):
    print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} {message}")

def log_error(message):
    print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {message}")

def print_banner():
    banner = f"""
{Colors.HEADER}{Colors.BOLD}=============================================================
             DEADLINEZERO DEPLOYMENT ENGINE
============================================================={Colors.ENDC}
This automated script validates, builds, packages, and prepares
your application for cloud production hosting.
"""
    print(banner)

def check_system_requirements():
    log_info("Verifying system dependencies...")
    
    # Check for Node.js / NPM
    try:
        node_ver = subprocess.run(["node", "--version"], capture_output=True, text=True, check=True)
        npm_ver = subprocess.run(["npm", "--version"], capture_output=True, text=True, check=True)
        log_success(f"Node.js found: {node_ver.stdout.strip()}")
        log_success(f"NPM found: {npm_ver.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        log_error("Node.js and npm are required to compile this application. Please install them first.")
        return False
    return True

def run_production_build():
    log_info("Initiating production compilation (npm run build)...")
    try:
        # Run npm run build
        result = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
        if result.returncode != 0:
            log_error("Build compilation failed!")
            print(result.stderr)
            return False
        
        # Verify compiled build output
        if os.path.exists("dist") and os.path.exists("dist/server.cjs"):
            log_success("Production build compiled successfully! Output generated in /dist")
            return True
        else:
            log_error("Build completed, but expected output files (dist/server.cjs) were not found.")
            return False
    except Exception as e:
        log_error(f"An unexpected error occurred during building: {e}")
        return False

def package_application():
    log_info("Packaging application into workspace archive...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"deadlinezero_release_{timestamp}.zip"
    
    files_to_include = [
        "package.json",
        "package-lock.json",
        "server.ts",
        "tsconfig.json",
        "vite.config.ts",
        "metadata.json",
        ".env.example"
    ]
    
    dirs_to_include = [
        "dist",
        "assets"
    ]

    try:
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Write key configuration files
            for file in files_to_include:
                if os.path.exists(file):
                    zipf.write(file)
                    log_info(f" -> Added file: {file}")
                else:
                    log_warning(f"Optional file '{file}' not found, skipping.")
            
            # Write compiled directories
            for directory in dirs_to_include:
                if os.path.exists(directory):
                    for root, _, files in os.walk(directory):
                        for file in files:
                            file_path = os.path.join(root, file)
                            zipf.write(file_path, os.path.relpath(file_path, '.'))
                    log_info(f" -> Added folder: {directory}/")
                    
        log_success(f"Release package archived successfully: {zip_filename}")
        return zip_filename
    except Exception as e:
        log_error(f"Failed to create ZIP package: {e}")
        return None

def display_cloud_run_guide():
    guide = f"""
{Colors.HEADER}{Colors.BOLD}=============================================================
          HOW TO DEPLOY TO GOOGLE CLOUD RUN
============================================================={Colors.ENDC}
This full-stack React + Express app is fully configured for seamless 
hosting on Google Cloud Run. Follow these simple steps:

{Colors.BOLD}Prerequisites:{Colors.ENDC}
1. Install the Google Cloud SDK (gcloud CLI) on your machine.
2. Initialize and authenticate with your GCP Project:
   {Colors.BLUE}gcloud init{Colors.ENDC}

{Colors.BOLD}Step 1: Build & Deploy Container Directly from Source{Colors.ENDC}
Run the following single command in your project root folder:
   {Colors.BLUE}gcloud run deploy deadlinezero --source . --port 3000 --allow-unauthenticated{Colors.ENDC}

{Colors.BOLD}Step 2: Setup Environment Variables (Optional){Colors.ENDC}
If you configure custom servers or external backend services:
   {Colors.BLUE}gcloud run services update deadlinezero --set-env-vars NODE_ENV=production{Colors.ENDC}

=============================================================
"""
    print(guide)

def main():
    print_banner()
    
    if not check_system_requirements():
        sys.exit(1)
        
    print()
    log_info("Starting release process...")
    
    if not run_production_build():
        sys.exit(1)
        
    print()
    zip_file = package_application()
    
    print()
    if zip_file:
        log_success("All checks and compilation tasks completed successfully!")
    else:
        log_warning("Compilation succeeded, but packaging encountered minor issues.")
        
    display_cloud_run_guide()

if __name__ == "__main__":
    main()
