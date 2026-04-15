#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

def load_json(path):
    if not path.exists(): return None
    with open(path, 'r', encoding='utf-8') as f: return json.load(f)

def save_json(data, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

def build_main_story_bundles(scenario_dir, bundle_dir):
    print(f"Building Main Story bundles from {scenario_dir}...")
    main_dir = scenario_dir / 'main'
    if not main_dir.exists(): return
    chapters = {}
    for p in main_dir.glob('scenario_main_*-*.json'):
        parts = p.stem.split('_')[-1].split('-')
        if len(parts) != 2: continue
        chapter_num, episode_num = int(parts[0]), int(parts[1])
        if chapter_num not in chapters: chapters[chapter_num] = {}
        chapters[chapter_num][episode_num] = load_json(p)
    for chapter_num, episodes in chapters.items():
        save_json([episodes[num] for num in sorted(episodes.keys())], bundle_dir / 'main' / f'chapter_{chapter_num}.json')

def build_campaign_bundles(scenario_dir, bundle_dir):
    print(f"Building Campaign bundles from {scenario_dir}...")
    campaign_file = scenario_dir / 'login' / 'campaign.json'
    if not campaign_file.exists(): return
    campaigns = load_json(campaign_file)
    for i, campaign in enumerate(campaigns):
        scripts = campaign.get('script') or campaign.get('scripts') or []
        bundle_data = [load_json(scenario_dir / 'login' / 'campaign' / f'scenario_login_{sid}.json') for sid in scripts if (scenario_dir / 'login' / 'campaign' / f'scenario_login_{sid}.json').exists()]
        bundle_data = [d for d in bundle_data if d]
        if bundle_data: save_json(bundle_data, bundle_dir / 'campaign' / f'campaign_{i}.json')

def build_event_bundles(scenario_dir, bundle_dir):
    print(f"Building Event bundles from {scenario_dir}...")
    event_meta = load_json(scenario_dir / 'event.json') or {}
    login_event_meta = load_json(scenario_dir / 'login' / 'event.json') or {}
    episode_list_map = event_meta.get('episodeList', {})
    caulis_list = [int(x) for x in event_meta.get('caulisList', [])]
    event_ids = set([int(eid) for eid in episode_list_map.keys()] + [int(eid) for eid in login_event_meta.keys()])
    event_dir, caulis_dir = scenario_dir / 'event', scenario_dir / 'caulis'
    if event_dir.exists():
        for p in event_dir.glob('scenario_event_*-*.json'): event_ids.add(int(p.stem.split('_')[-1].split('-')[0]))
    if caulis_dir.exists():
        for p in caulis_dir.glob('caulis_story_*-*.json'): event_ids.add(int(p.stem.split('_')[-1].split('-')[0]))
    for event_id in event_ids:
        bundle = {'episodes': [], 'login': []}
        episodes_to_load = episode_list_map.get(str(event_id))
        if not episodes_to_load:
            episodes_to_load = []
            prefix = 'caulis_story' if event_id in caulis_list else 'scenario_event'
            search_dir = caulis_dir if event_id in caulis_list else event_dir
            if search_dir.exists():
                for p in search_dir.glob(f'{prefix}_{event_id}-*.json'): episodes_to_load.append(int(p.stem.split('-')[-1]))
            episodes_to_load.sort()
        for ep_num in episodes_to_load:
            path = (caulis_dir / f'caulis_story_{event_id}-{ep_num}.json' if event_id in caulis_list else event_dir / f'scenario_event_{event_id}-{ep_num}.json')
            data = load_json(path)
            if data: bundle['episodes'].append({'episode': ep_num, 'scenario': data})
        for lid in login_event_meta.get(str(event_id), {}).get('lgstList', []):
            data = load_json(scenario_dir / 'login' / 'event' / f'scenario_login_{lid}.json')
            if data: bundle['login'].append({'loginId': lid, 'scenario': data})
        if bundle['episodes'] or bundle['login']: save_json(bundle, bundle_dir / 'event' / f'event_{event_id}.json')

def build_love_bundles(scenario_dir, bundle_dir):
    print(f"Building Love bundles from {scenario_dir}...")
    love_dir = scenario_dir / 'love'
    if not love_dir.exists(): return
    characters = {}
    for p in love_dir.glob('scenario_love_*-*.json'):
        parts = p.stem.split('_')[-1].split('-')
        if len(parts) != 2: continue
        cid, ep = int(parts[0]), int(parts[1])
        if cid not in characters: characters[cid] = {}
        characters[cid][ep] = load_json(p)
    for cid, episodes in characters.items():
        save_json([episodes[num] for num in sorted(episodes.keys())], bundle_dir / 'love' / f'character_{cid}.json')

def build_ep_bundles(scenario_dir, bundle_dir):
    print(f"Building Ep bundles from {scenario_dir}...")
    ep_dir = scenario_dir / 'ep'
    if not ep_dir.exists(): return
    # Ep Spot
    spot_dir = ep_dir / 'spot'
    if spot_dir.exists():
        spots = {}
        for p in spot_dir.glob('*.json'):
            name = p.stem
            if name.startswith('iku_epi_1001'): spot_id, seq = 22, int(name[12:])
            else: spot_id, seq = int(name[9:11]) + 1, int(name[11:])
            if spot_id not in spots: spots[spot_id] = {}
            spots[spot_id][seq] = load_json(p)
        for sid, episodes in spots.items():
            save_json([episodes[num] for num in sorted(episodes.keys())], bundle_dir / 'ep' / 'spot' / f'spot_{sid}.json')
    # Ep Chara
    chara_dir = ep_dir / 'chara'
    if chara_dir.exists():
        charas = {}
        for p in chara_dir.glob('iku_epi_*.json'):
            name = p.stem[8:]
            if len(name) < 3: continue
            cid, ep = int(name[:-2]), int(name[-2:])
            if cid not in charas: charas[cid] = {}
            charas[cid][ep] = load_json(p)
        for cid, episodes in charas.items():
            save_json([episodes[num] for num in sorted(episodes.keys())], bundle_dir / 'ep' / 'chara' / f'character_{cid}.json')
    # Ep Special
    special_dir = ep_dir / 'special'
    if special_dir.exists():
        for d in ['1st', '2nd']:
            d_dir = special_dir / d
            if d_dir.exists():
                episodes = {}
                for p in d_dir.glob('iku_epi_*.json'):
                    ep_id = int(p.stem[12:])
                    episodes[ep_id] = load_json(p)
                if episodes:
                    save_json([episodes[num] for num in sorted(episodes.keys())], bundle_dir / 'ep' / 'special' / f'special_{d}.json')

def build_card_bundles(scenario_dir, bundle_dir):
    print(f"Building Card bundles from {scenario_dir}...")
    card_dir = scenario_dir / 'card'
    if not card_dir.exists(): return
    cards = {}
    for p in card_dir.glob('scenario_card_*-*.json'):
        parts = p.stem.split('_')[-1].split('-')
        if len(parts) != 2: continue
        cid, variant = int(parts[0]), int(parts[1])
        if cid not in cards: cards[cid] = {}
        cards[cid][variant] = load_json(p)
    for cid, variants in cards.items():
        save_json([{'variantNum': v, 'data': variants[v]} for v in sorted(variants.keys())], bundle_dir / 'card' / f'card_{cid}.json')

def main():
    parser = argparse.ArgumentParser(description='Build scenario bundles')
    parser.add_argument('--source', type=str, default='public/scenario', help='Source directory of scenario files')
    parser.add_argument('--output', type=str, default='public/data/bundles', help='Output directory for bundles')
    args = parser.parse_args()

    scenario_dir = Path(args.source)
    bundle_dir = Path(args.output)
    
    if not scenario_dir.exists():
        print(f"Error: {scenario_dir} directory not found")
        return

    build_main_story_bundles(scenario_dir, bundle_dir)
    build_campaign_bundles(scenario_dir, bundle_dir)
    build_event_bundles(scenario_dir, bundle_dir)
    build_love_bundles(scenario_dir, bundle_dir)
    build_ep_bundles(scenario_dir, bundle_dir)
    build_card_bundles(scenario_dir, bundle_dir)
    print("Bundling complete!")

if __name__ == '__main__':
    main()
