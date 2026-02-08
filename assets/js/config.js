/**
 * アプリケーショングローバル設定
 * キャラクターデータ、翻訳マッピングなどの静的設定を含む
 */

/**
 * データバージョン設定
 * デプロイ時にこの値を更新してください（例: '2026-02-04' または Date.now()）
 * または自動的に現在時刻を使用
 */
let APP_CONFIG = null;

/**
 * アプリケーショングローバル設定を非同期で読み込み
 */
async function loadAppConfig() {
    if (APP_CONFIG !== null) {
        return APP_CONFIG;
    }
    
    try {
        const response = await fetch('public/scenario/info.json');
        if (!response.ok) {
            throw new Error(`Failed to load info.json: ${response.status}`);
        }
        const info = await response.json();
        
        APP_CONFIG = {
            // info.json からバージョン情報を読み込み
            DATA_VERSION: info.version || '2026-02-05',
            
            // キャッシュの有効期限（ミリ秒、デフォルト30日）
            CACHE_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
            
            // 検索データチャンクのベースURL（Web Workerから見た相対パス）
            CHUNKS_BASE_URL: '../../public/data/chunks'
        };
        
        return APP_CONFIG;
    } catch (error) {
        console.error('Error loading app config:', error);
        // フォールバックとしてデフォルト値を使用
        APP_CONFIG = {
            DATA_VERSION: '2026-02-05',
            CACHE_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
            CHUNKS_BASE_URL: '../../public/data/chunks'
        };
        return APP_CONFIG;
    }
}

const CHARACTER_MAP = {
    1: 'Oz',
    2: 'Arthur',
    3: 'Cain',
    4: 'Riquet',
    5: 'Snow',
    6: 'White',
    7: 'Mithra',
    8: 'Owen',
    9: 'Bradley',
    10: 'Faust',
    11: 'Shino',
    12: 'Heathcliff',
    13: 'Nero',
    14: 'Shylock',
    15: 'Murr',
    16: 'Chloe',
    17: 'Rustica',
    18: 'Figaro',
    19: 'Rutile',
    20: 'Lennox',
    21: 'Mitile'
};

const NAME_TO_ID = Object.entries(CHARACTER_MAP).reduce((acc, [id, name]) => {
    acc[name.toLowerCase()] = parseInt(id);
    return acc;
}, {});

const CHARACTER_KATAKANA_MAP = {
    'Oz': 'オズ',
    'Arthur': 'アーサー',
    'Cain': 'カイン',
    'Riquet': 'リケ',
    'Snow': 'スノウ',
    'White': 'ホワイト',
    'Mithra': 'ミスラ',
    'Owen': 'オーエン',
    'Bradley': 'ブラッドリー',
    'Faust': 'ファウスト',
    'Shino': 'シノ',
    'Heathcliff': 'ヒースクリフ',
    'Nero': 'ネロ',
    'Shylock': 'シャイロック',
    'Murr': 'ムル',
    'Chloe': 'クロエ',
    'Rustica': 'ラスティカ',
    'Figaro': 'フィガロ',
    'Rutile': 'ルチル',
    'Lennox': 'レノックス',
    'Mitile': 'ミチル',
};

const LOVE_CHARACTERS_BY_COUNTRY = {
    '中央の国': ['Oz', 'Arthur', 'Cain', 'Riquet'],
    '北の国': ['Snow', 'White', 'Mithra', 'Owen', 'Bradley'],
    '東の国': ['Faust', 'Shino', 'Heathcliff', 'Nero'],
    '西の国': ['Shylock', 'Murr', 'Chloe', 'Rustica'],
    '南の国': ['Figaro', 'Rutile', 'Lennox', 'Mitile']
};

const LOVE_EPISODES_PER_CHARACTER = 10;

const JAPANESE_NUMERALS = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９', '１０',
    '１１', '１２', '１３', '１４', '１５', '１６', '１７', '１８', '１９', '２０',
    '２１', '２２', '２３', '２４', '２５', '２６', '２７', '２８', '２９', '３０',
    '３１', '３２', '３３', '３４', '３５', '３６', '３７', '３８', '３９', '４０',
    '４１', '４２', '４３', '４４', '４５', '４６', '４７'];

const MAIN_STORY_CONFIG = {
    part1: {
        name: '第１部',
        start: 1,
        end: 21
    },
    part1_5: {
        name: '第１．５部',
        start: 22,
        end: 25
    },
    part2: {
        name: '第２部',
        start: 26,
        end: 47
    },
    prologue: 21
};

let EVENT_EPISODE_LIST = null;

/**
 * イベントエピソードリストを非同期で読み込み
 */
async function loadEventEpisodeList() {
    if (EVENT_EPISODE_LIST !== null) {
        return EVENT_EPISODE_LIST;
    }
    
    try {
        const response = await fetch('public/scenario/event.json');
        if (!response.ok) {
            throw new Error(`Failed to load event.json: ${response.status}`);
        }
        const data = await response.json();
        EVENT_EPISODE_LIST = data.episodeList || {};
        return EVENT_EPISODE_LIST;
    } catch (error) {
        console.error('Error loading event episode list:', error);
        // フォールバックとして空のオブジェクトを使用
        EVENT_EPISODE_LIST = {};
        return EVENT_EPISODE_LIST;
    }
}

const CARD_STORY_CONFIG = {
    idOffset: 19
};

/**
 * 表示IDを実際のIDに変換
 * @param {number} displayId - 表示ID (URLに使用)
 * @returns {number} 実際のID (JSONファイルで使用)
 */
function getActualCardId(displayId) {
    if (displayId >= 337) {
        return displayId + CARD_STORY_CONFIG.idOffset;
    }
    return displayId;
}

/**
 * 実際のIDを表示IDに変換
 * @param {number} actualId - 実際のID
 * @returns {number} 表示ID (URLに表示)
 */
function getDisplayCardId(actualId) {
    if (actualId >= 356) {
        return actualId - CARD_STORY_CONFIG.idOffset;
    }
    return actualId;
}

const CAULIS_EVENT_IDS = [71, 84, 86, 100, 105, 128, 132, 138];

const EP_SPOT_CONFIG = {
    minSpotId: 1,
    maxSpotId: 22,
    minSeq: 0,
    maxSeq: 30,
    // spotId 22 has only 27 episodes (00-26)
    episodesPerSpotId: {
        22: 27
    },
    get episodesPerSpot() {
        return 31; // 0-30 = 31 episodes
    }
};

const EP_CHARA_CONFIG = {
    minCharaId: 1,
    maxCharaId: 21,
    episodesPerChara: 18
};

const EP_CARD_CONFIG = {
    // Card configuration - loaded dynamically from card-ep.json
    cardEpisodeMap: null  // Store the loaded card-episode mapping
};

const EP_SPECIAL_CONFIG = {
    directories: [
        {
            id: '1st',
            displayName: '１周年',
            minId: 0,
            maxId: 29
        },
        {
            id: '2nd',
            displayName: '２周年<br>『ボルダ島』',
            minId: 30,
            maxId: 56
        }
    ]
};

const EP_CHARACTERS_BY_COUNTRY = {
    '中央の国': ['Oz', 'Arthur', 'Cain', 'Riquet'],
    '北の国': ['Snow', 'White', 'Mithra', 'Owen', 'Bradley'],
    '東の国': ['Faust', 'Shino', 'Heathcliff', 'Nero'],
    '西の国': ['Shylock', 'Murr', 'Chloe', 'Rustica'],
    '南の国': ['Figaro', 'Rutile', 'Lennox', 'Mitile']
};

const API_PATHS = {
    loveScenario: (characterId, episode) => `public/scenario/love/scenario_love_${characterId}-${episode}.json`,
    mainScenario: (chapter, episode) => `public/scenario/main/scenario_main_${chapter}-${episode}.json`,
    eventScenario: (eventId, episode) => `public/scenario/event/scenario_event_${eventId}-${episode}.json`,
    caulisScenario: (eventId, episode) => `public/scenario/caulis/caulis_story_${eventId}-${episode}.json`,
    cardScenario: (cardId) => `public/scenario/card/scenario_card_${cardId}-1.json`,
    epSpotScenario: (spotId, seq) => {
        // spotId 22 uses special naming: iku_epi_1001
        if (spotId === 22) {
            return `public/scenario/ep/spot/iku_epi_1001${String(seq).padStart(2, '0')}.json`;
        }
        return `public/scenario/ep/spot/iku_epi_1${String(spotId - 1).padStart(2, '0')}${String(seq).padStart(2, '0')}.json`;
    },
    epCharaScenario: (characterId, episodeNum) => `public/scenario/ep/chara/iku_epi_${characterId}${String(episodeNum).padStart(2, '0')}.json`,
    epCardScenario: (epid) => `public/scenario/ep/card/iku_epi_${epid}.json`,
    epSpecialScenario: (dir, id) => `public/scenario/ep/special/${dir}/iku_epi_1000${String(id).padStart(2, '0')}.json`,
    campaignInfo: 'public/info_campaign.json'
};

const THEME_CONFIG = {
    light: 'light',
    dark: 'dark',
    storageKey: 'theme',
    default: 'light',
    followSystem: true  // Follow system dark mode preference
};
