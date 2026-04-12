/**
 * ============================================================
 *  admin_dashboard.js — Pinnacle Dental Centre
 *  ElevenLabs AI Agent Analytics Dashboard
 * ============================================================
 *
 * HOW TO CONFIGURE:
 *   1. Set GAS_URL below to your Google Apps Script Web App URL
 *   2. Open admin_dashboard.html in a browser (or via GitHub Pages)
 *   3. Enter your dashboard password to login
 *
 * DEFAULT PASSWORD: pinnacle2024admin
 * (Change in GAS Script Properties → DASHBOARD_PASSWORD)
 * ============================================================
 */

// ─── CONFIG: SET YOUR GAS WEB APP URL HERE ───────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzuu5lo8A60vNV5vSNby36qDJo0Ix8aB8jjuNS1khaQzbTse6tlraPGkgO_G3-kYBUL/exec';
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'pinnacle_dash_pwd';
const CHART_COLORS = {
    blue: '#3198D8',
    seafoam: '#20C997',
    teal: '#17A2B8',
    amber: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6',
    pink: '#EC4899',
    orange: '#F97316',
    lime: '#84CC16',
    cyan: '#06B6D4',
};
const PALETTE = Object.values(CHART_COLORS);

// Chart instances (kept for destroy on refresh)
let trendChartInst = null;
let servicesChartInst = null;
let languagesChartInst = null;
let originChartInst = null;
let calltimeChartInst = null;

// All transcript data cache
let allConversations = [];

// ============================================================
//  LOGIN
// ============================================================
function handleLogin(e) {
    e.preventDefault();
    const pwd = document.getElementById('password-input').value.trim();
    if (!pwd) return;

    // Store in sessionStorage (cleared when tab closes)
    sessionStorage.setItem(SESSION_KEY, pwd);

    // Show dashboard (actual password validation happens on first API call)
    showDashboard();
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Set default date range (last 30 days)
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - 30);
    document.getElementById('end-date').value = formatDateInput(today);
    document.getElementById('start-date').value = formatDateInput(past);

    loadAnalytics();
}

function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('password-input').value = '';
}

// Check if already logged in (page refresh)
window.addEventListener('DOMContentLoaded', function () {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
        showDashboard();
    }
    setupChartDefaults();
});

function setupChartDefaults() {
    Chart.defaults.color = '#64748B';
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.display = false;
}

// ============================================================
//  TAB SWITCHING
// ============================================================
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
    document.getElementById('tab-' + tab).classList.remove('hidden');

    if (tab === 'transcripts' && allConversations.length === 0) {
        loadTranscripts();
    }
}

// ============================================================
//  DATE HELPERS
// ============================================================
function formatDateInput(d) {
    return d.toISOString().substring(0, 10);
}

function fmtDate(ts) {
    if (!ts) return '—';
    const d = (typeof ts === 'number') ? new Date(ts * 1000) : new Date(ts);
    return d.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDuration(secs) {
    if (!secs || secs === 0) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

// ============================================================
//  JSONP FETCH
// ============================================================
function jsonpFetch(params, callbackFn) {
    const callbackName = '_cb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    params.callback = callbackName;

    const qs = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const url = GAS_URL + '?' + qs;

    let timeout;
    window[callbackName] = function (data) {
        clearTimeout(timeout);
        delete window[callbackName];
        document.head.removeChild(script);
        callbackFn(null, data);
    };

    const script = document.createElement('script');
    script.src = url;
    script.onerror = function () {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) document.head.removeChild(script);
        callbackFn(new Error('Network error — could not reach the GAS API.'));
    };

    timeout = setTimeout(function () {
        delete window[callbackName];
        if (script.parentNode) document.head.removeChild(script);
        callbackFn(new Error('Request timed out (45s). The GAS endpoint may be slow — try again.'));
    }, 45000);

    document.head.appendChild(script);
}

// ============================================================
//  ANALYTICS TAB
// ============================================================
function refreshData() {
    loadAnalytics();
    if (allConversations.length > 0) loadTranscripts();
}

function loadAnalytics() {
    const pwd = sessionStorage.getItem(SESSION_KEY) || '';
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    // Show loading
    document.getElementById('analytics-loading').classList.remove('hidden');
    document.getElementById('analytics-error').classList.add('hidden');
    document.getElementById('analytics-content').classList.add('hidden');

    jsonpFetch({
        action: 'getAnalytics',
        password: pwd,
        startDate: startDate,
        endDate: endDate
    }, function (err, result) {
        document.getElementById('analytics-loading').classList.add('hidden');

        if (err) {
            showAnalyticsError(err.message);
            return;
        }

        if (result.error === 'Unauthorized') {
            sessionStorage.removeItem(SESSION_KEY);
            document.getElementById('login-error').classList.remove('hidden');
            logout();
            return;
        }

        if (result.status === 'error') {
            showAnalyticsError(result.message);
            return;
        }

        const data = result.data || result;
        renderAnalytics(data, startDate, endDate);
    });
}

function showAnalyticsError(msg) {
    document.getElementById('analytics-error').classList.remove('hidden');
    document.getElementById('analytics-error-msg').textContent = msg || 'Failed to load analytics.';
}

function renderAnalytics(data, startDate, endDate) {
    document.getElementById('analytics-content').classList.remove('hidden');
    document.getElementById('last-updated').textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-KE');

    // ── KPI Cards ────────────────────────────────────────────
    const total = data.totalConversations || 0;
    const bookings = data.totalBookings || 0;
    const bookRate = total > 0 ? Math.round((bookings / total) * 100) : 0;

    setText('kpi-conversations', total.toLocaleString());
    setText('kpi-period', startDate && endDate ? startDate + ' → ' + endDate : 'All time');
    setText('kpi-bookings', bookings.toLocaleString());
    setText('kpi-booking-rate', bookRate + '% conversion');
    setText('kpi-duration', fmtDuration(data.avgDurationSecs || 0));
    setText('kpi-cost', (data.totalCostCredits || 0).toFixed(2));
    setText('kpi-llm', 'LLM credits: ' + (data.totalLLMCredits || 0).toFixed(2));
    setText('kpi-flagged', (data.flaggedPercent || 0) + '%');
    setText('kpi-flagged-count', (data.flaggedCount || 0) + ' of ' + total + ' users');

    // ── Trend Chart ──────────────────────────────────────────
    renderTrendChart(data.dailyTrend || {});

    // ── Services ─────────────────────────────────────────────
    renderDonutChart('services-chart', 'services-table', data.services || [], servicesChartInst, function (i) { servicesChartInst = i; });

    // ── Languages ────────────────────────────────────────────
    renderDonutChart('languages-chart', 'languages-table', data.languages || [], languagesChartInst, function (i) { languagesChartInst = i; });

    // ── Origin ──────────────────────────────────────────────
    renderHBarChart('origin-chart', data.origins || [], originChartInst, function (i) { originChartInst = i; }, 'Customer Origin (Country Code)');

    // ── Call Time ────────────────────────────────────────────
    const sortedHours = (data.callTimeByHour || []).sort(function (a, b) {
        return parseInt(a.label) - parseInt(b.label);
    });
    renderHBarChart('calltime-chart', sortedHours, calltimeChartInst, function (i) { calltimeChartInst = i; }, 'Conversations by Hour');
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ── Trend Line Chart ─────────────────────────────────────────
function renderTrendChart(dailyTrend) {
    if (trendChartInst) { trendChartInst.destroy(); trendChartInst = null; }

    const sortedDays = Object.keys(dailyTrend).sort();
    const counts = sortedDays.map(d => dailyTrend[d]);

    const ctx = document.getElementById('trend-chart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(49,152,216,0.3)');
    gradient.addColorStop(1, 'rgba(49,152,216,0)');

    trendChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDays.map(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                data: counts,
                borderColor: '#3198D8',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: counts.length > 30 ? 0 : 4,
                pointBackgroundColor: '#3198D8',
                pointBorderColor: '#0F172A',
                pointBorderWidth: 2,
                borderWidth: 2.5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    borderColor: 'rgba(49,152,216,0.3)',
                    borderWidth: 1,
                    titleColor: '#F1F5F9',
                    bodyColor: '#94A3B8',
                    callbacks: {
                        label: ctx => ' Conversations: ' + ctx.raw
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748B', maxTicksLimit: 10 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748B', stepSize: 1 },
                    beginAtZero: true
                }
            }
        }
    });
}

// ── Donut Chart + Percent Table ───────────────────────────────
function renderDonutChart(canvasId, tableId, items, oldInst, setInst) {
    if (oldInst) oldInst.destroy();

    if (!items || items.length === 0) {
        document.getElementById(canvasId).parentElement.innerHTML = '<p style="color:#64748B;font-size:13px;padding:20px">No data yet</p>';
        document.getElementById(tableId).innerHTML = '';
        return;
    }

    const labels = items.map(i => i.label);
    const counts = items.map(i => i.count);
    const colors = items.map((_, idx) => PALETTE[idx % PALETTE.length]);

    const ctx = document.getElementById(canvasId).getContext('2d');
    const inst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.map(c => c + 'CC'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            cutout: '68%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleColor: '#F1F5F9',
                    bodyColor: '#94A3B8',
                    callbacks: {
                        label: ctx => ' ' + ctx.label + ': ' + ctx.raw + ' (' + items[ctx.dataIndex].percent + '%)'
                    }
                }
            }
        }
    });
    setInst(inst);

    // Percent table
    const tableEl = document.getElementById(tableId);
    tableEl.innerHTML = items.slice(0, 8).map((item, idx) =>
        '<div class="percent-row">' +
        '<div class="percent-dot" style="background:' + (PALETTE[idx % PALETTE.length]) + '"></div>' +
        '<span class="percent-label" title="' + item.label + '">' + truncate(item.label, 22) + '</span>' +
        '<span class="percent-pct">' + item.percent + '%</span>' +
        '<span class="percent-count">(' + item.count + ')</span>' +
        '</div>'
    ).join('');
}

// ── Horizontal Bar Chart ─────────────────────────────────────
function renderHBarChart(canvasId, items, oldInst, setInst, title) {
    if (oldInst) oldInst.destroy();

    const el = document.getElementById(canvasId);
    if (!el) return;

    if (!items || items.length === 0) {
        el.parentElement.innerHTML = '<p style="color:#64748B;font-size:13px;padding:20px">No data yet</p>';
        return;
    }

    // Take top 12 items
    const top = items.slice(0, 12);
    const labels = top.map(i => i.label);
    const percs = top.map(i => i.percent);
    const colors = top.map((_, idx) => PALETTE[idx % PALETTE.length]);

    const ctx = el.getContext('2d');
    const inst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: percs,
                backgroundColor: colors.map(c => c + 'BB'),
                borderColor: colors,
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleColor: '#F1F5F9',
                    bodyColor: '#94A3B8',
                    callbacks: {
                        label: ctx => ' ' + ctx.raw + '%  (' + (top[ctx.dataIndex].count) + ')'
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748B', callback: v => v + '%' },
                    max: 100
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#CBD5E1', font: { size: 12 } }
                }
            }
        }
    });
    setInst(inst);
}

// ============================================================
//  TRANSCRIPTS TAB
// ============================================================
function loadTranscripts() {
    const pwd = sessionStorage.getItem(SESSION_KEY) || '';
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    document.getElementById('transcripts-loading').classList.remove('hidden');
    document.getElementById('transcripts-error').classList.add('hidden');
    document.getElementById('transcripts-content').classList.add('hidden');

    jsonpFetch({
        action: 'getTranscripts',
        password: pwd,
        startDate: startDate,
        endDate: endDate
    }, function (err, result) {
        document.getElementById('transcripts-loading').classList.add('hidden');

        if (err) {
            document.getElementById('transcripts-error').classList.remove('hidden');
            document.getElementById('transcripts-error-msg').textContent = err.message;
            return;
        }

        if (result.error === 'Unauthorized') {
            sessionStorage.removeItem(SESSION_KEY);
            logout();
            return;
        }

        if (result.status === 'error') {
            document.getElementById('transcripts-error').classList.remove('hidden');
            document.getElementById('transcripts-error-msg').textContent = result.message;
            return;
        }

        allConversations = (result.data && result.data.conversations) || result.data || [];
        const total = (result.data && result.data.total) || allConversations.length;

        document.getElementById('transcripts-content').classList.remove('hidden');
        document.getElementById('conv-count').textContent = total;
        renderConversationList(allConversations);
    });
}

function refreshTranscripts() { loadTranscripts(); }

// ── Conversation List ─────────────────────────────────────────
function renderConversationList(convs) {
    const listEl = document.getElementById('conv-list');
    if (!convs || convs.length === 0) {
        listEl.innerHTML = '<div style="padding:24px;color:#64748B;font-size:13px;text-align:center">No conversations found for this period</div>';
        return;
    }

    listEl.innerHTML = convs.map(function (conv, idx) {
        const caller = extractCallerLabel(conv);
        const date = fmtDate(conv.start_time_unix_secs ? conv.start_time_unix_secs * 1000 : (conv.start_time || conv.created_at));
        const lang = conv._language || '—';
        const origin = conv._origin || '—';
        const isBook = conv._isBooking;
        const isFlagged = conv.status === 'flagged';
        const preview = getTranscriptPreview(conv);

        const tags = [
            lang !== '—' ? '<span class="conv-tag tag-language">' + escHtml(lang) + '</span>' : '',
            origin !== '—' && origin !== 'Unknown' ? '<span class="conv-tag tag-origin">' + escHtml(origin) + '</span>' : '',
            isBook ? '<span class="conv-tag tag-booking">✓ Booked</span>' : '',
            isFlagged ? '<span class="conv-tag tag-flagged">🚩 Flagged</span>' : ''
        ].filter(Boolean).join('');

        return '<div class="conv-item" data-idx="' + idx + '" onclick="selectConversation(' + idx + ')">' +
            '<div class="conv-item-top">' +
            '<span class="conv-caller">' + escHtml(caller) + '</span>' +
            '<span class="conv-date">' + escHtml(date) + '</span>' +
            '</div>' +
            (tags ? '<div class="conv-tags">' + tags + '</div>' : '') +
            '<div class="conv-preview">' + escHtml(preview) + '</div>' +
            '</div>';
    }).join('');
}

function filterConversations() {
    const q = document.getElementById('conv-search').value.toLowerCase().trim();
    if (!q) { renderConversationList(allConversations); return; }

    const filtered = allConversations.filter(function (conv) {
        const caller = extractCallerLabel(conv).toLowerCase();
        const lang = (conv._language || '').toLowerCase();
        const origin = (conv._origin || '').toLowerCase();
        const preview = getTranscriptPreview(conv).toLowerCase();
        return caller.includes(q) || lang.includes(q) || origin.includes(q) || preview.includes(q);
    });

    renderConversationList(filtered);
}

// ── Conversation Detail ───────────────────────────────────────
function selectConversation(idx) {
    // Highlight active item
    document.querySelectorAll('.conv-item').forEach(function (el) {
        el.classList.remove('active');
        if (parseInt(el.dataset.idx) === idx) el.classList.add('active');
    });

    const conv = allConversations[idx];
    if (!conv) return;

    const panel = document.getElementById('transcript-detail');
    panel.innerHTML = buildTranscriptDetail(conv);

    // Scroll messages to bottom
    const msgs = panel.querySelector('.transcript-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function buildTranscriptDetail(conv) {
    const caller = extractCallerLabel(conv);
    const date = fmtDate(conv.start_time_unix_secs ? conv.start_time_unix_secs * 1000 : (conv.start_time || conv.created_at));
    const dur = fmtDuration(conv.duration || conv.conversation_duration_secs || conv.duration_secs || 0);
    const lang = conv._language || '—';
    const services = (conv._services || []).join(', ') || '—';
    const isBook = conv._isBooking;
    const convId = conv.conversation_id || conv.id || '—';

    // Build transcript messages
    const transcript = conv.transcript || [];
    const messagesHtml = transcript.length > 0
        ? transcript.map(function (msg) {
            const role = (msg.role || 'agent').toLowerCase();
            const text = msg.message || msg.text || msg.content || '';
            const ts = msg.time_in_call_secs != null
                ? formatCallTime(msg.time_in_call_secs)
                : '';
            return '<div class="msg-bubble-wrap ' + role + '">' +
                '<div class="msg-role">' + (role === 'user' ? '👤 Customer' : '🤖 Edna (AI)') + '</div>' +
                '<div class="msg-bubble">' + escHtml(text) + '</div>' +
                (ts ? '<div class="msg-time">' + ts + '</div>' : '') +
                '</div>';
        }).join('')
        : '<div style="color:#64748B;font-size:13px;padding:20px;text-align:center">' +
        (conv._fetchError ? 'Could not load transcript: ' + escHtml(conv._fetchError) : 'No transcript available for this conversation') +
        '</div>';

    return '<div class="transcript-header">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div style="font-family:Outfit,sans-serif;font-size:18px;font-weight:700;color:#F1F5F9">' + escHtml(caller) + '</div>' +
        (isBook ? '<span class="conv-tag tag-booking">✓ Booking Made</span>' : '') +
        '</div>' +
        '<div class="transcript-meta">' +
        metaItem('📅', date) +
        metaItem('⏱️', dur) +
        metaItem('🌍', lang) +
        metaItem('🦷', services) +
        '<span style="font-size:11px;color:#475569;margin-left:auto">ID: ' + escHtml(String(convId).substring(0, 12)) + '…</span>' +
        '</div>' +
        '</div>' +
        '<div class="transcript-messages">' + messagesHtml + '</div>';
}

function metaItem(icon, text) {
    return '<div class="transcript-meta-item">' +
        '<span>' + icon + '</span>' +
        '<span>' + escHtml(String(text)) + '</span>' +
        '</div>';
}

function formatCallTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return (m > 0 ? m + ':' : '0:') + String(s).padStart(2, '0');
}

// ============================================================
//  HELPERS
// ============================================================
function extractCallerLabel(conv) {
    if (conv.metadata) {
        const p = conv.metadata.phone || conv.metadata.caller_id || conv.metadata.from_number;
        if (p) return maskPhone(p);
    }
    if (conv.caller_id) return maskPhone(conv.caller_id);
    if (conv.from) return maskPhone(conv.from);
    const id = conv.conversation_id || conv.id || '';
    return id ? 'Conv ' + String(id).substring(0, 8) : 'Unknown';
}

function maskPhone(phone) {
    const s = String(phone).replace(/\s/g, '');
    if (s.length <= 8) return s;
    return s.substring(0, Math.min(7, s.length - 3)) + '***';
}

function getTranscriptPreview(conv) {
    const msgs = conv.transcript || [];
    // Find first user message
    for (const m of msgs) {
        if ((m.role || '').toLowerCase() === 'user') {
            return (m.message || m.text || '').substring(0, 80);
        }
    }
    return msgs.length > 0 ? (msgs[0].message || msgs[0].text || '').substring(0, 80) : 'No preview available';
}

function truncate(str, len) {
    return str && str.length > len ? str.substring(0, len) + '…' : str;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
