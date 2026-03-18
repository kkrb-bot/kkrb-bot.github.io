/**
 * UI Manager
 * Manage navigation, page switching, theme switching and other UI-related functions
 */

class UIManager {
    constructor() {
        this.sidebar = null;
        this.overlay = null;
        this.menuBtn = null;
        this.themeToggle = null;
        this.html = null;
    }

    /**
     * Initialize UI Manager
     */
    init() {
        this.cacheDOMElements();
        this.setupNavigation();
        this.setupTheme();
        this.setupSidebar();
    }

    /**
     * Cache DOM elements
     */
    cacheDOMElements() {
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('overlay');
        this.menuBtn = document.getElementById('menuBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.html = document.documentElement;
    }

    /**
     * Set up navigation events
     */
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                this.closeSidebar();
                // Remove preventDefault to allow the browser to handle hash changes naturally
                // The router will listen for hashchange events
            });
        });
    }

    /**
     * Detect system dark mode preference
     * @returns {string} 'dark' or 'light'
     */
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return THEME_CONFIG.dark;
        }
        return THEME_CONFIG.light;
    }

    /**
     * Set up theme switching
     */
    setupTheme() {
        if (!this.themeToggle || !this.html) return;

        // First, try to get saved theme from localStorage
        const savedTheme = localStorage.getItem(THEME_CONFIG.storageKey);
        
        // Determine the initial theme:
        // 1. If user has saved a preference, use it
        // 2. If following system preference, detect system theme
        // 3. Otherwise use default
        let initialTheme;
        if (savedTheme !== null) {
            initialTheme = savedTheme;
        } else if (THEME_CONFIG.followSystem) {
            initialTheme = this.getSystemTheme();
        } else {
            initialTheme = THEME_CONFIG.default;
        }

        this.html.setAttribute('data-theme', initialTheme);
        this.themeToggle.checked = initialTheme === THEME_CONFIG.dark;

        // Handle manual theme toggle
        this.themeToggle.addEventListener('change', () => {
            const newTheme = this.themeToggle.checked ? THEME_CONFIG.dark : THEME_CONFIG.light;
            this.html.setAttribute('data-theme', newTheme);
            localStorage.setItem(THEME_CONFIG.storageKey, newTheme);
        });

        // Listen for system dark mode preference changes
        if (THEME_CONFIG.followSystem && window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Handle preference changes (modern browsers)
            const handleThemeChange = (e) => {
                // Only auto-switch if user hasn't set a manual preference
                if (localStorage.getItem(THEME_CONFIG.storageKey) === null) {
                    const newTheme = e.matches ? THEME_CONFIG.dark : THEME_CONFIG.light;
                    this.html.setAttribute('data-theme', newTheme);
                    this.themeToggle.checked = newTheme === THEME_CONFIG.dark;
                }
            };
            
            // Use addEventListener for modern browsers
            if (darkModeQuery.addEventListener) {
                darkModeQuery.addEventListener('change', handleThemeChange);
            } else if (darkModeQuery.addListener) {
                // Fallback for older browsers
                darkModeQuery.addListener(handleThemeChange);
            }
        }
    }

    /**
     * Set up sidebar
     */
    setupSidebar() {
        if (!this.menuBtn || !this.sidebar || !this.overlay) return;

        this.menuBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        this.overlay.addEventListener('click', () => {
            this.closeSidebar();
        });

        document.addEventListener('click', (e) => {
            if (!this.sidebar.contains(e.target) && e.target !== this.menuBtn) {
                this.closeSidebar();
            }
        });
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        this.sidebar.classList.toggle('active');
        this.overlay.classList.toggle('active');
    }

    /**
     * Open sidebar
     */
    openSidebar() {
        this.sidebar.classList.add('active');
        this.overlay.classList.add('active');
    }

    /**
     * Close sidebar
     */
    closeSidebar() {
        this.sidebar.classList.remove('active');
        this.overlay.classList.remove('active');
    }

    /**
     * Show specified page
     * @param {string} page - Page name (home, love, main, event, campaign, card, ep)
     * @param {string} subpage - Subpage (optional)
     */
    showPage(page, subpage = null) {
        document.querySelectorAll('.page-content').forEach(el => {
            el.style.display = 'none';
        });

        const mainContent = document.querySelector('#main-content');
        if (mainContent) {
            mainContent.innerHTML = '';
        }
        const loveContent = document.querySelector('#love-content');
        if (loveContent) {
            loveContent.innerHTML = '';
        }
        const eventContent = document.querySelector('#event-content');
        if (eventContent) {
            eventContent.innerHTML = '';
        }
        const campaignContent = document.querySelector('#campaign-content');
        if (campaignContent) {
            campaignContent.innerHTML = '';
        }
        const cardContent = document.querySelector('#card-content');
        if (cardContent) {
            cardContent.innerHTML = '';
        }
        const epContent = document.querySelector('#ep-content');
        if (epContent) {
            epContent.innerHTML = '';
        }

        if (typeof currentEventLoadId !== 'undefined') {
            currentEventLoadId = null;
        }
        if (typeof currentCampaignLoadId !== 'undefined') {
            currentCampaignLoadId = null;
        }
        if (typeof currentCardLoadId !== 'undefined') {
            currentCardLoadId = null;
        }
        if (typeof currentEpLoadId !== 'undefined') {
            currentEpLoadId = null;
        }

        const selectedPage = document.querySelector(`[data-page="${page}"]`);
        if (selectedPage) {
            selectedPage.style.display = 'block';
        }

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[href="#${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Generate love character list
     * @returns {Promise<string>} HTML content
     */
    async generateLoveCharacterList() {
        const countries = [];
        
        for (const [country, characters] of Object.entries(LOVE_CHARACTERS_BY_COUNTRY)) {
            const countryData = {
                name: country,
                characters: characters.map(char => ({
                    url: getCharacterId(char).toString(),
                    displayName: CHARACTER_KATAKANA_MAP[char] || char
                }))
            };
            countries.push(countryData);
        }

        return await templateManager.renderTemplate('love-character-list', { countries });
    }

    /**
     * Generate card list with pagination
     * @param {number} page - Page number (1-based)
     * @returns {Promise<string>} HTML content
     */
    async generateCardList(page = 1) {
        const cards = [];
        const itemsPerPage = 220;
        let totalPages = 1;
        
        try {
            const response = await fetch('public/scenario/info.json');
            if (!response.ok) throw new Error('Failed to load info.json');
            const info = await response.json();
            const maxDisplayId = info['card-max'] - 19;
            
            totalPages = Math.ceil(maxDisplayId / itemsPerPage);
            const startId = maxDisplayId - (page - 1) * itemsPerPage;
            const endId = Math.max(1, startId - itemsPerPage + 1);

            for (let displayId = startId; displayId >= endId; displayId--) {
                const actualId = getActualCardId(displayId);
                cards.push({
                    displayId,
                    iconPath: `assets/images/card_icon/story_select_card_${actualId}.png`
                });
            }
        } catch (error) {
            console.error('Error generating card list:', error);
        }

        let html = await templateManager.renderTemplate('card-list', { cards });
        
        if (totalPages > 1) {
            const paginationHtml = this.generatePagination(page, totalPages, 'card');
            html = paginationHtml + html + paginationHtml;
        }
        
        return html;
    }

    /**
     * Generate pagination controls with a grid layout for numbers
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {string} baseHash - Base hash for links
     * @returns {string} HTML content
     */
    generatePagination(currentPage, totalPages, baseHash) {
        let html = '<div class="pagination-wrapper">';
        
        // Navigation: Previous
        html += '<div class="pagination-nav">';
        if (currentPage > 1) {
            const prevHash = currentPage === 2 ? `#${baseHash}` : `#${baseHash}/p${currentPage - 1}`;
            html += `<a href="${prevHash}" class="pagination-link nav-btn">&laquo; 前へ</a>`;
        } else {
            html += `<span class="pagination-link nav-btn disabled">&laquo; 前へ</span>`;
        }
        html += '</div>';

        // Page numbers grid
        html += '<div class="pagination-number-grid">';
        for (let i = 1; i <= totalPages; i++) {
            const pageHash = i === 1 ? `#${baseHash}` : `#${baseHash}/p${i}`;
            if (i === currentPage) {
                html += `<span class="pagination-link active">${i}</span>`;
            } else {
                html += `<a href="${pageHash}" class="pagination-link">${i}</a>`;
            }
        }
        html += '</div>';

        // Navigation: Next
        html += '<div class="pagination-nav">';
        if (currentPage < totalPages) {
            html += `<a href="#${baseHash}/p${currentPage + 1}" class="pagination-link nav-btn">次へ &raquo;</a>`;
        } else {
            html += `<span class="pagination-link nav-btn disabled">次へ &raquo;</span>`;
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    /**
     * Generate ep menu (spot, chara and special)
     * @returns {Promise<string>} HTML content
     */
    async generateEpMenu() {
        let html = '<div class="ep-menu-container">';
        
        // Spot section
        html += '<div class="ep-section">';
        const spots = await this.generateEpSpotList();
        html += '<h2>スポット</h2>';
        html += '<div class="list-grid ep-spot-grid">';
        spots.forEach(spot => {
            html += `<a href="#ep/spot/${spot.spotId}" class="ep-spot-item" title="スポット ${spot.spotId}">
                <img src="${spot.iconPath}" onerror="this.parentElement.style.display='none'">
            </a>`;
        });
        html += '</div>';
        html += '</div>';
        
        // Chara section
        html += '<div class="ep-section">';
        const characters = await this.generateEpCharaList();
        html += '<h2>キャラクター</h2>';
        html += '<div class="list-grid ep-chara-grid">';
        characters.forEach(chara => {
            html += `<a href="#ep/chara/${chara.charaId}" class="ep-chara-item" title="${chara.displayName}">
                <img src="${chara.iconPath}" onerror="this.parentElement.style.display='none'">
            </a>`;
        });
        html += '</div>';
        html += '</div>';
        
        // Special section
        html += '<div class="ep-section">';
        const specials = await this.generateEpSpecialList();
        html += '<h2>スペシャル</h2>';
        html += '<div class="list-grid ep-special-grid">';
        specials.forEach(special => {
            html += `<a href="#ep/special/${special.dir}" class="list-item" title="${special.displayName}">
                ${special.displayName}
            </a>`;
        });
        html += '</div>';
        html += '</div>';

        // Card section (at the bottom)
        html += '<div class="ep-section">';
        html += '<h2>カード</h2>';
        html += '<a href="#ep/card">カードエピソードはこちらへ</a>';
        html += '</div>';
        
        html += '</div>';
        html += `<div class="back-links">
            <a href="#" class="back-link">← トップへ戻る</a>
        </div>`;
        
        return html;
    }

    /**
     * Generate ep spot list
     * @returns {Promise<string>} HTML content
     */
    async generateEpSpotList() {
        const spots = [];
        
        for (let spotId = EP_SPOT_CONFIG.minSpotId; spotId <= EP_SPOT_CONFIG.maxSpotId; spotId++) {
            let iconNum;
            // spotId 22 uses icon 24, others use spotId + 1
            if (spotId === 22) {
                iconNum = 24;
            } else {
                iconNum = spotId + 1; // spotId 1-21 maps to icon 2-22
            }
            spots.push({
                spotId,
                iconPath: `assets/images/spot_icon/spot_select_icon_${iconNum}_1.png`
            });
        }

        return spots;
    }

    /**
     * Generate ep character list
     * @returns {Promise<Array>} Array of character data
     */
    async generateEpCharaList() {
        const characters = [];
        
        for (let charaId = EP_CHARA_CONFIG.minCharaId; charaId <= EP_CHARA_CONFIG.maxCharaId; charaId++) {
            const characterName = CHARACTER_MAP[charaId] || '';
            const characterDisplayName = CHARACTER_KATAKANA_MAP[characterName] || characterName || '';
            characters.push({
                charaId,
                displayName: characterDisplayName,
                iconPath: `assets/images/chara_icon/epi_chara_icon_${charaId}.png`
            });
        }

        return characters;
    }
    /**
     * Generate ep card list from card-ep.json
     * @returns {Promise<Array>} Array of card data
     */
    async generateEpCardList() {
        const cards = [];

        try {
            // Load card-ep.json mapping
            const response = await fetch('public/scenario/ep/card-ep.json');
            if (!response.ok) throw new Error('Failed to load card-ep.json');
            const cardEpisodeMap = await response.json();

            // Convert to array and sort by card ID numerically in reverse order
            const entries = Object.entries(cardEpisodeMap)
                .map(([cardId, epid]) => ({
                    cardId: parseInt(cardId),
                    epid: parseInt(epid)
                }))
                .sort((a, b) => b.cardId - a.cardId);  // Reverse sort

            // Create card objects with icon paths and displayId
            entries.forEach(({ cardId, epid }) => {
                // Convert to displayId using the -19 rule
                const displayId = getDisplayCardId(cardId);
                cards.push({
                    cardId,
                    displayId,
                    epid,
                    iconPath: `assets/images/card_ep_icon/card_icon_${cardId}.png`
                });
            });
        } catch (error) {
            console.error('Error generating ep card list:', error);
        }

        return cards;
    }

    /**
     * Generate full EP card list view with pagination
     * @param {number} page - Page number (1-based)
     * @returns {Promise<string>} HTML content
     */
    async generateEpCardListView(page = 1) {
        const itemsPerPage = 220;
        const allCards = await this.generateEpCardList();
        const totalPages = Math.ceil(allCards.length / itemsPerPage);
        
        const startIndex = (page - 1) * itemsPerPage;
        const cards = allCards.slice(startIndex, startIndex + itemsPerPage);

        let html = '<div class="ep-card-list-container">';
        
        const paginationHtml = totalPages > 1 ? this.generatePagination(page, totalPages, 'ep/card') : '';
        html += paginationHtml;
        
        html += '<div class="list-grid ep-card-grid">';
        cards.forEach(card => {
            html += `<a href="#ep/card/${card.displayId}" class="ep-card-item" title="カード ${card.displayId}">
                <img src="${card.iconPath}" style="max-width: 70px;" onerror="this.parentElement.style.display='none'">
            </a>`;
        });
        html += '</div>';
        
        html += paginationHtml;
        html += '</div>';
        html += `<div class="back-links">
            <a href="#ep" class="back-link">← エピソードのトップへ戻る</a>
        </div>`;
        
        return html;
    }

    /**
     * Generate ep special list
     * @returns {Promise<Array>} Array of special data
     */
    async generateEpSpecialList() {
        const specials = [];
        
        EP_SPECIAL_CONFIG.directories.forEach(dir => {
            specials.push({
                dir: dir.id,
                displayName: dir.displayName
            });
        });

        return specials;
    }
}

let uiManager = null;

/**
 * Initialize UI Manager
 */
function initUIManager() {
    uiManager = new UIManager();
    uiManager.init();
}
