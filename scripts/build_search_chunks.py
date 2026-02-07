#!/usr/bin/env python3
"""
Build compressed search data chunks
Compacts all scenario JSONs, splits into ~4MB chunks, and compresses with gzip
"""

import os
import json
import gzip
from pathlib import Path
from datetime import datetime

# Target chunk size (uncompressed): ~4MB
CHUNK_SIZE_BYTES = 4 * 1024 * 1024

def extract_dialogues_recursive(dialogue_list, scenario_type, scenario_id, all_dialogues, title=''):
    """Recursively extract dialogues from list, handling branches"""
    for item in dialogue_list:
        if isinstance(item, list) and len(item) == 2:
            # Normal dialogue: [speaker, content]
            speaker, content = item
            all_dialogues.append({
                'scenarioType': scenario_type,
                'scenarioId': scenario_id,
                'speaker': speaker,
                'content': content,
                'title': title
            })
        elif isinstance(item, dict) and 'branch' in item:
            # Branch structure: {"branch": [[choice_text, [dialogues]], ...]}
            for branch_option in item['branch']:
                if isinstance(branch_option, list) and len(branch_option) >= 2:
                    # branch_option[0] is choice text, branch_option[1] is dialogue list
                    choice_text = branch_option[0]
                    branch_dialogues = branch_option[1]
                    
                    # Add choice text as a dialogue entry
                    all_dialogues.append({
                        'scenarioType': scenario_type,
                        'scenarioId': scenario_id,
                        'speaker': '選択肢',
                        'content': choice_text,
                        'title': title
                    })
                    
                    # Recursively process branch dialogues
                    if isinstance(branch_dialogues, list):
                        extract_dialogues_recursive(branch_dialogues, scenario_type, scenario_id, all_dialogues, title)

def load_all_dialogues():
    """Load all dialogue data from scenario files"""
    base_path = Path('public/scenario')
    types = ['main', 'card', 'event', 'love', 'caulis']
    special_types = ['ep', 'campaign', 'login-event']
    
    all_dialogues = []
    event_names = {}
    
    # Handle regular types
    for scenario_type in types:
        type_path = base_path / scenario_type
        
        if not type_path.exists():
            print(f"Warning: {type_path} does not exist")
            continue
        
        if scenario_type == 'caulis':
            json_files = sorted(type_path.glob('caulis_story_*.json'))
        else:
            json_files = sorted(type_path.glob('scenario_*.json'))
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Extract scenario ID from filename
                if scenario_type == 'caulis':
                    scenario_id = json_file.stem.replace('caulis_story_', '')
                else:
                    scenario_id = json_file.stem.replace(f'scenario_{scenario_type}_', '')
                
                # Extract event names for event and caulis types
                if scenario_type in ['event', 'caulis'] and 'Title' in data:
                    title_parts = data['Title'].split('|')
                    event_title = title_parts[0].replace('<br>', ' ').strip()
                    event_id = int(scenario_id.split('-')[0])
                    if event_id not in event_names:
                        event_names[event_id] = event_title
                
                # Extract dialogues (with branch support)
                if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                    title = data.get('Title', '')
                    extract_dialogues_recursive(data['Dialogue'], scenario_type, scenario_id, all_dialogues, title)
            
            except Exception as e:
                print(f"Error processing {json_file}: {e}")
                continue
    
    # Handle special types
    for scenario_type in special_types:
        if scenario_type == 'ep':
            # Handle ep subdirectories
            subdirs = ['spot', 'chara', 'special', 'card']
            for subdir in subdirs:
                sub_path = base_path / scenario_type / subdir
                if not sub_path.exists():
                    continue
                
                if subdir == 'special':
                    # Special handling for special subdirectories (1st, 2nd)
                    for special_subdir in ['1st', '2nd']:
                        special_path = sub_path / special_subdir
                        if not special_path.exists():
                            continue
                        
                        json_files = sorted(special_path.glob('iku_epi_*.json'))
                        for json_file in json_files:
                            try:
                                with open(json_file, 'r', encoding='utf-8') as f:
                                    data = json.load(f)
                                
                                # Extract scenario ID from filename
                                filename = json_file.stem  # iku_epi_XXXXX
                                scenario_id = filename.replace('iku_epi_', '')
                                
                                # Extract dialogues
                                if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                                    title = data.get('Title', '')
                                    extract_dialogues_recursive(data['Dialogue'], f'ep-special-{special_subdir}', scenario_id, all_dialogues, title)
                            
                            except Exception as e:
                                print(f"Error processing {json_file}: {e}")
                                continue
                else:
                    # Handle other subdirs (spot, chara, card) directly
                    json_files = sorted(sub_path.glob('iku_epi_*.json'))
                    for json_file in json_files:
                        try:
                            with open(json_file, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                            
                            # Extract scenario ID from filename
                            filename = json_file.stem  # iku_epi_XXXXX
                            scenario_id = filename.replace('iku_epi_', '')
                            
                            # Extract dialogues
                            if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                                title = data.get('Title', '')
                                extract_dialogues_recursive(data['Dialogue'], f'ep-{subdir}', scenario_id, all_dialogues, title)
                        
                        except Exception as e:
                            print(f"Error processing {json_file}: {e}")
                            continue
        elif scenario_type == 'campaign':
            # Handle campaign (login stories)
            campaign_path = base_path / 'login' / 'campaign'
            if not campaign_path.exists():
                continue
            
            json_files = sorted(campaign_path.glob('scenario_login_*.json'))
            for json_file in json_files:
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # Extract scenario ID from filename
                    filename = json_file.stem  # scenario_login_XXXXX
                    scenario_id = filename.replace('scenario_login_', '')
                    
                    # Extract dialogues
                    if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                        title = data.get('Title', '')
                        extract_dialogues_recursive(data['Dialogue'], 'campaign', scenario_id, all_dialogues, title)
                
                except Exception as e:
                    print(f"Error processing {json_file}: {e}")
                    continue
        elif scenario_type == 'login-event':
            # Handle login event stories
            event_path = base_path / 'login' / 'event'
            if not event_path.exists():
                continue
            
            json_files = sorted(event_path.glob('scenario_login_*.json'))
            for json_file in json_files:
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # Extract scenario ID from filename
                    filename = json_file.stem  # scenario_login_XXXXX
                    scenario_id = filename.replace('scenario_login_', '')
                    
                    # Extract dialogues
                    if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                        title = data.get('Title', '')
                        extract_dialogues_recursive(data['Dialogue'], 'login-event', scenario_id, all_dialogues, title)
                
                except Exception as e:
                    print(f"Error processing {json_file}: {e}")
                    continue
    
    return all_dialogues, event_names

def split_into_chunks(dialogues, chunk_size_bytes):
    """Split dialogues into chunks of approximately chunk_size_bytes"""
    chunks = []
    current_chunk = []
    current_size = 0
    
    # Estimate size as JSON string
    for dialogue in dialogues:
        dialogue_json = json.dumps(dialogue, ensure_ascii=False)
        dialogue_size = len(dialogue_json.encode('utf-8'))
        
        # If adding this dialogue exceeds chunk size, start new chunk
        if current_size + dialogue_size > chunk_size_bytes and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            current_size = 0
        
        current_chunk.append(dialogue)
        current_size += dialogue_size
    
    # Add remaining dialogues
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

def compress_and_save_chunks(chunks, event_names, version):
    """Compress chunks with brotli and save to disk"""
    output_dir = Path('public/data/chunks')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    chunk_manifest = {
        'version': version,
        'timestamp': datetime.now().isoformat(),
        'totalChunks': len(chunks),
        'chunks': []
    }
    
    total_uncompressed = 0
    total_compressed = 0
    
    for idx, chunk in enumerate(chunks):
        chunk_data = {
            'dialogues': chunk,
            'chunkIndex': idx,
            'totalChunks': len(chunks)
        }
        
        # Compact JSON (no indentation)
        json_str = json.dumps(chunk_data, ensure_ascii=False, separators=(',', ':'))
        json_bytes = json_str.encode('utf-8')
        
        # Compress with gzip (compression level 9 for maximum compression)
        compressed = gzip.compress(json_bytes, compresslevel=9)
        
        # Save compressed chunk
        chunk_filename = f'search-chunk-{idx}.gz'
        chunk_path = output_dir / chunk_filename
        
        with open(chunk_path, 'wb') as f:
            f.write(compressed)
        
        uncompressed_size = len(json_bytes)
        compressed_size = len(compressed)
        compression_ratio = (1 - compressed_size / uncompressed_size) * 100
        
        total_uncompressed += uncompressed_size
        total_compressed += compressed_size
        
        chunk_manifest['chunks'].append({
            'filename': chunk_filename,
            'index': idx,
            'uncompressedSize': uncompressed_size,
            'compressedSize': compressed_size,
            'dialogueCount': len(chunk)
        })
        
        print(f"Chunk {idx}: {len(chunk)} dialogues, "
              f"{uncompressed_size / 1024 / 1024:.2f}MB -> "
              f"{compressed_size / 1024:.2f}KB "
              f"({compression_ratio:.1f}% reduction)")
    
    # Add event names to manifest
    chunk_manifest['eventNames'] = event_names
    chunk_manifest['totalCompressedSize'] = total_compressed
    
    # Save manifest
    manifest_path = output_dir / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(chunk_manifest, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== Summary ===")
    print(f"Total chunks: {len(chunks)}")
    print(f"Total uncompressed: {total_uncompressed / 1024 / 1024:.2f}MB")
    print(f"Total compressed: {total_compressed / 1024:.2f}KB")
    print(f"Overall compression: {(1 - total_compressed / total_uncompressed) * 100:.1f}%")
    print(f"Manifest saved to: {manifest_path}")

def main():
    """Main entry point"""
    # Get version from config or use current date
    version = datetime.now().strftime('%Y-%m-%d')
    
    print("Loading all scenario dialogues...")
    dialogues, event_names = load_all_dialogues()
    print(f"Loaded {len(dialogues)} dialogues from {len(event_names)} events")
    
    print(f"\nSplitting into ~{CHUNK_SIZE_BYTES / 1024 / 1024:.1f}MB chunks...")
    chunks = split_into_chunks(dialogues, CHUNK_SIZE_BYTES)
    print(f"Created {len(chunks)} chunks")
    
    print("\nCompressing and saving chunks...")
    compress_and_save_chunks(chunks, event_names, version)
    
    print("\n✓ Build complete!")

if __name__ == '__main__':
    main()
