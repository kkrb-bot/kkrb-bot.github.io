#!/usr/bin/env python3
"""
Deployment script for GitHub Pages
This script:
1. Clones/pulls the private scenario repository
2. Minifies JSON files
3. Generates manifests using build_search_chunks.py
"""

import os
import json
import shutil
import subprocess
from pathlib import Path
from typing import Optional

def run_command(cmd: list, cwd: Optional[str] = None) -> bool:
    """Run a shell command and return success status"""
    try:
        result = subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True)
        print(f"✓ {' '.join(cmd)}")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Command failed: {' '.join(cmd)}")
        print(f"Error: {e.stderr}")
        return False

def minify_json(input_file: Path, output_file: Path) -> bool:
    """Minify a JSON file"""
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        
        return True
    except Exception as e:
        print(f"✗ Failed to minify {input_file}: {e}")
        return False

def pull_scenario_repository(
    repo_url: str,
    target_dir: Path,
    github_token: Optional[str] = None
) -> bool:
    """
    Pull or clone the scenario repository
    
    Args:
        repo_url: Repository URL (SSH format for private repos)
        target_dir: Target directory for the repository
        github_token: Unused (kept for backward compatibility)
    """
    print(f"\n📥 Pulling scenario repository...")
    
    if target_dir.exists():
        # Pull if exists
        if not run_command(['git', 'pull', 'origin', 'main'], cwd=str(target_dir)):
            return False
    else:
        # Clone if doesn't exist
        target_dir.mkdir(parents=True, exist_ok=True)
        if not run_command(['git', 'clone', repo_url, str(target_dir)]):
            return False
    
    return True

def minify_scenario_files(source_dir: Path, target_dir: Path) -> bool:
    """Minify all JSON files from source to target directory, recursively"""
    print(f"\n⚙️  Minifying JSON files...")
    
    target_dir.mkdir(parents=True, exist_ok=True)
    json_files = list(source_dir.glob('**/*.json'))
    
    if not json_files:
        print(f"⚠️  No JSON files found in {source_dir}")
        return True
    
    success_count = 0
    for json_file in json_files:
        # Calculate relative path from source_dir
        relative_path = json_file.relative_to(source_dir)
        output_file = target_dir / relative_path
        # Ensure output directory exists
        output_file.parent.mkdir(parents=True, exist_ok=True)
        if minify_json(json_file, output_file):
            success_count += 1
    
    print(f"✓ Minified {success_count}/{len(json_files)} JSON files")
    return success_count == len(json_files)

def generate_manifests(source_dir: Path) -> bool:
    """Generate manifests using the generation script"""
    print(f"\n📋 Generating manifests from {source_dir}...")
    
    try:
        # Call the build_search_chunks.py script
        result = subprocess.run(
            ['python3', 'scripts/build_search_chunks.py', '--source', str(source_dir)],
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        print("✓ Manifests generated successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to generate manifests: {e.stderr}")
        return False
    except Exception as e:
        print(f"✗ Failed to generate manifests: {e}")
        return False

def generate_bundles(source_dir: Path) -> bool:
    """Generate data bundles for faster loading"""
    print(f"\n📦 Generating data bundles from {source_dir}...")
    
    try:
        # Call the build_bundles.py script
        result = subprocess.run(
            ['python3', 'scripts/build_bundles.py', '--source', str(source_dir)],
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        print("✓ Bundles generated successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to generate bundles: {e.stderr}")
        return False
    except Exception as e:
        print(f"✗ Failed to generate bundles: {e}")
        return False

def main():
    """Main deployment function"""
    print("🚀 Starting GitHub Pages deployment...\n")
    
    # Configuration
    repo_url = "git@github.com:kkrb-bot/scenario.git"  # SSH URL
    temp_dir = Path('.github/temp_scenario')  # Temporary directory for cloned repo
    target_dir = Path('public/scenario')
    github_token = os.environ.get('GITHUB_TOKEN')
    
    if not github_token:
        print("⚠️  WARNING: GITHUB_TOKEN environment variable not set")
        print("   This is required for accessing private repositories")
        print("   The deployment may fail if the scenario repository is private\n")
    else:
        print("✓ GITHUB_TOKEN is set\n")
    
    try:
        # Step 1: Pull scenario repository
        if not pull_scenario_repository(repo_url, temp_dir, github_token):
            print("❌ Failed to pull scenario repository")
            return 1
        
        # Verify temp directory exists and has content
        if not temp_dir.exists():
            print(f"❌ Temporary directory not created: {temp_dir}")
            return 1
        
        print(f"\n📁 Contents of {temp_dir}:")
        for item in temp_dir.iterdir():
            if item.is_dir():
                json_count = len(list(item.glob('**/*.json')))
                print(f"   📂 {item.name}/ ({json_count} JSON files)")
            else:
                print(f"   📄 {item.name}")
        
        # Step 2: Copy only essential metadata files to public/scenario
        print(f"\n📂 Syncing metadata to {target_dir}...")
        target_dir.mkdir(parents=True, exist_ok=True)
        metadata_files = [
            'info.json',
            'event.json',
            'card-ep.json',
            'login/campaign.json',
            'login/event.json'
        ]
        
        for meta_path in metadata_files:
            src_file = temp_dir / meta_path
            dst_file = target_dir / meta_path
            if src_file.exists():
                dst_file.parent.mkdir(parents=True, exist_ok=True)
                minify_json(src_file, dst_file)
                print(f"✓ Minified and copied {meta_path}")
            else:
                print(f"⚠️ Metadata file not found: {meta_path}")
        
        # Step 3: Generate manifests from temp_dir
        if not generate_manifests(temp_dir):
            print("❌ Failed to generate manifests")
            return 1

        # Step 4: Generate data bundles from temp_dir
        if not generate_bundles(temp_dir):
            print("❌ Failed to generate bundles")
            return 1
        
        # Cleanup temporary directory
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
            print(f"\n🧹 Cleaned up temporary directory")
        
        print("\n✅ Deployment preparation completed successfully!")
        return 0
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1

if __name__ == '__main__':
    exit(main())
