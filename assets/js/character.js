/**
 * キャラクター管理
 * config.js で定義された CHARACTER_MAP と NAME_TO_ID を使用
 */

/**
 * キャラクターIDを取得
 * @param {string} name - キャラクター英名
 * @returns {number|undefined} キャラクターID
 */
function getCharacterId(name) {
    return NAME_TO_ID[name.toLowerCase()];
}

/**
 * キャラクター名を取得
 * @param {number} id - キャラクターID
 * @returns {string|undefined} キャラクター英名
 */
function getCharacterName(id) {
    return CHARACTER_MAP[id];
}

/**
 * キャラクターの日本語カタカナ名を取得
 * @param {string} name - キャラクター英名
 * @returns {string} キャラクターの日本語カタカナ名
 */
function getCharacterKatakanaName(name) {
    return CHARACTER_KATAKANA_MAP[name] || name;
}
