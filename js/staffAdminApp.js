// js/staffAdminApp.js - Dedicated Operations & Moderation Console Engine
import { adminService } from './services/adminService.js';

let activeTab = 'cashier'; // 'cashier' | 'exposure' | 'users'
let selectedMode = '30s';   // '30s' | '1m' | '3m' | '5m'
let txFilterType = 'ALL';   // 'ALL' | 'DEPOSIT' | 'WITHDRAWAL'
let txFilterStatus = 'ALL'; // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
let txSearchQuery = '';
let userSearchQuery = '';
let liveData = null;
let cachedStaffUsers = [];
let pollTimer = null;
let lastKnownPendingCount = -1;
let isAudioAlarmEnabled = localStorage.getItem('smarty91_staff_sound_enabled') !== 'false';
let audioCtx = null;
let isAlarmPlaying = false;

// -------------------------------------------------------------
// AUDIO SYNTHESIZER SIREN ALARM
// -------------------------------------------------------------
function getAudioContext() {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.warn('AudioContext warning:', e);
    }
    return audioCtx;
}

export function play5SecondAlarm() {
    if (!isAudioAlarmEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (isAlarmPlaying) return;
    isAlarmPlaying = true;

    try {
        const now = ctx.currentTime;
        const pulseInterval = 0.75;
        const pulseCount = 7;

        for (let i = 0; i < pulseCount; i++) {
            const startTime = now + (i * pulseInterval);

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(880, startTime);
            osc1.frequency.exponentialRampToValueAtTime(1450, startTime + 0.35);

            gain1.gain.setValueAtTime(0.001, startTime);
            gain1.gain.linearRampToValueAtTime(0.7, startTime + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(startTime);
            osc1.stop(startTime + 0.45);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(1100, startTime + 0.08);
            osc2.frequency.exponentialRampToValueAtTime(1760, startTime + 0.35);

            gain2.gain.setValueAtTime(0.001, startTime + 0.08);
            gain2.gain.linearRampToValueAtTime(0.4, startTime + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(startTime + 0.08);
            osc2.stop(startTime + 0.45);
        }

        setTimeout(() => {
            isAlarmPlaying = false;
        }, 5500);
    } catch (e) {
        console.warn('Audio alarm playback error:', e);
        isAlarmPlaying = false;
    }
}

function initSoundToggle() {
    const soundBtn = document.getElementById('admin-sound-toggle-btn');
    const soundIcon = document.getElementById('sound-icon');
    const soundText = document.getElementById('sound-status-text');

    function updateSoundUI() {
        if (!soundBtn) return;
        if (isAudioAlarmEnabled) {
            soundBtn.style.background = 'rgba(16, 185, 129, 0.15)';
            soundBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            soundBtn.style.color = '#10b981';
            if (soundIcon) soundIcon.textContent = '🔔';
            if (soundText) soundText.textContent = 'Alarm ON';
        } else {
            soundBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            soundBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            soundBtn.style.color = '#ef4444';
            if (soundIcon) soundIcon.textContent = '🔇';
            if (soundText) soundText.textContent = 'Muted';
        }
    }

    updateSoundUI();

    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            getAudioContext();
            isAudioAlarmEnabled = !isAudioAlarmEnabled;
            localStorage.setItem('smarty91_staff_sound_enabled', isAudioAlarmEnabled ? 'true' : 'false');
            updateSoundUI();
            if (isAudioAlarmEnabled) play5SecondAlarm();
        });
    }
}

// -------------------------------------------------------------
// RESPONSIVE SIDEBAR DRAWER
// -------------------------------------------------------------
function initSidebarDrawer() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const layoutWrapper = document.getElementById('admin-layout-wrapper');
    const adminNav = document.getElementById('admin-nav');
    const overlay = document.getElementById('drawer-overlay');

    if (!toggleBtn || !layoutWrapper || !adminNav) return;

    const isCollapsed = localStorage.getItem('smarty91_staff_sidebar_collapsed') === 'true';
    if (isCollapsed && window.innerWidth > 768) {
        layoutWrapper.classList.add('sidebar-collapsed');
    }

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.innerWidth <= 768) {
            adminNav.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        } else {
            layoutWrapper.classList.toggle('sidebar-collapsed');
            localStorage.setItem('smarty91_staff_sidebar_collapsed', layoutWrapper.classList.contains('sidebar-collapsed'));
        }
    });

    if (overlay) {
        overlay.addEventListener('click', () => {
            adminNav.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    const navItems = adminNav.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                adminNav.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
}

// -------------------------------------------------------------
// AUTHENTICATION & LOGIN SCREEN
// -------------------------------------------------------------
function initAuthFlow() {
    const authScreen = document.getElementById('admin-auth-screen');
    const pinInput = document.getElementById('auth-pin-input');
    const submitBtn = document.getElementById('auth-submit-btn');
    const errEl = document.getElementById('auth-error-msg');
    const logoutBtn = document.getElementById('admin-logout-btn');

    const savedPin = sessionStorage.getItem('smarty91_staff_pin') || sessionStorage.getItem('smarty91_admin_pin');

    if (savedPin) {
        verifyPinAndLoad(savedPin);
    } else {
        authScreen.style.display = 'flex';
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            getAudioContext();
            const pin = pinInput.value.trim();
            if (!pin) {
                showAuthError('Please enter password');
                return;
            }
            verifyPinAndLoad(pin);
        });
    }

    if (pinInput) {
        pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                getAudioContext();
                const pin = pinInput.value.trim();
                if (pin) verifyPinAndLoad(pin);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('smarty91_staff_pin');
            sessionStorage.removeItem('smarty91_admin_pin');
            if (pollTimer) clearInterval(pollTimer);
            authScreen.style.display = 'flex';
            pinInput.value = '';
        });
    }

    async function verifyPinAndLoad(pin) {
        if (submitBtn) {
            submitBtn.textContent = 'VERIFYING...';
            submitBtn.disabled = true;
        }
        try {
            await adminService.login(pin, 'staff');
            sessionStorage.setItem('smarty91_staff_pin', pin);
            sessionStorage.setItem('smarty91_admin_pin', pin);
            authScreen.style.display = 'none';
            startLiveSync();
        } catch (err) {
            showAuthError(err.message || 'Invalid Operations Desk Password');
            if (submitBtn) {
                submitBtn.textContent = 'ACCESS OPERATIONS DESK';
                submitBtn.disabled = false;
            }
        }
    }

    function showAuthError(msg) {
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
        }
    }
}

// -------------------------------------------------------------
// REAL-TIME DATA POLLING LOOP
// -------------------------------------------------------------
function startLiveSync() {
    bindNavEvents();
    bindModeChips();
    pollData();
    pollTimer = setInterval(pollData, 2200);
}

async function pollData() {
    try {
        liveData = await adminService.getOverview();
        updateCashierBadge();
        renderActiveTab();
    } catch (err) {
        console.warn('Staff console polling error:', err);
    }
}

function updateCashierBadge() {
    if (!liveData || !liveData.overview) return;
    const pendingDeposits = liveData.overview.pendingDepositsCount || 0;
    const pendingWithdrawals = liveData.overview.pendingWithdrawalsCount || 0;
    const totalPending = pendingDeposits + pendingWithdrawals;

    const badge = document.getElementById('cashier-badge');
    if (badge) {
        if (totalPending > 0) {
            badge.textContent = totalPending;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Audio alarm if count increased
    if (lastKnownPendingCount !== -1 && totalPending > lastKnownPendingCount) {
        play5SecondAlarm();
    }
    lastKnownPendingCount = totalPending;

    // Document title update
    if (totalPending > 0) {
        document.title = `(${totalPending}) Smarty91 Operations Console`;
    } else {
        document.title = `Smarty91 Operations Console`;
    }
}

// -------------------------------------------------------------
// NAVIGATION & MODE CONTROLS
// -------------------------------------------------------------
function bindNavEvents() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            activeTab = item.dataset.tab;
            renderActiveTab(true);
        });
    });
}

function bindModeChips() {
    const chips = document.querySelectorAll('.mode-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedMode = chip.dataset.mode;
            renderActiveTab(true);
        });
    });
}

function renderActiveTab(force = false) {
    const container = document.getElementById('tab-view-container');
    if (!container) return;

    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA') && container.contains(activeEl);

    switch (activeTab) {
        case 'cashier':
            if (!isTyping || force) renderCashierView(container);
            break;
        case 'exposure':
            renderExposureView(container);
            break;
        case 'users':
            renderUsersView(container, force);
            break;
        default:
            if (!isTyping || force) renderCashierView(container);
            break;
    }
}

// -------------------------------------------------------------
// 1. CASHIER VIEW (DEPOSITS & WITHDRAWALS APPROVE / REJECT)
// -------------------------------------------------------------
function renderCashierView(container) {
    const txs = (liveData && liveData.recentTransactions) || [];
    const overview = (liveData && liveData.overview) || {};

    let filtered = [...txs];
    if (txFilterType !== 'ALL') {
        filtered = filtered.filter(t => t.type === txFilterType);
    }
    if (txFilterStatus !== 'ALL') {
        filtered = filtered.filter(t => t.status === txFilterStatus);
    }
    if (txSearchQuery.trim()) {
        const q = txSearchQuery.trim().toLowerCase();
        filtered = filtered.filter(t => 
            (t.id && t.id.toLowerCase().includes(q)) ||
            (t.userId && t.userId.toLowerCase().includes(q)) ||
            (t.utrNumber && t.utrNumber.toLowerCase().includes(q)) ||
            (t.accountNumber && t.accountNumber.toLowerCase().includes(q)) ||
            (t.upiId && t.upiId.toLowerCase().includes(q)) ||
            (t.phone && t.phone.toLowerCase().includes(q))
        );
    }

    const pendingDepositsCount = overview.pendingDepositsCount || 0;
    const pendingWithdrawalsCount = overview.pendingWithdrawalsCount || 0;
    const totalPending = pendingDepositsCount + pendingWithdrawalsCount;

    container.innerHTML = `
        <div class="admin-card">
            <!-- Active Alarm Warning Banner -->
            ${totalPending > 0 ? `
                <div class="alarm-banner">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13px;">
                        <span>🚨</span>
                        <span>${totalPending} PENDING CLEARANCE REQUEST${totalPending > 1 ? 'S' : ''}!</span>
                    </div>
                    <button type="button" id="btn-banner-test-sound" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer;">
                        🔊 Play Siren
                    </button>
                </div>
            ` : ''}

            <div class="card-header">
                <div>
                    <div class="card-title">💰 Operations Cashier & Clearance Desk</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        Process user deposits (Verify UTR) and withdrawal payouts with 1-click Approve or Cancel
                    </div>
                </div>
                <button type="button" id="btn-cashier-test-alarm" class="btn-secondary" style="font-size: 11px; padding: 6px 10px; background: rgba(245, 158, 11, 0.2); color: var(--primary); font-weight: 800; border: 1px solid rgba(245, 158, 11, 0.4);">
                    🔊 Test Alarm
                </button>
            </div>

            <!-- Quick Summary Counters -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                <div style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); border-radius: 10px; padding: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: var(--accent-green); font-weight: 800; text-transform: uppercase;">📥 Pending Deposits</div>
                        <span style="font-size: 10px; font-weight: 800; background: rgba(16,185,129,0.25); color: #10b981; padding: 2px 6px; border-radius: 6px;">${pendingDepositsCount} REQS</span>
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: #fff; margin-top: 4px;">
                        ₹${(overview.pendingDepositsAmount || 0).toLocaleString('en-IN')}
                    </div>
                </div>
                <div style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); border-radius: 10px; padding: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: var(--accent-red); font-weight: 800; text-transform: uppercase;">📤 Pending Withdrawals</div>
                        <span style="font-size: 10px; font-weight: 800; background: rgba(239,68,68,0.25); color: #ef4444; padding: 2px 6px; border-radius: 6px;">${pendingWithdrawalsCount} REQS</span>
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: #fff; margin-top: 4px;">
                        ₹${(overview.pendingWithdrawalsAmount || 0).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>

            <!-- Filter Controls -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; justify-content: space-between;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button class="btn-secondary filter-btn ${txFilterStatus === 'ALL' && txFilterType === 'ALL' ? 'active' : ''}" data-filter="ALL" style="font-size: 11px; padding: 5px 10px;">ALL</button>
                    <button class="btn-secondary filter-btn ${txFilterStatus === 'PENDING' ? 'active' : ''}" data-filter="PENDING" style="font-size: 11px; padding: 5px 10px; background: rgba(245, 158, 11, 0.2); color: var(--primary); font-weight: 800;">PENDING (${totalPending})</button>
                    <button class="btn-secondary filter-btn ${txFilterType === 'DEPOSIT' && txFilterStatus !== 'PENDING' ? 'active' : ''}" data-filter="DEPOSIT" style="font-size: 11px; padding: 5px 10px;">DEPOSITS</button>
                    <button class="btn-secondary filter-btn ${txFilterType === 'WITHDRAWAL' && txFilterStatus !== 'PENDING' ? 'active' : ''}" data-filter="WITHDRAWAL" style="font-size: 11px; padding: 5px 10px;">WITHDRAWALS</button>
                    <button class="btn-secondary filter-btn ${txFilterStatus === 'APPROVED' ? 'active' : ''}" data-filter="APPROVED" style="font-size: 11px; padding: 5px 10px;">APPROVED</button>
                    <button class="btn-secondary filter-btn ${txFilterStatus === 'REJECTED' ? 'active' : ''}" data-filter="REJECTED" style="font-size: 11px; padding: 5px 10px;">REJECTED</button>
                </div>
                <div style="min-width: 220px; flex: 1; max-width: 320px;">
                    <input type="text" id="tx-search-input" class="form-input" placeholder="🔍 Search UTR, Phone, ID..." value="${txSearchQuery}" style="font-size: 11px; padding: 6px 10px;" />
                </div>
            </div>

            <!-- Transactions Table -->
            <div style="overflow-x: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Player</th>
                            <th>Amount</th>
                            <th>Channel & Reference</th>
                            <th>Status</th>
                            <th style="text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? `
                            <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No transactions matching filters.</td></tr>
                        ` : filtered.map(tx => {
                            const isPending = tx.status === 'PENDING';
                            const isDeposit = tx.type === 'DEPOSIT';
                            const formattedTime = new Date(tx.timestamp || tx.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                            return `
                                <tr style="${isPending ? 'background: rgba(245, 158, 11, 0.05);' : ''}">
                                    <td style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">${formattedTime}</td>
                                    <td>
                                        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${isDeposit ? 'background: rgba(16,185,129,0.2); color: #10b981;' : 'background: rgba(56,189,248,0.2); color: #38bdf8;'}">
                                            ${tx.type}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="font-weight: 700; color: #fff; font-size: 12px;">${tx.phone ? '+91 ' + tx.phone : (tx.userId || 'User')}</div>
                                        <div style="font-size: 9.5px; color: var(--text-muted); font-family: monospace;">${tx.userId || ''}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 800; font-size: 13px; color: #fff;">₹${(tx.amount || 0).toLocaleString('en-IN')}</div>
                                        ${tx.usdtAmount ? `<div style="font-size: 10px; color: #38bdf8; font-weight: 700;">$${tx.usdtAmount} USDT</div>` : ''}
                                    </td>
                                    <td style="font-size: 11px;">
                                        <div style="font-weight: 700; color: #e2e8f0;">${tx.paymentMethod || tx.channel || 'Manual'}</div>
                                        ${tx.utrNumber ? `
                                            <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                                <code style="background: rgba(0,0,0,0.4); padding: 1px 4px; border-radius: 3px; font-size: 10px; color: #facc15;">UTR: ${tx.utrNumber}</code>
                                                <button type="button" class="btn-copy-utr" data-val="${tx.utrNumber}" style="background: transparent; border: none; cursor: pointer; font-size: 11px;" title="Copy UTR">📋</button>
                                            </div>
                                        ` : ''}
                                        ${tx.accountNumber ? `
                                            <div style="font-size: 10px; color: var(--text-muted);">A/C: ${tx.accountNumber} • IFSC: ${tx.ifsc || 'N/A'}</div>
                                        ` : ''}
                                        ${tx.adminRemarks ? `
                                            <div style="font-size: 9.5px; color: #94a3b8; font-style: italic; margin-top: 2px;">Note: ${tx.adminRemarks}</div>
                                        ` : ''}
                                    </td>
                                    <td>
                                        <span class="status-badge status-${(tx.status || 'PENDING').toLowerCase()}">
                                            ${tx.status || 'PENDING'}
                                        </span>
                                    </td>
                                    <td style="text-align: right; white-space: nowrap;">
                                        ${isPending ? `
                                            <button type="button" class="btn-tx-approve" data-id="${tx.id}" style="background: #10b981; color: #000; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 800; cursor: pointer; margin-right: 4px;">
                                                ✓ APPROVE
                                            </button>
                                            <button type="button" class="btn-tx-reject" data-id="${tx.id}" style="background: #ef4444; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 800; cursor: pointer;">
                                                ✕ REJECT
                                            </button>
                                        ` : `
                                            <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">Completed</span>
                                        `}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Filter Buttons
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.filter;
            if (f === 'ALL') {
                txFilterType = 'ALL';
                txFilterStatus = 'ALL';
            } else if (f === 'PENDING' || f === 'APPROVED' || f === 'REJECTED') {
                txFilterStatus = f;
            } else if (f === 'DEPOSIT' || f === 'WITHDRAWAL') {
                txFilterType = f;
                txFilterStatus = 'ALL';
            }
            renderCashierView(container);
        });
    });

    // Search Input
    const searchInput = container.querySelector('#tx-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            txSearchQuery = e.target.value;
            renderCashierView(container);
        });
    }

    // Audio Test Buttons
    const sirenBtn1 = container.querySelector('#btn-banner-test-sound');
    if (sirenBtn1) sirenBtn1.addEventListener('click', () => play5SecondAlarm());
    const sirenBtn2 = container.querySelector('#btn-cashier-test-alarm');
    if (sirenBtn2) sirenBtn2.addEventListener('click', () => play5SecondAlarm());

    // Copy UTR buttons
    container.querySelectorAll('.btn-copy-utr').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            if (val) {
                navigator.clipboard.writeText(val);
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = '📋'; }, 1500);
            }
        });
    });

    // APPROVE BUTTON LISTENER
    container.querySelectorAll('.btn-tx-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
            const txId = btn.dataset.id;
            if (!confirm(`Are you sure you want to APPROVE transaction ${txId}? Wallet balance will be credited/debited immediately.`)) {
                return;
            }
            try {
                btn.textContent = 'Approving...';
                btn.disabled = true;
                const res = await adminService.processTransaction(txId, 'APPROVE', 'Approved by Operations Staff');
                alert(res.message || 'Transaction Approved Successfully!');
                await pollData();
            } catch (err) {
                alert(err.message || 'Failed to approve transaction');
            } finally {
                btn.textContent = '✓ APPROVE';
                btn.disabled = false;
            }
        });
    });

    // REJECT BUTTON LISTENER
    container.querySelectorAll('.btn-tx-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
            const txId = btn.dataset.id;
            const remarks = prompt('Enter rejection reason (User will see this notice, e.g. "UTR Unpaid / Verification Failed" or "Account Details Invalid"):', 'UTR Mismatch / Payment not received');
            if (remarks === null) return; // User cancelled prompt

            try {
                btn.textContent = 'Rejecting...';
                btn.disabled = true;
                const res = await adminService.processTransaction(txId, 'REJECT', remarks.trim() || 'Rejected by Operations Staff');
                alert(res.message || 'Transaction Rejected.');
                await pollData();
            } catch (err) {
                alert(err.message || 'Failed to reject transaction');
            } finally {
                btn.textContent = '✕ REJECT';
                btn.disabled = false;
            }
        });
    });
}

// -------------------------------------------------------------
// 2. LIVE BETS & EXPOSURE VIEW (STRICTLY READ-ONLY MONITORING)
// -------------------------------------------------------------
function renderExposureView(container) {
    const exposure = (liveData && liveData.liveExposures && liveData.liveExposures[selectedMode]) || {
        numbers: {}, colors: {}, sizes: {}, totalBetVolume: 0, totalBetsCount: 0
    };

    container.innerHTML = `
        <div class="admin-card">
            <div class="card-header">
                <div>
                    <div class="card-title">🔥 Live Risk Exposure — Smarty91 ${selectedMode}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        Real-time bets monitor and current round exposure distribution
                    </div>
                </div>
                <div style="font-weight: 800; color: var(--accent-blue); font-size: 14px;">
                    Total: ₹${(exposure.totalBetVolume || 0).toLocaleString('en-IN')} (${exposure.totalBetsCount || 0} bets)
                </div>
            </div>

            <!-- Color Exposure -->
            <div style="margin-bottom: 14px;">
                <div class="form-label" style="text-transform: uppercase;">Color Bets Volume</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                    <div style="background: var(--bg-input); border-left: 4px solid var(--accent-green); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 10px; color: var(--text-muted);">GREEN</div>
                        <div style="font-size: 15px; font-weight: 800; color: #fff;">₹${(exposure.colors?.green || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style="background: var(--bg-input); border-left: 4px solid var(--accent-violet); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 10px; color: var(--text-muted);">VIOLET</div>
                        <div style="font-size: 15px; font-weight: 800; color: #fff;">₹${(exposure.colors?.violet || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style="background: var(--bg-input); border-left: 4px solid var(--accent-red); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 10px; color: var(--text-muted);">RED</div>
                        <div style="font-size: 15px; font-weight: 800; color: #fff;">₹${(exposure.colors?.red || 0).toLocaleString('en-IN')}</div>
                    </div>
                </div>
            </div>

            <!-- Size Exposure -->
            <div style="margin-bottom: 14px;">
                <div class="form-label" style="text-transform: uppercase;">Size Bets Volume</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <div style="background: var(--bg-input); border-left: 4px solid var(--primary); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 10px; color: var(--text-muted);">BIG (5-9)</div>
                        <div style="font-size: 15px; font-weight: 800; color: #fff;">₹${(exposure.sizes?.big || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style="background: var(--bg-input); border-left: 4px solid var(--accent-blue); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 10px; color: var(--text-muted);">SMALL (0-4)</div>
                        <div style="font-size: 15px; font-weight: 800; color: #fff;">₹${(exposure.sizes?.small || 0).toLocaleString('en-IN')}</div>
                    </div>
                </div>
            </div>

            <!-- Number Distribution Grid -->
            <div>
                <div class="form-label" style="text-transform: uppercase;">Individual Number Exposure (0 - 9)</div>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                    ${[0,1,2,3,4,5,6,7,8,9].map(num => `
                        <div style="background: var(--bg-input); padding: 8px 4px; border-radius: 6px; text-align: center; border: 1px solid var(--border-color);">
                            <div style="font-weight: 800; font-size: 12px; color: var(--primary);">#${num}</div>
                            <div style="font-size: 11px; font-weight: 700; color: #fff; margin-top: 2px;">
                                ₹${(exposure.numbers && exposure.numbers[num]) || 0}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// 3. PLAYERS DIRECTORY VIEW (STRICTLY READ-ONLY)
// -------------------------------------------------------------
function renderUsersView(container, force = false) {
    const isMounted = container.querySelector('#staff-users-view');
    if (!isMounted || force) {
        container.innerHTML = `
            <div id="staff-users-view" class="admin-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <div class="card-title">👤 Registered Player Accounts</div>
                        <div style="font-size: 11px; color: var(--text-muted);">Review user balances, mobile accounts, turnover, and deposit activity</div>
                    </div>
                    <div style="width: 260px; max-width: 100%;">
                        <input type="text" id="staff-user-search-input" class="form-input" placeholder="🔍 Search phone or ID..." value="${userSearchQuery}" style="padding: 6px 10px; font-size: 12px;" />
                    </div>
                </div>

                <div id="staff-users-table-wrap">
                    <div style="text-align: center; color: var(--text-muted); padding: 20px;">Loading player accounts...</div>
                </div>
            </div>
        `;

        const searchInput = container.querySelector('#staff-user-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                userSearchQuery = e.target.value.toLowerCase().trim();
                renderStaffUsersTable(container);
            });
        }
    }

    refreshStaffUsers(container);
}

async function refreshStaffUsers(container) {
    try {
        const res = await adminService.getUsers();
        if (res && res.users) {
            const seenIds = new Set();
            const seenPhones = new Set();
            const deduped = [];
            for (const u of res.users) {
                if (!u || !u.id) continue;
                if (seenIds.has(u.id)) continue;
                if (u.phone && seenPhones.has(u.phone)) continue;
                seenIds.add(u.id);
                if (u.phone) seenPhones.add(u.phone);
                deduped.push(u);
            }
            cachedStaffUsers = deduped;
            renderStaffUsersTable(container);
        }
    } catch (err) {
        console.warn('Failed to load users for staff:', err);
    }
}

function renderStaffUsersTable(container) {
    const wrap = container.querySelector('#staff-users-table-wrap');
    if (!wrap) return;

    let filtered = [...cachedStaffUsers];
    if (userSearchQuery) {
        filtered = filtered.filter(u => 
            (u.phone && u.phone.includes(userSearchQuery)) ||
            (u.id && u.id.toLowerCase().includes(userSearchQuery)) ||
            (u.username && u.username.toLowerCase().includes(userSearchQuery))
        );
    }

    wrap.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Player ID</th>
                        <th>Mobile Number</th>
                        <th>Available Balance</th>
                        <th>Turnover Req</th>
                        <th>Deposited Status</th>
                        <th>Joined Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.length === 0 ? `
                        <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No players found matching query.</td></tr>
                    ` : filtered.map(u => {
                        const hasDep = !!u.hasDeposited;
                        const joinedTime = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A';
                        return `
                            <tr>
                                <td style="font-family: monospace; font-size: 11px; color: #cbd5e1;">${u.id}</td>
                                <td>
                                    <span style="font-weight: 700; color: #fff; font-size: 12px;">
                                        ${u.phone ? '+91 ' + u.phone : (u.username || 'Guest')}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-weight: 800; font-size: 13px; color: var(--accent-green);">
                                        ₹${(u.balance || 0).toFixed(2)}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-size: 11px; color: ${u.requiredTurnover > 0 ? '#facc15' : '#94a3b8'};">
                                        ₹${(u.requiredTurnover || 0).toFixed(2)}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${hasDep ? 'background: rgba(16,185,129,0.2); color: #10b981;' : 'background: rgba(148,163,184,0.15); color: #94a3b8;'}">
                                        ${hasDep ? '✓ DEPOSITED' : 'NO DEPOSIT'}
                                    </span>
                                </td>
                                <td style="font-size: 11px; color: var(--text-muted);">${joinedTime}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initSidebarDrawer();
    initSoundToggle();
    initAuthFlow();
});
