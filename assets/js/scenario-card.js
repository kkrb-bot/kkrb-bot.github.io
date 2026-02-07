/**
 * カードストーリーの読み込みとレンダリング
 * 共通ツールはシナリオユーティリティで定義されています
 */

let currentCardLoadId = null;

/**
 * カードシナリオJSONを読み込み（すべてのバリアント）
 * @param {number} displayId - 表示ID (URLで使用)
 * @returns {Promise<Array<Object>|null>} シナリオデータの配列またはnull
 */
async function loadCardScenario(displayId) {
    const actualId = getActualCardId(displayId);
    const scenarios = [];

    for (let variantNum = 1; variantNum <= 3; variantNum++) {
        const path = `public/scenario/card/scenario_card_${actualId}-${variantNum}.json`;
        const scenario = await loadScenarioData(path);
        if (scenario) {
            scenarios.push({ variantNum, data: scenario });
        } else if (variantNum === 1) {
            return null;
        } else {
            break;
        }
    }

    return scenarios.length > 0 ? scenarios : null;
}

/**
 * カードストーリーを初期化してレンダリング
 * @param {number} displayId - 表示ID (URLで使用)
 */
async function initCardScenario(displayId, onLoadComplete) {
    const loadId = Math.random();
    currentCardLoadId = loadId;

    const scenarios = await loadCardScenario(displayId);

    if (loadId !== currentCardLoadId) {
        return;
    }

    const cardContent = document.querySelector('#card-content');
    if (!cardContent) {
        console.error('Card content container not found');
        return;
    }

    if (!scenarios) {
        cardContent.innerHTML = `<p>カードストーリーが見つかりません。</p>`;
        return;
    }

    const actualId = getActualCardId(displayId);

    renderCardStory(scenarios, displayId, actualId);

    if (typeof toc !== 'undefined' && toc) {
        toc.destroy();
        toc.init();
    }

    if (onLoadComplete && typeof onLoadComplete === 'function') {
        onLoadComplete();
    }
}

/**
 * 単一のカードストーリーをレンダリング
 * @param {Array<Object>} scenarios - シナリオデータの配列 [{variantNum, data}, ...]
 * @param {number} displayId - 表示ID
 * @param {number} actualId - 実際のID (JSON内で使用)
 */
function renderCardStory(scenarios, displayId, actualId) {
    const cardContent = document.querySelector('#card-content');
    if (!cardContent) return;

    let html = '';

    if (scenarios.length > 0 && scenarios[0].data.Title) {
        const titleParts = scenarios[0].data.Title.split('|');
        const mainTitle = titleParts[0];

        html += `<h2 class="no-toc-title">${mainTitle}</h2>\n`;
    } else {
        html += `<h2 class="no-toc-title">カード ${displayId}</h2>\n`;
    }

    const iconPath = `assets/images/card_icon/story_select_card_${actualId}.png`;
    html += `<div class="event-banner-container">
        <img src="${iconPath}" class="card-icon-img" />
    </div>`;

    scenarios.forEach(({ variantNum, data }) => {
        if (data.Title) {
            const titleParts = data.Title.split('|');
            const subtitle = titleParts[1] || '';
            if (subtitle) {
                html += `<h3>${subtitle}</h3>\n`;
            } else {
                html += `<h3>${variantNum}話</h3>\n`;
            }
        } else {
            html += `<h3>${variantNum}話</h3>\n`;
        }

        if (data.Dialogue && Array.isArray(data.Dialogue)) {
            html += renderDialogue(data.Dialogue);
        }
    });

    html += `<div class="back-links">
        <a href="#card" class="back-link">← カードストーリーのトップへ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;

    cardContent.innerHTML = html;
}

/**
 * カードリストを表示
 * assets/images/card_icon ディレクトリからカードアイコンを取得してリストを生成
 */
async function showCardList() {
    const cardContent = document.querySelector('#card-content');
    if (!cardContent || !uiManager) {
        return;
    }

    cardContent.innerHTML = await uiManager.generateCardList();

    if (typeof toc !== 'undefined' && toc) {
        toc.destroy();
        toc.init();
    }
}
