// js/gameMaintenance.js - Universal Platform Lockdown & 4-Day Pending Status Interceptor

let isMaintenanceBlocked = true; // Active by default
let currentMaintConfig = {
    enabled: true,
    noticeTitle: 'System Update & New Games Launch',
    noticeMessage: 'Platform update in progress! We are upgrading our system and integrating exciting new games. All gaming and wallet activities are on hold during this 4-day pending upgrade. Stay tuned for the grand release!',
    whitelistedUsers: []
};
let clickInterceptorAttached = false;

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

// Master Click Interceptor: Intercepts EVERY click on dashboard, buttons, tabs, links, and games
function handleGameClickDuringMaintenance(e) {
    if (!isMaintenanceBlocked) return;

    // Allow user to click the close button or "Understood" button inside the modal itself
    const isModalCloseBtn = e.target.closest('.vip-modal-close-btn, .modal-claim-btn, #close-game-updating-modal-btn');
    if (isModalCloseBtn) {
        return; // Allow modal close action
    }

    // Don't intercept clicks inside the modal body so user can scroll or read
    const isInsideModal = e.target.closest('#game-updating-modal, .vip-modal-container');
    if (isInsideModal) {
        return;
    }

    // Intercept ANY click on ANY button, card, link, tab, navigation, or dashboard element
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Repeatedly display the 4-day pending upgrade popup
    showMaintenancePopupModal();
}

// Show the popup modal populated with current 4-day status & custom notice
export function showMaintenancePopupModal() {
    const modal = document.getElementById('game-updating-modal');
    if (!modal) return;

    const titleEl = document.getElementById('game-updating-modal-title');
    const msgEl = document.getElementById('game-updating-modal-msg');

    if (titleEl) {
        titleEl.textContent = currentMaintConfig.noticeTitle || 'System Update & New Games Launch';
    }
    if (msgEl) {
        msgEl.textContent = currentMaintConfig.noticeMessage || 'Platform update in progress! We are upgrading our system and integrating exciting new games. All gaming and wallet activities are on hold during this 4-day pending upgrade. Stay tuned for the grand release!';
    }

    modal.style.display = 'flex';
}

// Close popup modal when user taps "Understood" or "✕"
export function closeMaintenancePopupModal() {
    const modal = document.getElementById('game-updating-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Top Sticky Status Indicator Bar
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
                z-index: 99998;
                background: linear-gradient(90deg, #92400e 0%, #d97706 50%, #92400e 100%);
                color: #fff;
                font-size: 11px;
                font-weight: 800;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 4px 20px rgba(0,0,0,0.6);
                cursor: pointer;
                border-bottom: 1px solid rgba(251, 191, 36, 0.4);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            `;
            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="font-size: 13px;">⏳</span>
                    <span style="color: #fef08a; letter-spacing: 0.3px;">4 DAYS PENDING STATUS:</span>
                    <span style="color: #fff; font-weight: 600;">System upgrade &amp; new games launch in progress</span>
                </div>
                <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.25); padding: 3px 9px; border-radius: 12px; font-size: 10px; font-weight: 800; color: #fbbf24; flex-shrink: 0; margin-left: 8px;">
                    Tap Notice ❯
                </div>
            `;
            banner.addEventListener('click', (e) => {
                e.stopPropagation();
                showMaintenancePopupModal();
            });
            document.body.prepend(banner);
        }
        banner.style.display = 'flex';
    } else {
        if (banner) {
            banner.style.display = 'none';
        }
    }
}

// Update or remove the visual blocker overlay on betting table controls
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
                background: rgba(10, 10, 15, 0.82);
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
                <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.6); display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 8px;">
                    ⏳
                </div>
                <div style="font-size: 13.5px; font-weight: 900; color: #fbbf24; letter-spacing: 0.5px; margin-bottom: 4px;">
                    4 DAYS PENDING STATUS
                </div>
                <div style="font-size: 11px; color: #e2e8f0; font-weight: 600; line-height: 1.4; max-width: 270px;">
                    System updating in progress. All gaming activities are paused while new games are being added.
                </div>
                <div style="margin-top: 10px; background: rgba(245, 158, 11, 0.25); border: 1px solid #fbbf24; color: #fbbf24; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 800;">
                    🔍 VIEW ANNOUNCEMENT
                </div>
            `;
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
            timeLabel.innerHTML = '<span style="color:#ef4444; font-weight:800;">⏸️ 4 DAYS PENDING</span>';
        }
    } else {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        const timeLabel = document.querySelector('.TimeLeft__C-text');
        if (timeLabel && timeLabel.textContent.includes('PENDING')) {
            timeLabel.textContent = 'Time remaining';
        }
    }
}

// Master synchronizer called by syncServerGameState and main bootstrap
export function syncGameMaintenanceState(maintData) {
    if (!maintData) return;

    currentMaintConfig = {
        enabled: Boolean(maintData.enabled),
        noticeTitle: maintData.noticeTitle || 'System Update & New Games Launch',
        noticeMessage: maintData.noticeMessage || 'Platform update in progress! We are upgrading our system and integrating exciting new games. All gaming and wallet activities are on hold during this 4-day pending upgrade. Stay tuned for the grand release!',
        whitelistedUsers: Array.isArray(maintData.whitelistedUsers) ? maintData.whitelistedUsers : []
    };

    const isWhitelisted = isUserWhitelisted(currentMaintConfig.whitelistedUsers);
    const wasBlocked = isMaintenanceBlocked;
    isMaintenanceBlocked = currentMaintConfig.enabled && !isWhitelisted;

    // Ensure capture-phase click and touch interceptors are bound globally
    if (!clickInterceptorAttached) {
        window.addEventListener('click', handleGameClickDuringMaintenance, true);
        window.addEventListener('touchend', handleGameClickDuringMaintenance, true);
        clickInterceptorAttached = true;
    }

    // Attach global window functions for HTML onclick attributes
    window.closeGameUpdatingModal = closeMaintenancePopupModal;
    window.openGameUpdatingModal = showMaintenancePopupModal;

    if (isMaintenanceBlocked) {
        updateTopBanner(true);
        updateBlockerOverlay(true);
        // If it just transitioned to blocked, pop up the modal automatically
        if (!wasBlocked) {
            showMaintenancePopupModal();
        }
    } else {
        updateTopBanner(false);
        updateBlockerOverlay(false);
        if (wasBlocked) {
            closeMaintenancePopupModal();
        }
    }
}

// Auto-bind interceptor immediately on module execution
if (typeof window !== 'undefined') {
    if (!clickInterceptorAttached) {
        window.addEventListener('click', handleGameClickDuringMaintenance, true);
        window.addEventListener('touchend', handleGameClickDuringMaintenance, true);
        clickInterceptorAttached = true;
    }
    window.closeGameUpdatingModal = closeMaintenancePopupModal;
    window.openGameUpdatingModal = showMaintenancePopupModal;

    // Show initial top banner and block state
    if (isMaintenanceBlocked) {
        setTimeout(() => {
            updateTopBanner(true);
            updateBlockerOverlay(true);
            showMaintenancePopupModal();
        }, 150);
    }
}
