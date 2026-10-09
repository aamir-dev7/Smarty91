// js/gameMaintenance.js - Universal Platform Lockdown & Live 4-Day Countdown Engine

let isMaintenanceBlocked = false; // Turned off - active working condition!
let currentMaintConfig = {
    enabled: false,
    noticeTitle: 'Adding New Games & Upgrading System',
    noticeMessage: 'Platform update in progress! Adding new games & upgrading system. All gaming and wallet activities are on hold during this upgrade. Stay tuned for the grand release!',
    whitelistedUsers: []
};
let clickInterceptorAttached = false;
let countdownIntervalId = null;

// Countdown Target: Exact 4 days from initialization (persisted in localStorage)
function getTargetTimestamp() {
    const KEY = 'smarty91_maintenance_target_ts';
    let target = Number(localStorage.getItem(KEY));
    const now = Date.now();
    // If not set or already expired, set to 4 days from right now (96 hours)
    if (!target || isNaN(target) || target <= now) {
        target = now + (4 * 24 * 60 * 60 * 1000);
        try {
            localStorage.setItem(KEY, String(target));
        } catch (e) {}
    }
    return target;
}

// Live Countdown Runner: Ticks every 1 second
export function startMaintenanceCountdown() {
    if (countdownIntervalId) clearInterval(countdownIntervalId);

    const tick = () => {
        const target = getTargetTimestamp();
        const now = Date.now();
        const diff = Math.max(0, target - now);

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const dStr = String(days).padStart(2, '0');
        const hStr = String(hours).padStart(2, '0');
        const mStr = String(mins).padStart(2, '0');
        const sStr = String(secs).padStart(2, '0');

        const timeStr = `${dStr}d : ${hStr}h : ${mStr}m : ${sStr}s`;

        const bannerTimer = document.getElementById('banner-countdown-timer');
        if (bannerTimer) bannerTimer.textContent = timeStr;

        const modalTimer = document.getElementById('modal-countdown-display');
        if (modalTimer) modalTimer.textContent = timeStr;

        const overlayTimer = document.getElementById('overlay-countdown-timer');
        if (overlayTimer) overlayTimer.textContent = timeStr;
    };

    tick();
    countdownIntervalId = setInterval(tick, 1000);
}

// Check if current device/user is in whitelist
export function isUserWhitelisted(whitelistedUsers = []) {
    try {
        const phone = (localStorage.getItem('smarty91_user_phone') || '').trim().toLowerCase();
        const userId = (localStorage.getItem('smarty91_user_id') || '').trim().toLowerCase();
        if (!Array.isArray(whitelistedUsers) || whitelistedUsers.length === 0) return false;

        return whitelistedUsers.some(u => {
            const clean = String(u || '').trim().toLowerCase();
            return clean && (clean === phone || clean === userId);
        });
    } catch (e) {
        return false;
    }
}

export function isGameMaintenanceActive() {
    return isMaintenanceBlocked;
}

export function getMaintenanceConfig() {
    return currentMaintConfig;
}

// Determine if the clicked element is an interactive button/action/link (allows smooth scrolling and background reading)
function isActionableTarget(el) {
    if (!el || !(el instanceof Element)) return false;

    // Inside the updating modal itself -> modal handles its own events
    if (el.closest('#game-updating-modal')) return false;

    // Check if the element is or is inside an actionable UI component
    const actionable = el.closest(`
        button,
        a,
        input,
        select,
        textarea,
        [role="button"],
        [role="tab"],
        [role="link"],
        [onclick],
        [data-tab],
        [data-action],
        .bottom-nav-item,
        .home-balance-chip,
        .home-icon-btn,
        .home-brand-block,
        .game-card-launch-btn,
        .game-item-card,
        .game-banner,
        .launch-btn,
        .feature-item,
        .quick-action-item,
        .service-card,
        .nav-item,
        .tab-bar-item,
        .action-btn,
        .van-button,
        .van-tab,
        .Betting__C,
        .Betting__Popup,
        #global-maint-top-bar,
        #game-maint-interceptor-overlay
    `);

    if (actionable) return true;

    // Check computed cursor style for pointer elements (custom clickable buttons/cards)
    try {
        const computed = window.getComputedStyle(el);
        if (computed && computed.cursor === 'pointer') {
            return true;
        }
    } catch (err) {}

    return false;
}

// Master Click Interceptor: Intercepts ONLY clicks on actionable buttons, tabs, links, and games
function handleGameClickDuringMaintenance(e) {
    if (!isMaintenanceBlocked) return;

    // Check if target is inside the updating modal
    const insideModal = e.target.closest('#game-updating-modal');
    if (insideModal) {
        // If it's a close button or user clicked the backdrop outside the card -> allow closing
        const isCloseAction = e.target.closest('.vip-modal-close-btn, #close-game-updating-modal-btn, [data-action="close-modal"]');
        const isBackdropClick = e.target.id === 'game-updating-modal';
        if (isCloseAction || isBackdropClick) {
            closeMaintenancePopupModal();
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // User clicking or selecting text inside the modal card -> allow so they can read or scroll
        return;
    }

    // ONLY intercept actionable elements (buttons, tabs, cards, links). Normal scrolling or empty tap is ALLOWED!
    if (!isActionableTarget(e.target)) {
        return;
    }

    // Intercept click on actionable element
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Display the upgrade popup
    showMaintenancePopupModal();
}

// Dynamically ensure updating modal exists in DOM
function ensureUpdatingModalInDOM() {
    let modal = document.getElementById('game-updating-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'game-updating-modal';
    modal.className = 'vip-modal-backdrop';
    modal.style.cssText = 'display: none; z-index: 9999999;';
    modal.innerHTML = `
        <div class="vip-modal-container" style="max-width: 380px; width: 92%; text-align: center; border: 1.5px solid rgba(245, 158, 11, 0.55); box-shadow: 0 15px 40px rgba(0, 0, 0, 0.95), 0 0 35px rgba(245, 158, 11, 0.25); background: linear-gradient(180deg, #18140c 0%, #0d0b07 100%); border-radius: 14px; padding: 22px 18px; position: relative;">
            <div class="vip-modal-close-btn" data-action="close-modal" onclick="window.closeGameUpdatingModal()" style="position: absolute; top: 12px; right: 12px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; font-size: 15px; color: #fff; cursor: pointer;">✕</div>
            
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; color: #fbbf24; margin-bottom: 10px; letter-spacing: 0.5px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 8px #fbbf24; display: inline-block;"></span>
                <span>ADDING NEW GAMES &amp; UPGRADING SYSTEM</span>
            </div>

            <div style="margin: 2px 0 10px 0;">
                <div style="width: 66px; height: 66px; margin: 0 auto; background: radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(0,0,0,0) 70%); display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(245, 158, 11, 0.3);">
                    <span style="font-size: 34px; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.6));">🚀</span>
                </div>
            </div>

            <div id="game-updating-modal-title" style="font-size: 18px; font-weight: 900; color: #fff; margin-bottom: 6px; letter-spacing: 0.3px; font-family: 'Outfit', sans-serif;">
                Adding New Games &amp; Upgrading System
            </div>

            <div style="background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 10px; padding: 10px 8px; margin: 10px 0 14px 0;">
                <div style="font-size: 10.5px; font-weight: 700; color: #fbbf24; margin-bottom: 4px; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <span>⏳</span>
                    <span>UPGRADE ESTIMATED COMPLETION</span>
                </div>
                <div id="modal-countdown-display" style="font-family: 'JetBrains Mono', 'Outfit', monospace, sans-serif; font-size: 21px; font-weight: 900; color: #fef08a; letter-spacing: 1.5px; text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);">
                    03d : 23h : 59m : 59s
                </div>
                <div style="display: flex; justify-content: center; gap: 20px; font-size: 9px; color: #94a3b8; font-weight: 700; margin-top: 3px; letter-spacing: 0.5px;">
                    <span>DAYS</span>
                    <span>HOURS</span>
                    <span>MINUTES</span>
                    <span>SECONDS</span>
                </div>
            </div>

            <div id="game-updating-modal-msg" style="font-size: 11.5px; color: #cbd5e1; line-height: 1.5; margin-bottom: 14px; padding: 0 4px;">
                Platform update in progress! Adding new games &amp; upgrading system. All gaming and wallet activities are on hold during this upgrade. Stay tuned for the grand release!
            </div>

            <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 9px 12px; margin-bottom: 16px; text-align: left; font-size: 11px; color: #94a3b8; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; color: #fbbf24; font-weight: 700;">
                    <span>⏳</span>
                    <span>4 Days Scheduled Maintenance &amp; Upgrades</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #34d399; font-weight: 700;">
                    <span>🎮</span>
                    <span>Adding brand-new high-multiplier games &amp; modes</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #38bdf8; font-weight: 700;">
                    <span>⚡</span>
                    <span>Enhanced security, lightning speed &amp; higher payouts</span>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button type="button" class="modal-claim-btn" id="close-game-updating-modal-btn" data-action="close-modal" onclick="window.closeGameUpdatingModal()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #111; font-weight: 900; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35); padding: 11px; border-radius: 8px; font-size: 13px; cursor: pointer; border: none; width: 100%;">
                    <span>Close Notice</span>
                </button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMaintenancePopupModal();
        }
    });
    document.body.appendChild(modal);
    return modal;
}

// Show the popup modal populated with current status & notice
export function showMaintenancePopupModal() {
    let modal = ensureUpdatingModalInDOM();
    if (!modal) return;

    const titleEl = document.getElementById('game-updating-modal-title');
    const msgEl = document.getElementById('game-updating-modal-msg');

    if (titleEl) {
        titleEl.textContent = currentMaintConfig.noticeTitle || 'Adding New Games & Upgrading System';
    }
    if (msgEl) {
        msgEl.textContent = currentMaintConfig.noticeMessage || 'Platform update in progress! Adding new games & upgrading system. All gaming and wallet activities are on hold during this upgrade. Stay tuned for the grand release!';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.style.pointerEvents = 'auto';
    modal.style.zIndex = '9999999';

    const container = modal.querySelector('.vip-modal-container');
    if (container) {
        container.style.transform = 'translateY(0) scale(1)';
        container.style.opacity = '1';
    }
}

// Close popup modal when user taps "Close Notice" or "✕"
export function closeMaintenancePopupModal() {
    const modal = document.getElementById('game-updating-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        modal.style.pointerEvents = 'none';
    }
}

// Top Sticky Status Indicator Bar (Non-overlapping, responsive, elegant)
function updateTopBanner(show) {
    let banner = document.getElementById('global-maint-top-bar');
    if (show) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'global-maint-top-bar';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                min-height: 42px;
                z-index: 99998;
                background: linear-gradient(90deg, #1c1305 0%, #301c04 50%, #1c1305 100%);
                color: #fff;
                box-sizing: border-box;
                padding: 4px 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 15px rgba(0,0,0,0.85);
                cursor: pointer;
                border-bottom: 1.5px solid rgba(245, 158, 11, 0.65);
            `;
            banner.innerHTML = `
                <div style="width: 100%; max-width: 480px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <!-- Left Live Indicator & Title -->
                    <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 8px #f59e0b; flex-shrink: 0; animation: smartyPulse 1.2s infinite ease-in-out;"></span>
                        <span style="font-family: 'Outfit', sans-serif; font-size: 11.5px; font-weight: 800; color: #fff; letter-spacing: 0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                            Adding New Games &amp; Upgrading System
                        </span>
                    </div>

                    <!-- Right Countdown Pill -->
                    <div style="display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.6); border: 1px solid rgba(251,191,36,0.5); padding: 3px 8px; border-radius: 12px; font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 11px; font-weight: 800; color: #fef08a; letter-spacing: 0.4px; flex-shrink: 0; box-shadow: 0 0 10px rgba(245,158,11,0.2);">
                        <span style="font-size: 11px; color: #fbbf24;">⏳</span>
                        <span id="banner-countdown-timer">03d : 23h : 59m : 59s</span>
                    </div>
                </div>
            `;
            banner.addEventListener('click', (e) => {
                e.stopPropagation();
                showMaintenancePopupModal();
            });
            document.body.prepend(banner);
        }
        banner.style.display = 'flex';
        // Add top padding to body so the banner never overlaps the brand header
        document.body.style.paddingTop = '42px';
    } else {
        if (banner) {
            banner.style.display = 'none';
        }
        document.body.style.paddingTop = '0px';
    }
}

// Update visual blocker overlay on betting table controls
function updateBlockerOverlay(show) {
    let overlay = document.getElementById('game-maint-interceptor-overlay');
    const bettingContainer = document.querySelector('.Betting__C');

    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'game-maint-interceptor-overlay';
            overlay.style.cssText = `
                position: absolute;
                inset: 0;
                background: rgba(10, 10, 15, 0.88);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 150;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                border: 1px solid rgba(245, 158, 11, 0.4);
                cursor: pointer;
                padding: 16px;
                text-align: center;
                box-shadow: inset 0 0 25px rgba(245, 158, 11, 0.2);
            `;
            overlay.innerHTML = `
                <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.6); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 8px;">
                    ⏳
                </div>
                <div style="font-size: 13.5px; font-weight: 900; color: #fbbf24; letter-spacing: 0.5px; margin-bottom: 4px;">
                    SYSTEM UPGRADING IN PROGRESS
                </div>
                <!-- Live Countdown in Bet Shield -->
                <div id="overlay-countdown-timer" style="font-family: monospace, sans-serif; font-size: 15px; font-weight: 900; color: #fef08a; margin-bottom: 6px; letter-spacing: 0.8px;">
                    03d : 23h : 59m : 59s
                </div>
                <div style="font-size: 11px; color: #cbd5e1; font-weight: 600; line-height: 1.4; max-width: 270px;">
                    Adding new games &amp; upgrading system. All activities on hold.
                </div>
                <div style="margin-top: 10px; background: rgba(245, 158, 11, 0.25); border: 1px solid #fbbf24; color: #fbbf24; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 800;">
                    🔍 VIEW ANNOUNCEMENT
                </div>
            `;
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                showMaintenancePopupModal();
            });
        }

        if (bettingContainer && !bettingContainer.contains(overlay)) {
            const curPos = window.getComputedStyle(bettingContainer).position;
            if (curPos === 'static') {
                bettingContainer.style.position = 'relative';
            }
            bettingContainer.appendChild(overlay);
        }

        // Freeze countdown timer visually
        const timeDivs = document.querySelectorAll('.TimeLeft__C-time > div');
        if (timeDivs.length === 5) {
            timeDivs[0].textContent = '0';
            timeDivs[1].textContent = '0';
            timeDivs[3].textContent = '0';
            timeDivs[4].textContent = '0';
        }
        const timeLabel = document.querySelector('.TimeLeft__C-text');
        if (timeLabel) {
            timeLabel.innerHTML = '<span style="color:#ef4444; font-weight:800;">⏸️ UPGRADE ACTIVE</span>';
        }
    } else {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        const timeLabel = document.querySelector('.TimeLeft__C-text');
        if (timeLabel && timeLabel.textContent.includes('UPGRADE')) {
            timeLabel.textContent = 'Time remaining';
        }
    }
}

// Wrap global navigation functions so direct function calls on action buttons trigger the popup
function wrapGlobalNavigationForMaintenance() {
    const blockableFunctions = [
        'navigateToPage',
        'openDepositHub',
        'openNoticeModal',
        'openDailyCheckInModal',
        'openReferralModal',
        'openGameWithLoader'
    ];

    blockableFunctions.forEach(fnName => {
        const originalFn = window[fnName];
        window[fnName] = function(...args) {
            if (isMaintenanceBlocked) {
                showMaintenancePopupModal();
                return;
            }
            if (typeof originalFn === 'function') {
                return originalFn.apply(this, args);
            }
        };
    });
}

// Master synchronizer called by syncServerGameState and main bootstrap
export function syncGameMaintenanceState(maintData) {
    if (!maintData) return;

    currentMaintConfig = {
        enabled: Boolean(maintData.enabled),
        noticeTitle: maintData.noticeTitle || 'Adding New Games & Upgrading System',
        noticeMessage: maintData.noticeMessage || 'Platform update in progress! Adding new games & upgrading system. All gaming and wallet activities are on hold during this upgrade. Stay tuned for the grand release!',
        whitelistedUsers: Array.isArray(maintData.whitelistedUsers) ? maintData.whitelistedUsers : []
    };

    const isWhitelisted = isUserWhitelisted(currentMaintConfig.whitelistedUsers);
    const wasBlocked = isMaintenanceBlocked;
    isMaintenanceBlocked = currentMaintConfig.enabled && !isWhitelisted;

    // Attach click listener ONLY (do not listen to touchend so touch scrolling is 100% smooth)
    if (!clickInterceptorAttached) {
        window.addEventListener('click', handleGameClickDuringMaintenance, true);
        clickInterceptorAttached = true;
    }

    // Attach global window functions for HTML onclick attributes
    window.closeGameUpdatingModal = closeMaintenancePopupModal;
    window.openGameUpdatingModal = showMaintenancePopupModal;

    wrapGlobalNavigationForMaintenance();

    if (isMaintenanceBlocked) {
        updateTopBanner(true);
        updateBlockerOverlay(true);
        startMaintenanceCountdown();
        // If it just transitioned to blocked, pop up the modal automatically
        if (!wasBlocked) {
            showMaintenancePopupModal();
        }
    } else {
        updateTopBanner(false);
        updateBlockerOverlay(false);
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        if (wasBlocked) {
            closeMaintenancePopupModal();
        }
    }
}

// Auto-bind interceptor immediately on module execution
if (typeof window !== 'undefined') {
    if (!clickInterceptorAttached) {
        // ONLY listen to click events. Do NOT attach touchend, allowing native scrolling everywhere
        window.addEventListener('click', handleGameClickDuringMaintenance, true);
        clickInterceptorAttached = true;
    }
    window.closeGameUpdatingModal = closeMaintenancePopupModal;
    window.openGameUpdatingModal = showMaintenancePopupModal;

    // Show initial top banner and block state ONLY if maintenance is active
    if (isMaintenanceBlocked) {
        wrapGlobalNavigationForMaintenance();
        startMaintenanceCountdown();
        setTimeout(() => {
            updateTopBanner(true);
            updateBlockerOverlay(true);
            showMaintenancePopupModal();
        }, 100);
    } else {
        setTimeout(() => {
            updateTopBanner(false);
            updateBlockerOverlay(false);
            closeMaintenancePopupModal();
        }, 50);
    }
}
