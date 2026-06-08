#!/usr/bin/env python3
"""
Build compressed search data chunks
Compacts all scenario JSONs, splits into ~4MB chunks, and compresses with gzip
Normalized structure to reduce redundancy
"""

import os
import json
import gzip
import argparse
from pathlib import Path
from datetime import datetime

# Target chunk size (uncompressed): ~2MB
CHUNK_SIZE_BYTES = 2 * 1024 * 1024

# Global dictionaries for normalization
scenario_dict = [] # List of {'type': ..., 'id': ..., 'title': ...}
scenario_map = {}  # (type, id, title) -> index
speaker_dict = []  # List of speaker names
speaker_map = {}   # speaker_name -> index

def get_scenario_index(scenario_type, scenario_id, title):
    key = (scenario_type, scenario_id, title)
    if key not in scenario_map:
        scenario_map[key] = len(scenario_dict)
        scenario_dict.append({
            't': scenario_type,
            'i': scenario_id,
            'l': title
        })
    return scenario_map[key]

def get_speaker_index(speaker_name):
    if speaker_name not in speaker_map:
        speaker_map[speaker_name] = len(speaker_dict)
        speaker_dict.append(speaker_name)
    return speaker_map[speaker_name]

def extract_dialogues_recursive(dialogue_list, scenario_type, scenario_id, all_dialogues, title=''):
    """Recursively extract dialogues from list, handling branches"""
    scenario_idx = get_scenario_index(scenario_type, scenario_id, title)
    
    for item in dialogue_list:
        if isinstance(item, list) and len(item) == 2:
            # Normal dialogue: [speaker, content]
            speaker, content = item
            
            # Remove newlines for cleaner search
            if isinstance(content, str):
                content = content.replace('\n', '').strip()
            
            speaker_idx = get_speaker_index(speaker)
            
            # Normalized format: [scenarioIdx, speakerIdx, content]
            all_dialogues.append([scenario_idx, speaker_idx, content])
            
        elif isinstance(item, dict) and 'branch' in item:
            # Branch structure: {"branch": [[choice_text, [dialogues]], ...]}
            for branch_option in item['branch']:
                if isinstance(branch_option, list) and len(branch_option) >= 2:
                    choice_text = branch_option[0]
                    if isinstance(choice_text, str):
                        choice_text = choice_text.replace('\n', '').strip()
                    
                    speaker_idx = get_speaker_index('選択肢')
                    all_dialogues.append([scenario_idx, speaker_idx, choice_text])
                    
                    branch_dialogues = branch_option[1]
                    if isinstance(branch_dialogues, list):
                        extract_dialogues_recursive(branch_dialogues, scenario_type, scenario_id, all_dialogues, title)

def load_all_dialogues(base_path: Path):
    """Load all dialogue data from scenario files"""
    types = ['main', 'card', 'event', 'love', 'caulis']
    special_types = ['ep', 'campaign', 'login-event']
    
    all_dialogues = []
    event_names = {}
    
    # 0. Pre-load event titles and mappings
    event_meta_path = base_path / 'event.json'
    login_event_meta_path = base_path / 'login' / 'event.json'
    
    event_id_to_name = {}
    login_id_to_event_name = {}
    
    if event_meta_path.exists():
        try:
            with open(event_meta_path, 'r', encoding='utf-8') as f:
                event_data = json.load(f)
                names = event_data.get('eventNames', {})
                for eid, name in names.items():
                    event_id_to_name[int(eid)] = name.replace('<br>', ' ').strip()
                    event_names[int(eid)] = event_id_to_name[int(eid)]
        except Exception as e:
            print(f"Warning: Failed to parse event.json: {e}")

    if login_event_meta_path.exists():
        try:
            with open(login_event_meta_path, 'r', encoding='utf-8') as f:
                login_meta = json.load(f)
                for eid_str, data in login_meta.items():
                    eid = int(eid_str)
                    name = event_id_to_name.get(eid, f"イベント{eid}")
                    for lid in data.get('lgstList', []):
                        login_id_to_event_name[str(lid)] = name
        except Exception as e:
            print(f"Warning: Failed to parse login/event.json: {e}")

    # 1. Handle regular types
    for scenario_type in types:
        type_path = base_path / scenario_type
        if not type_path.exists():
            continue
        
        json_files = sorted(type_path.glob('caulis_story_*.json' if scenario_type == 'caulis' else 'scenario_*.json'))
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if scenario_type == 'caulis':
                    scenario_id = json_file.stem.replace('caulis_story_', '')
                else:
                    scenario_id = json_file.stem.replace(f'scenario_{scenario_type}_', '')
                
                if scenario_type in ['event', 'caulis'] and 'Title' in data:
                    title_parts = data['Title'].split('|')
                    event_title = title_parts[0].replace('<br>', ' ').strip()
                    event_id = int(scenario_id.split('-')[0])
                    if event_id not in event_names:
                        event_names[event_id] = event_title
                
                if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                    title = data.get('Title', '')
                    extract_dialogues_recursive(data['Dialogue'], scenario_type, scenario_id, all_dialogues, title)
            except Exception as e:
                print(f"Error processing {json_file}: {e}")
    
    # Handle special types
    for scenario_type in special_types:
        if scenario_type == 'ep':
            for subdir in ['spot', 'chara', 'special', 'card']:
                sub_path = base_path / scenario_type / subdir
                if not sub_path.exists(): continue
                
                if subdir == 'special':
                    for special_subdir in ['1st', '2nd']:
                        special_path = sub_path / special_subdir
                        if not special_path.exists(): continue
                        for json_file in sorted(special_path.glob('iku_epi_*.json')):
                            try:
                                with open(json_file, 'r', encoding='utf-8') as f:
                                    data = json.load(f)
                                scenario_id = json_file.stem.replace('iku_epi_', '')
                                if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                                    extract_dialogues_recursive(data['Dialogue'], f'ep-special-{special_subdir}', scenario_id, all_dialogues, data.get('Title', ''))
                            except Exception as e: print(f"Error processing {json_file}: {e}")
                else:
                    for json_file in sorted(sub_path.glob('iku_epi_*.json')):
                        try:
                            with open(json_file, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                            scenario_id = json_file.stem.replace('iku_epi_', '')
                            if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                                extract_dialogues_recursive(data['Dialogue'], f'ep-{subdir}', scenario_id, all_dialogues, data.get('Title', ''))
                        except Exception as e: print(f"Error processing {json_file}: {e}")
        elif scenario_type == 'campaign':
            campaign_path = base_path / 'login' / 'campaign'
            if campaign_path.exists():
                for json_file in sorted(campaign_path.glob('scenario_login_*.json')):
                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        scenario_id = json_file.stem.replace('scenario_login_', '')
                        if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                            extract_dialogues_recursive(data['Dialogue'], 'campaign', scenario_id, all_dialogues, data.get('Title', ''))
                    except Exception as e: print(f"Error processing {json_file}: {e}")
        elif scenario_type == 'login-event':
            event_path = base_path / 'login' / 'event'
            if event_path.exists():
                for json_file in sorted(event_path.glob('scenario_login_*.json')):
                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        scenario_id = json_file.stem.replace('scenario_login_', '')
                        event_name = login_id_to_event_name.get(scenario_id)
                        original_title = data.get('Title', '')
                        title = f"{event_name} | {original_title}" if event_name and original_title else (event_name or original_title)
                        if 'Dialogue' in data and isinstance(data['Dialogue'], list):
                            extract_dialogues_recursive(data['Dialogue'], 'login-event', scenario_id, all_dialogues, title)
                    except Exception as e: print(f"Error processing {json_file}: {e}")
    
    return all_dialogues, event_names

def split_into_chunks(dialogues, chunk_size_bytes):
    """Split dialogues into chunks"""
    chunks = []
    current_chunk = []
    current_size = 0
    for dialogue in dialogues:
        dialogue_json = json.dumps(dialogue, ensure_ascii=False)
        dialogue_size = len(dialogue_json.encode('utf-8'))
        if current_size + dialogue_size > chunk_size_bytes and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            current_size = 0
        current_chunk.append(dialogue)
        current_size += dialogue_size
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

def compress_and_save_chunks(chunks, event_names, version, output_dir: Path):
    """Compress chunks and save to disk"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    chunk_manifest = {
        'version': version,
        'timestamp': datetime.now().isoformat(),
        'totalChunks': len(chunks),
        'chunks': [],
        'scenarios': scenario_dict,
        'speakers': speaker_dict,
        'eventNames': event_names
    }
    
    total_uncompressed = 0
    total_compressed = 0
    
    for idx, chunk in enumerate(chunks):
        chunk_data = {'d': chunk, 'idx': idx}
        json_str = json.dumps(chunk_data, ensure_ascii=False, separators=(',', ':'))
        json_bytes = json_str.encode('utf-8')
        compressed = gzip.compress(json_bytes, compresslevel=9)
        
        chunk_filename = f'search-chunk-{idx}.gz'
        with open(output_dir / chunk_filename, 'wb') as f:
            f.write(compressed)
        
        uncompressed_size = len(json_bytes)
        compressed_size = len(compressed)
        total_uncompressed += uncompressed_size
        total_compressed += compressed_size
        
        chunk_manifest['chunks'].append({
            'filename': chunk_filename,
            'index': idx,
            'uncompressedSize': uncompressed_size,
            'compressedSize': compressed_size,
            'dialogueCount': len(chunk)
        })
        print(f"Chunk {idx}: {len(chunk)} dialogues, {uncompressed_size / 1024 / 1024:.2f}MB -> {compressed_size / 1024:.2f}KB")
    
    chunk_manifest['totalCompressedSize'] = total_compressed
    with open(output_dir / 'manifest.json', 'w', encoding='utf-8') as f:
        json.dump(chunk_manifest, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== Summary ===\nTotal chunks: {len(chunks)}\nTotal uncompressed: {total_uncompressed / 1024 / 1024:.2f}MB\nTotal compressed: {total_compressed / 1024 / 1024:.2f}MB")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=str, default='public/scenario')
    parser.add_argument('--output', type=str, default='public/data/chunks')
    args = parser.parse_args()

    source_path = Path(args.source)
    version = None
    if (source_path / 'info.json').exists():
        with open(source_path / 'info.json', 'r', encoding='utf-8') as f:
            version = json.load(f).get('version')
    
    version = version or datetime.now().strftime('%Y-%m-%d')
    dialogues, event_names = load_all_dialogues(source_path)
    chunks = split_into_chunks(dialogues, CHUNK_SIZE_BYTES)
    compress_and_save_chunks(chunks, event_names, version, Path(args.output))

if __name__ == '__main__':
    main()
