/**
 * シナリオデータ処理ツール
 * 汎用的なロード、レンダリング、インタラクション処理機能を提供
 * 親愛ストーリーとメインストーリー用
 */

/**
 * JSONシナリオデータをロード
 * @param {string} path - シナリオファイルパス
 * @returns {Promise<Object|null>} ロードされたシナリオデータまたはnull
 */
async function loadScenarioData(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

/**
 * セリフアイテムをレンダリング
 * 通常のセリフと分岐選択肢をサポート
 * @param {Array} dialogue - セリフ配列
 * @returns {string} 生成されたHTML
 */
function renderDialogue(dialogue) {
    let html = '';

    dialogue.forEach((item, index) => {
        if (item.branch) {
            html += `<div class="dialogue-branch" data-branch-index="${index}">`;
            item.branch.forEach((branch, branchIndex) => {
                const [branchText] = branch;
                html += `<button class="branch-option" data-branch="${branchIndex}" data-parent-index="${index}">${branchText}</button>`;
            });
            html += '</div>';
        } else {
            const [character, text] = item;
            const textContent = typeof text === 'string' ? text : String(text || '');
            html += `
                <div class="dialogue-item">
                    <div class="dialogue-character">${character}</div>
                    <div class="dialogue-text">${textContent.replace(/\n/g, '<br>')}</div>
                </div>
            `;
        }
    });

    return html;
}

/**
 * 分岐選択肢クリックイベントを処理
 * @param {Array} dialogue - セリフ配列
 * @param {HTMLElement} branchContainer - 分岐コンテナ要素
 * @param {HTMLElement} optionBtn - クリックされたオプションボタン
 */
function handleBranchClick(dialogue, branchContainer, optionBtn) {
    const parentIndex = parseInt(optionBtn.getAttribute('data-parent-index'));
    const branchIndex = parseInt(optionBtn.getAttribute('data-branch'));

    const branchItem = dialogue[parentIndex];
    if (!branchItem || !branchItem.branch || !branchItem.branch[branchIndex]) return;

    const [, nextDialogue] = branchItem.branch[branchIndex];

    branchContainer.querySelectorAll('.branch-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    optionBtn.classList.add('selected');

    let nextContainer = branchContainer.nextElementSibling;
    while (nextContainer && nextContainer.classList.contains('branch-result')) {
        const temp = nextContainer;
        nextContainer = nextContainer.nextElementSibling;
        temp.remove();
    }

    if (nextDialogue && nextDialogue.length > 0) {
        const nextHtml = renderDialogue(nextDialogue);
        const resultDiv = document.createElement('div');
        resultDiv.className = 'branch-result';
        resultDiv.innerHTML = nextHtml;

        branchContainer.parentNode.insertBefore(resultDiv, branchContainer.nextSibling);
        attachBranchListeners(nextDialogue, resultDiv);
    }
}

/**
 * すべての分岐選択肢にイベントリスナーを追加
 * @param {Array} dialogue - セリフ配列
 * @param {HTMLElement} container - コンテナ要素
 */
function attachBranchListeners(dialogue, container) {
    container.querySelectorAll('.branch-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const branchContainer = btn.closest('.dialogue-branch');
            handleBranchClick(dialogue, branchContainer, btn);
        });
    });
}

/**
 * 数字を汉数字に変換
 * @param {number} num - 数字
 * @returns {string} 汉数字
 */
function convertToJapaneseNumeral(num) {
    return JAPANESE_NUMERALS[num] || num.toString();
}

/**
 * タイトルからテキストを抽出（| デリミタを処理）
 * @param {string} text - 元のテキスト
 * @param {number} part - 抽出部分（0は|の前、1は|の後）
 * @returns {string} 抽出されたテキスト
 */
function extractTitlePart(text, part = 0) {
    if (!text || !text.includes('|')) {
        return text;
    }
    const parts = text.split('|');
    return parts[part]?.trim() || text;
}
