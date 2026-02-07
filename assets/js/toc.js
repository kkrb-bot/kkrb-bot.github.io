
class TableOfContents {
    constructor() {
        this.toc = null;
        this.tocList = null;
        this.floatingBtn = null;
        this.observer = null;
        this.activeSection = null;
        this.resizeTimeout = null;
        this.closeOutsideHandler = null;
        this.cachedHeadingCount = 0;
        this.currentHash = null;
        this.resizeListenerAttached = false;
    }

    init() {
        setTimeout(() => this.setup(), 100);

        if (!this.resizeListenerAttached) {
            window.addEventListener('resize', () => this.handleResize());
            this.resizeListenerAttached = true;
        }
    }

    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            // TOC表示モードを強制更新
            if (this.toc) {
                if (window.innerWidth >= 769) {
                    this.toc.classList.add('visible');
                    this.toc.classList.remove('floating');
                    this.toc.classList.remove('floating-open');
                    // フローティングボタンを隠す
                    if (this.floatingBtn) {
                        this.floatingBtn.style.display = 'none';
                    }
                } else {
                    this.toc.classList.remove('visible');
                    this.toc.classList.add('floating');
                    this.toc.classList.remove('floating-open');
                    // フローティングボタンが存在し表示されることを確認
                    this.createFloatingButton();
                    if (this.floatingBtn) {
                        this.floatingBtn.style.display = 'block';
                        this.floatingBtn.style.opacity = '1';
                        this.floatingBtn.style.pointerEvents = 'auto';
                    }
                }
            }
        }, 250);
    }

    setup() {
        const hash = window.location.hash.substring(1) || 'home';
        const parts = hash.split('/');
        const page = parts[0];

        if (page === 'home') {
            this.hideTOC();
            return;
        }

        const allHeadings = document.querySelectorAll('main h2, main h3, main h4');
        const headings = Array.from(allHeadings).filter(h => !h.classList.contains('no-toc-title'));
        const headingCount = headings.length;

        if (headingCount < 2) {
            this.hideTOC();
            return;
        }

        if (this.currentHash === hash && this.cachedHeadingCount === headingCount) {
            return;
        }

        this.currentHash = hash;
        this.cachedHeadingCount = headingCount;

        this.createTOC(headings);
        this.createFloatingButton();
        this.setupScrollTracking(headings);
        this.showTOC();
    }

    createTOC(headings) {
        if (!this.toc) {
            this.toc = document.createElement('div');
            this.toc.className = 'table-of-contents';
            this.toc.id = 'toc-container';
            document.body.appendChild(this.toc);
        }

        this.toc.innerHTML = '';

        const tocTitle = document.createElement('div');
        tocTitle.className = 'toc-title';
        tocTitle.textContent = 'Table of Contents';
        this.toc.appendChild(tocTitle);

        this.tocList = document.createElement('ul');
        this.tocList.className = 'toc-list';

        // specialページかどうかを判断し、specialページでは完全なタイトルを表示
        const hash = window.location.hash.substring(1) || 'home';
        const isSpecialPage = hash.includes('ep/special');

        headings.forEach((heading, index) => {
            const li = document.createElement('li');
            const a = document.createElement('a');

            if (!heading.id) {
                heading.id = `heading-${index}`;
            }

            let displayText = heading.textContent;
            // specialページでは完全なタイトルを表示し、他のページでは元のロジックを継続
            if (!isSpecialPage && displayText.includes('|')) {
                displayText = displayText.split('|')[1].trim();
            }

            a.href = `#${heading.id}`;
            a.textContent = displayText;
            a.className = 'toc-link';
            a.style.borderBottom = 'none';

            a.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth' });
            });

            li.appendChild(a);
            this.tocList.appendChild(li);
        });

        this.toc.appendChild(this.tocList);

        this.toc.classList.remove('toc-hidden');
        const btn = document.getElementById('tocFloatingBtn');
        if (btn) {
            btn.classList.remove('toc-hidden');
        }

        if (window.innerWidth >= 769) {
            this.toc.classList.add('visible');
            this.toc.classList.remove('floating');
            this.toc.classList.remove('floating-open');
        } else {
            this.toc.classList.remove('visible');
            this.toc.classList.add('floating');
            this.toc.classList.remove('floating-open');
            this.createFloatingButton();
        }
    }

    createFloatingButton() {
        if (window.innerWidth >= 769) {
            return;
        }

        if (!this.floatingBtn) {
            this.floatingBtn = document.getElementById('tocFloatingBtn');

            if (this.floatingBtn) {
                this.floatingBtn.style.cssText = `
                    position: fixed !important;
                    top: 30% !important;
                    right: 8px !important;
                    width: 40px !important;
                    height: 40px !important;
                    border-radius: 50% !important;
                    background: rgba(184, 99, 158, 0.85) !important;
                    color: white !important;
                    border: none !important;
                    outline: none !important;
                    font-size: 1.2rem !important;
                    cursor: pointer !important;
                    z-index: 9 !important;
                    box-shadow: 0 2px 8px rgba(184, 99, 158, 0.25) !important;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    line-height: 40px !important;
                    text-align: center !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    backdrop-filter: blur(8px) !important;
                    -webkit-tap-highlight-color: transparent !important;
                    -webkit-appearance: none !important;
                `;

                this.floatingBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.floatingBtn.blur();
                    if (this.toc) {
                        this.toc.classList.toggle('floating-open');
                        if (this.toc.classList.contains('floating-open')) {
                            this.floatingBtn.style.opacity = '0';
                            this.floatingBtn.style.pointerEvents = 'none';
                        } else {
                            this.floatingBtn.style.opacity = '1';
                            this.floatingBtn.style.pointerEvents = 'auto';
                        }
                    }
                });

                this.floatingBtn.addEventListener('mouseover', () => {
                    this.floatingBtn.style.transform = 'scale(1.12) translateY(-2px)';
                    this.floatingBtn.style.boxShadow = '0 8px 16px rgba(184, 99, 158, 0.35)';
                    this.floatingBtn.style.background = 'rgba(184, 99, 158, 0.95)';
                });

                this.floatingBtn.addEventListener('mouseout', () => {
                    this.floatingBtn.style.transform = 'scale(1)';
                    this.floatingBtn.style.boxShadow = '0 2px 8px rgba(184, 99, 158, 0.25)';
                    this.floatingBtn.style.background = 'rgba(184, 99, 158, 0.85)';
                });

                if (!this.closeOutsideHandler) {
                    this.closeOutsideHandler = (e) => {
                        if (this.toc && this.floatingBtn) {
                            if (!this.toc.contains(e.target) && !this.floatingBtn.contains(e.target)) {
                                this.toc.classList.remove('floating-open');
                                this.floatingBtn.style.opacity = '1';
                                this.floatingBtn.style.pointerEvents = 'auto';
                            }
                        }
                    };
                    document.addEventListener('click', this.closeOutsideHandler);
                }
            }
        }

        if (this.toc) {
            this.toc.classList.add('floating');
        }
    }

    setupScrollTracking(headings) {
        const options = {
            root: null,
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.setActiveLink(entry.target.id);
                }
            });
        }, options);

        headings.forEach(heading => {
            this.observer.observe(heading);
        });
    }

    setActiveLink(headingId) {
        document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.remove('active');
            link.style.borderBottom = 'none';
            link.style.borderLeft = 'none';
        });

        const activeLink = document.querySelector(`.toc-link[href="#${headingId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            activeLink.style.borderBottom = 'none';
            activeLink.style.borderLeft = '3px solid #b8639e';
            activeLink.style.paddingLeft = 'calc(0.4rem - 3px)';
        }
    }

    hide() {
        if (this.toc) {
            this.toc.classList.add('toc-hidden');
        }
        const btn = document.getElementById('tocFloatingBtn');
        if (btn) {
            btn.classList.add('toc-hidden');
        }
    }

    hideTOC() {
        this.hide();
    }

    showTOC() {
        this.show();
    }

    show() {
        if (this.toc) {
            this.toc.classList.remove('toc-hidden');
        }
        const btn = document.getElementById('tocFloatingBtn');
        if (btn) {
            btn.classList.remove('toc-hidden');
        }
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

const toc = new TableOfContents();

window.addEventListener('load', () => {
    toc.init();
});

window.addEventListener('hashchange', () => {
    toc.destroy();
    toc.init();
});
