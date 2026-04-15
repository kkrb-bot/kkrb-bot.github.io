/**
 * カードストーリーの読み込みとレンダリング
 * 共通ツールはシナリオユーティリティで定義されています
 */

let currentCardLoadId = null;

/**
 * カードバンドルを読み込み
 * @param {number} displayId - 表示ID
 * @returns {Promise<Array|null>} シナリオデータの配列または null
 */
async function loadCardBundle(displayId) {
    const actualId = getActualCardId(displayId);
    const path = API_PATHS.bundles.card(actualId);
    return await loadScenarioData(path);
}

/**
 * カードストーリーを初期化してレンダリング
 * @param {number} displayId - 表示ID (URLで使用)
 */
async function initCardScenario(displayId, onLoadComplete) {
    const loadId = Math.random();
    currentCardLoadId = loadId;

    // Load bundle
    let scenarios = await loadCardBundle(displayId);
    
    if (!scenarios) {
        console.error(`[Card] Bundle not found for card ${displayId}`);
        if (loadId === currentCardLoadId) {
            const cardContent = document.querySelector('#card-content');
            if (cardContent) cardContent.innerHTML = `<p>データが見つかりませんでした。</p>`;
        }
        return;
    }

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
 * @param {number} page - ページ番号
 */
async function showCardList(page = 1) {
    const cardContent = document.querySelector('#card-content');
    if (!cardContent || !uiManager) {
        return;
    }

    cardContent.innerHTML = await uiManager.generateCardList(page);

    if (typeof toc !== 'undefined' && toc) {
        toc.destroy();
        toc.init();
    }
}
