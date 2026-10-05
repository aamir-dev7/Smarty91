// js/gameMaintenance.js - Universal Prediction Game Maintenance & Click Interception Engine

let isMaintenanceBlocked = false;
let currentMaintConfig = {
    enabled: false,
    noticeTitle: 'System Upgrade in Progress',
    noticeMessage: 'We are currently undergoing scheduled system maintenance and major game upgrades for the next 2 days! A big surprise awaits you. Stay tuned!',
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

// Global Click Interceptor: Triggers the popup every time the user clicks ANYWHERE in the game area
function handleGameClickDuringMaintenance(e) {
    if (!isMaintenanceBlocked) return;

    // Target check: Betting buttons, timers, game list, number grids, colors, multipliers
    const inGameArea = e.target.closest(
        '.Betting__C, .TimeLeft__C, .GameList__C, .Betting__Popup, .RecordNav__C, #game-maint-interceptor-overlay, .lottery-notice'
    );

    // Don't intercept clicks inside the modal itself so user can click "Understood" or close
    const insideModal = e.target.closest('#game-updating-modal, .vip-modal-container');

    if (inGameArea && !insideModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Show the custom message popup repeatedly
        showMaintenancePopupModal();
    }
}

// Show the popup modal populated with current custom title & message
export function showMaintenancePopupModal() {
    const modal = document.getElementById('game-updating-modal');
    if (!modal) return;

    const titleEl = document.getElementById('game-updating-modal-title');
    const msgEl = document.getElementById('game-updating-modal-msg');

    if (titleEl) {
        titleEl.textContent = currentMaintConfig.noticeTitle || 'System Upgrade in Progress';
    }
    if (msgEl) {
        msgEl.textContent = currentMaintConfig.noticeMessage || 'We are currently undergoing scheduled system maintenance and major game upgrades for the next 2 days! A big surprise awaits you with exciting rewards. Stay tuned!';
    }

    modal.style.display = 'flex';
}

// Close popup modal when user taps "Understood & Close" or "✕"
export function closeMaintenancePopupModal() {
    const modal = document.getElementById('game-updating-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Update or remove the visual blocker overlay on the betting controls
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
                background: rgba(10, 10, 15, 0.75);
                backdrop-filter: blur(3px);
                -webkit-backdrop-filter: blur(3px);
                z-index: 150;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                border: 1px solid rgba(245, 158, 11, 0.35);
                cursor: pointer;
                padding: 16px;
                text-align: center;
                box-shadow: inset 0 0 20px rgba(245, 158, 11, 0.15);
            `;
            overlay.innerHTML = `
                <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.5); display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 8px; animation: pulse 2s infinite;">
                    ⏸️
                </div>
                <div style="font-size: 13px; font-weight: 900; color: #fbbf24; letter-spacing: 0.5px; margin-bottom: 4px;">
                    GAME TEMPORARILY PAUSED
                </div>
                <div style="font-size: 11px; color: #e2e8f0; font-weight: 600; line-height: 1.4; max-width: 260px;">
                    Maintenance mode is currently active. Tap anywhere to view notice.
                </div>
                <div style="margin-top: 10px; background: rgba(245, 158, 11, 0.25); border: 1px solid #fbbf24; color: #fbbf24; padding: 4px 12px; border-radius: 20px; font-size: 10.5px; font-weight: 800;">
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
            timeLabel.innerHTML = '<span style="color:#ef4444; font-weight:800;">⏸️ GAME PAUSED</span>';
        }
    } else {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        const timeLabel = document.querySelector('.TimeLeft__C-text');
        if (timeLabel && timeLabel.textContent.includes('PAUSED')) {
            timeLabel.textContent = 'Time remaining';
        }
    }
}

// Master synchronizer called by syncServerGameState
export function syncGameMaintenanceState(maintData) {
    if (!maintData) return;

    currentMaintConfig = {
        enabled: Boolean(maintData.enabled),
        noticeTitle: maintData.noticeTitle || 'System Upgrade in Progress',
        noticeMessage: maintData.noticeMessage || 'We are currently undergoing scheduled system maintenance and major game upgrades for the next 2 days! A big surprise awaits you. Stay tuned!',
        whitelistedUsers: Array.isArray(maintData.whitelistedUsers) ? maintData.whitelistedUsers : []
    };

    const isWhitelisted = isUserWhitelisted(currentMaintConfig.whitelistedUsers);
    const wasBlocked = isMaintenanceBlocked;
    isMaintenanceBlocked = currentMaintConfig.enabled && !isWhitelisted;

    // Ensure click interceptor is globally bound in capture phase
    if (!clickInterceptorAttached) {
        window.addEventListener('click', handleGameClickDuringMaintenance, true);
        window.addEventListener('touchend', handleGameClickDuringMaintenance, true);
        clickInterceptorAttached = true;
    }

    // Attach global window functions for HTML onclick attributes
    window.closeGameUpdatingModal = closeMaintenancePopupModal;
    window.openGameUpdatingModal = showMaintenancePopupModal;

    if (isMaintenanceBlocked) {
        updateBlockerOverlay(true);
        // If it just transitioned to blocked, pop it up automatically once
        if (!wasBlocked) {
            showMaintenancePopupModal();
        }
    } else {
        updateBlockerOverlay(false);
        if (wasBlocked) {
            closeMaintenancePopupModal();
        }
    }
}
