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
let activeConv = null;

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
        document.getElementById('transcripts-error').classList.add('hidden');
        loadTranscripts();
    } else if (tab === 'content') {
        loadAdminContent();
    } else if (tab === 'media') {
        loadAdminContent(); // Media is included in admin content
    }
}

/**
 * ============================================================
 *  ADMIN: CONTENT & MEDIA MANAGEMENT
 * ============================================================
 */

let quill = null;
let currentContentType = 'services';
let adminDataCache = null;

// Initialize Quill when DOM loads
window.addEventListener('DOMContentLoaded', function () {
    if (typeof Quill !== 'undefined') {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    ['link', 'blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });
    }

    const uploadInput = document.getElementById('media-upload-input');
    if (uploadInput) {
        uploadInput.addEventListener('change', handleMediaUpload);
    }
});

/**
 * Load all admin data from GAS
 */
function loadAdminContent() {
    const pwd = sessionStorage.getItem(SESSION_KEY) || '';

    // Show spinner if needed (optional, generic dashboard loading might handle it)

    jsonpFetch({
        action: 'getAdminContent',
        password: pwd
    }, function (err, result) {
        if (err) {
            alert('Error loading content: ' + err.message);
            return;
        }

        if (result.status === 'error') {
            alert('Error: ' + result.message);
            return;
        }

        adminDataCache = result.data;
        console.log('Admin Data Cache:', adminDataCache);
        renderCurrentContentTable();
        renderMediaLibrary();
    });
}

/**
 * Switch between Services/Blog/Products/Comparisons
 */
function switchContentType(type) {
    currentContentType = type;
    document.querySelectorAll('.content-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    renderCurrentContentTable();
}

/**
 * Render table based on selected content type
 */
function renderCurrentContentTable() {
    if (!adminDataCache) return;

    const tableHead = document.getElementById('data-table-head');
    const tableBody = document.getElementById('data-table-body');
    const data = adminDataCache[currentContentType] || [];

    if (data.length === 0) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#64748B">No entries found. Click "Add New Entry" to start.</td></tr>';
        return;
    }

    // Determine headers based on first object
    const headers = Object.keys(data[0]);
    tableHead.innerHTML = '<tr>' +
        headers.map(h => '<th>' + h.toUpperCase() + '</th>').join('') +
        '<th>ACTIONS</th></tr>';

    tableBody.innerHTML = data.map((entry, idx) => `
        <tr>
            ${headers.map(h => `<td>${truncate(String(entry[h]), 50)}</td>`).join('')}
            <td>
                <div class="action-btns">
                    <button class="edit-btn" onclick="openEntryModal(${idx})" title="Edit"><i data-lucide="edit-3"></i></button>
                    <button class="delete-btn" onclick="confirmDelete('${entry.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Handle Add/Edit Modal
 */
function openEntryModal(idx) {
    const modal = document.getElementById('entry-modal');
    const title = document.getElementById('modal-entry-title');
    const formFields = document.getElementById('form-fields');
    const entry = idx !== null ? adminDataCache[currentContentType][idx] : null;

    title.innerText = (entry ? 'Edit ' : 'Add New ') + currentContentType.slice(0, -1);

    // Auto-generate fields based on schema or existing data
    // For a real app, we should have a fixed schema per type
    const schemas = {
        services: ['id', 'name', 'category', 'icon', 'accent', 'img', 'desc1', 'desc2', 'isNew', 'features'],
        blog: ['id', 'title', 'tag', 'readTime', 'date', 'img', 'excerpt', 'content'],
        products: ['id', 'name', 'price', 'desc', 'availability', 'delivery', 'images', 'features'],
        comparisons: ['id', 'title', 'subtitle', 'before', 'after', 'tag']
    };

    const fields = schemas[currentContentType] || (entry ? Object.keys(entry) : []);

    formFields.innerHTML = fields.map(f => {
        if (f === 'content' && currentContentType === 'blog') return ''; // Handled by Quill
        if (f === 'id' && !entry) return `<input type="hidden" name="id" value="">`; // Hidden ID for new entries

        let val = entry ? entry[f] : '';
        let type = 'text';
        if (f === 'desc1' || f === 'desc2' || f === 'desc' || f === 'excerpt') type = 'textarea';

        return `
            <div class="form-field">
                <label class="form-label">${f.toUpperCase()}</label>
                ${type === 'textarea'
                ? `<textarea name="${f}" class="form-textarea" placeholder="Enter ${f}...">${val}</textarea>`
                : `<input type="${type}" name="${f}" value="${escHtml(val)}" class="form-input" placeholder="Enter ${f}...">`
            }
            </div>
        `;
    }).join('');

    // Handle Quill for Blog
    if (currentContentType === 'blog') {
        document.getElementById('wysiwyg-container').classList.remove('hidden');
        if (quill) {
            quill.root.innerHTML = entry ? (entry.content || '') : '';
        }
    } else {
        document.getElementById('wysiwyg-container').classList.add('hidden');
    }

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeEntryModal() {
    document.getElementById('entry-modal').classList.add('hidden');
}

/**
 * Save Entry to GAS
 */
function saveEntry(e) {
    e.preventDefault();
    const btn = e.target.closest('button');
    const spinner = document.getElementById('save-spinner');

    const formData = new FormData(document.getElementById('entry-form'));
    const entry = {};
    formData.forEach((val, key) => entry[key] = val);

    if (currentContentType === 'blog' && quill) {
        entry.content = quill.root.innerHTML;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');

    // Use POST instead of JSONP for potentially large content
    gasPost({
        action: 'adminAction',
        subAction: 'saveEntry',
        table: currentContentType === 'blog' ? 'BlogPosts' :
            currentContentType === 'services' ? 'Services' :
                currentContentType === 'products' ? 'Products' : 'Comparisons',
        entry: JSON.stringify(entry),
        password: sessionStorage.getItem(SESSION_KEY)
    }).then(result => {
        btn.disabled = false;
        spinner.classList.add('hidden');

        if (result.status === 'error') {
            alert('Save failed: ' + result.message);
            return;
        }

        closeEntryModal();
        loadAdminContent();
    }).catch(err => {
        btn.disabled = false;
        spinner.classList.add('hidden');
        alert('Error saving: ' + err.message);
    });
}

function confirmDelete(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        jsonpFetch({
            action: 'adminAction',
            subAction: 'deleteEntry',
            table: currentContentType === 'blog' ? 'BlogPosts' :
                currentContentType === 'services' ? 'Services' :
                    currentContentType === 'products' ? 'Products' : 'Comparisons',
            id: id,
            password: sessionStorage.getItem(SESSION_KEY)
        }, function (err, result) {
            if (err) alert('Delete failed: ' + err.message);
            else loadAdminContent();
        });
    }
}

/**
 * Media Library Functions
 */
function renderMediaLibrary() {
    if (!adminDataCache) return;

    const grid = document.getElementById('media-grid');
    const media = adminDataCache.media || [];

    if (media.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(30, 41, 59, 0.3); border-radius: 24px; border: 2px dashed rgba(255, 255, 255, 0.05);">
                <i data-lucide="image" style="width: 48px; height: 48px; color: #475569; margin-bottom: 16px;"></i>
                <p style="color: #94A3B8; font-size: 15px;">Your media library is empty.</p>
                <p style="color: #64748B; font-size: 13px; margin-top: 8px;">Upload images to use them in your services and blog posts.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    grid.innerHTML = media.map(file => {
        // Use a more reliable thumbnail URL for display
        const thumbUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w800`;
        const fileName = file.fileName || file.id;

        return `
            <div class="media-item">
                <img src="${thumbUrl}" alt="${fileName}" loading="lazy" 
                     onerror="this.src='https://placehold.co/400x400/1E293B/64748B?text=Error+Loading+Image'; console.error('Image failed to load:', this.src);">
                <div class="media-overlay">
                    <span class="media-name">${fileName}</span>
                    <button class="copy-url-btn" onclick="copyToClipboard('${file.publicUrl}')">Copy URL</button>
                    <button class="delete-btn" style="color:white;margin-top:10px" onclick="confirmDeleteMedia('${file.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handleMediaUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const base64 = event.target.result;
        const statusEl = document.getElementById('media-upload-status');
        const statusText = document.getElementById('media-status-text');

        // Show status
        statusEl.classList.remove('hidden');
        statusText.innerText = 'Uploading to Drive...';

        gasPost({
            action: 'adminAction',
            subAction: 'uploadMedia',
            file: base64,
            fileName: file.name,
            password: sessionStorage.getItem(SESSION_KEY)
        }).then(result => {
            if (result.status === 'error') {
                alert('Upload failed: ' + result.message);
                statusEl.classList.add('hidden');
            } else {
                statusText.innerText = 'Success! File uploaded.';
                setTimeout(() => {
                    statusEl.classList.add('hidden');
                    loadAdminContent();
                }, 1500);
            }
        }).catch(err => {
            alert('Network error: ' + err.message);
            statusEl.classList.add('hidden');
        });
    };
    reader.readAsDataURL(file);
}

function confirmDeleteMedia(id) {
    if (confirm('Delete this media file?')) {
        jsonpFetch({
            action: 'adminAction',
            subAction: 'deleteEntry',
            table: 'MediaLibrary',
            id: id,
            password: sessionStorage.getItem(SESSION_KEY)
        }, function (err, result) {
            if (err) alert('Delete failed: ' + err.message);
            else loadAdminContent();
        });
    }
}

/**
 * Utility
 */
function truncate(str, len) {
    if (!str || str.length <= len) return str;
    return str.substring(0, len) + '...';
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('URL copied to clipboard!');
    });
}

function syncMediaWithDrive() {
    if (!confirm('This will scan your Google Drive folder and update the database. Continue?')) return;

    const statusEl = document.getElementById('media-upload-status');
    const statusText = document.getElementById('media-status-text');

    statusEl.classList.remove('hidden');
    statusText.innerText = 'Syncing with Drive...';

    gasPost({
        action: 'adminAction',
        subAction: 'syncMedia',
        password: sessionStorage.getItem(SESSION_KEY)
    }).then(result => {
        if (result.status === 'error') {
            alert('Sync failed: ' + result.message);
            statusEl.classList.add('hidden');
        } else {
            statusText.innerText = `Sync complete! (${result.synced} items found)`;
            setTimeout(() => {
                statusEl.classList.add('hidden');
                loadAdminContent();
            }, 2000);
        }
    }).catch(err => {
        alert('Sync error: ' + err.message);
        statusEl.classList.add('hidden');
    });
}
function selectSubTab(tab) {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.add('detail-tab-hidden'));

    const btn = document.querySelector('[data-subtab="' + tab + '"]');
    if (btn) btn.classList.add('active');

    const content = document.getElementById('subtab-' + tab);
    if (content) content.classList.remove('detail-tab-hidden');
}

// ============================================================
//  DATE HELPERS
// ============================================================
function formatDateInput(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
}

function fmtDate(ts) {
    if (!ts) return '—';
    const d = (typeof ts === 'number') ? new Date(ts * 1000) : new Date(ts);
    // Explicitly format to: Apr 12, 2026, 9:32 PM
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
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

/**
 * Robust POST Fetch for GAS (handles large payloads)
 */
async function gasPost(params) {
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(params)
        });
        const result = await response.json();
        return result;
    } catch (err) {
        console.error('GAS POST Error:', err);
        throw new Error('Failed to connect to the server. Your data might be too large or the server is unavailable.');
    }
}

// ============================================================
//  ANALYTICS TAB
// ============================================================
function refreshData() {
    // Show visual feedback immediately
    console.log("Refreshing all data...");
    loadAnalytics();

    // Always refresh transcripts if we have them or we are on the tab
    const isTranscriptTabVisible = !document.getElementById('tab-transcripts').classList.contains('hidden');
    if (isTranscriptTabVisible || allConversations.length > 0) {
        loadTranscripts();
    }
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

        if (result.status === 'error' && result.message && result.message.includes('Unauthorized')) {
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
        console.log('[Dashboard] Analytics data received:', JSON.stringify(data.dailyTrend));
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
    renderTrendChart(data.dailyTrend || {}, startDate, endDate);

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
function renderTrendChart(dailyTrend, startDateStr, endDateStr) {
    if (trendChartInst) { trendChartInst.destroy(); trendChartInst = null; }

    console.log("Rendering Trend Chart with data:", dailyTrend);

    // If we have date strings from the filter, fill in the gaps with 0s
    let sortedDays = [];
    if (startDateStr && endDateStr) {
        const start = new Date(startDateStr + 'T00:00:00');
        const end = new Date(endDateStr + 'T00:00:00');
        const curr = new Date(start);
        while (curr <= end) {
            const yyyy = curr.getFullYear();
            const mm = String(curr.getMonth() + 1).padStart(2, '0');
            const dd = String(curr.getDate()).padStart(2, '0');
            const key = yyyy + '-' + mm + '-' + dd;
            sortedDays.push(key);
            curr.setDate(curr.getDate() + 1);
        }
    } else {
        sortedDays = Object.keys(dailyTrend).sort();
    }

    const counts = sortedDays.map(d => dailyTrend[d] || 0);

    const ctx = document.getElementById('trend-chart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(49,152,216,0.3)');
    gradient.addColorStop(1, 'rgba(49,152,216,0)');

    trendChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedDays.map(d => {
                // Parse correctly across browsers: YYYY-MM-DD
                const parts = d.split('-');
                const dt = new Date(parts[0], parts[1] - 1, parts[2]);
                return dt.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                data: counts,
                backgroundColor: 'rgba(49,152,216,0.7)',
                borderColor: '#3198D8',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: '#3198D8'
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
                    grid: { display: false },
                    ticks: { color: '#64748B', maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748B', stepSize: 1, precision: 0 },
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
        // Toggle visibility instead of destroying HTML
        document.getElementById(canvasId).style.display = 'none';
        document.getElementById(tableId).innerHTML = '<p style="color:#64748B;font-size:13px;padding:20px">No data yet</p>';
        return;
    }
    document.getElementById(canvasId).style.display = 'block';
    document.getElementById(tableId).innerHTML = '';

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
        el.style.display = 'none';
        const msgId = canvasId + '-msg';
        if (!document.getElementById(msgId)) {
            const p = document.createElement('p');
            p.id = msgId;
            p.style.color = '#64748B';
            p.style.fontSize = '13px';
            p.style.padding = '20px';
            p.textContent = 'No data yet';
            el.parentElement.appendChild(p);
        }
        return;
    }
    el.style.display = 'block';
    const msg = document.getElementById(canvasId + '-msg');
    if (msg) msg.remove();

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

        if (result.status === 'error' && result.message && result.message.includes('Unauthorized')) {
            sessionStorage.removeItem(SESSION_KEY);
            logout();
            return;
        }

        if (result.status === 'error') {
            document.getElementById('transcripts-error').classList.remove('hidden');
            document.getElementById('transcripts-error-msg').textContent = result.message;
            return;
        }

        allConversations = (result.data && result.data.conversations) || result.conversations || [];
        const total = (result.data && result.data.total) || result.total || allConversations.length;

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
    activeConv = conv;

    const panel = document.getElementById('transcript-detail');
    panel.innerHTML = buildTranscriptDetail(conv);

    // Initial sub-tab: Transcription (matches user request context usually, or Overview)
    selectSubTab('overview');
}

function buildTranscriptDetail(conv) {
    const caller = extractCallerLabel(conv);
    const date = fmtDate(conv.start_time_unix_secs ? conv.start_time_unix_secs * 1000 : (conv.start_time || conv.created_at));
    const isBook = conv._isBooking;
    const convId = conv.conversation_id || conv.id || '';

    // Header & Sub-Tabs Nav
    let html = '<div class="transcript-header">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div style="font-family:Outfit,sans-serif;font-size:18px;font-weight:700;color:#F1F5F9">' + escHtml(caller) + '</div>' +
        (isBook ? '<span class="conv-tag tag-booking">✓ Booking Made</span>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">' +
        '<div style="font-size:12px;color:#94A3B8;font-weight:500">📅 ' + escHtml(date) + '</div>' +
        '<div style="font-size:10px;color:#475569">ID: ' + escHtml(String(convId)) + '</div>' +
        '</div>' +
        '</div>';

    html += '<div class="detail-tabs">' +
        '<button class="sub-tab-btn" data-subtab="overview" onclick="selectSubTab(\'overview\')">Overview</button>' +
        '<button class="sub-tab-btn" data-subtab="transcription" onclick="selectSubTab(\'transcription\')">Transcription</button>' +
        '<button class="sub-tab-btn" data-subtab="client" onclick="selectSubTab(\'client\')">Client Data</button>' +
        '<button class="sub-tab-btn" data-subtab="whatsapp" onclick="selectSubTab(\'whatsapp\')">WhatsApp</button>' +
        '</div>';

    // Content Containers
    html += '<div id="subtab-overview" class="detail-tab-content">' + renderOverviewSubTab(conv) + '</div>';
    html += '<div id="subtab-transcription" class="detail-tab-content detail-tab-hidden">' + renderTranscriptionSubTab(conv) + '</div>';
    html += '<div id="subtab-client" class="detail-tab-content detail-tab-hidden">' + renderClientDataSubTab(conv) + '</div>';
    html += '<div id="subtab-whatsapp" class="detail-tab-content detail-tab-hidden">' + renderWhatsAppSubTab(conv) + '</div>';

    return html;
}

function renderOverviewSubTab(conv) {
    const date = fmtDate(conv.start_time_unix_secs ? conv.start_time_unix_secs * 1000 : (conv.start_time || conv.created_at));
    const dur = fmtDuration(conv.duration || conv.conversation_duration_secs || conv.duration_secs || conv.call_duration_secs || 0);
    const cost = (conv.cost || (conv.metadata && (conv.metadata.call_cost || conv.metadata.cost)) || 0);
    const summary = (conv.analysis && (conv.analysis.call_summary || conv.analysis.overview)) || 'No summary available for this conversation.';

    return '<div class="overview-section">' +
        '<div class="overview-title">Call Summary</div>' +
        '<div class="overview-summary">' + escHtml(summary) + '</div>' +
        '</div>' +
        '<div class="details-grid">' +
        renderDetailItem('Date & Time', date) +
        renderDetailItem('Duration', dur) +
        renderDetailItem('Call Cost', (parseFloat(cost) || 0).toFixed(2) + ' credits') +
        renderDetailItem('Status', conv.status || 'completed') +
        renderDetailItem('Language', conv._language || detectLanguage(conv)) +
        renderDetailItem('Services', (conv._services || []).join(', ') || 'General Enquiry') +
        '</div>';
}

function renderTranscriptionSubTab(conv) {
    const transcript = conv.transcript || [];
    if (transcript.length === 0) {
        return '<div style="color:#64748B;font-size:13px;padding:20px;text-align:center">' +
            (conv._fetchError ? 'Could not load transcript: ' + escHtml(conv._fetchError) : 'No transcript available') +
            '</div>';
    }

    return '<div class="transcript-messages">' + transcript.map(function (msg) {
        const role = (msg.role || 'agent').toLowerCase();
        const text = msg.message || msg.text || msg.content || '';
        const ts = msg.time_in_call_secs != null ? formatCallTime(msg.time_in_call_secs) : '';
        return '<div class="msg-bubble-wrap ' + role + '">' +
            '<div class="msg-role">' + (role === 'user' ? '👤 Customer' : '🤖 AI Assistant') + '</div>' +
            '<div class="msg-bubble">' + escHtml(text) + '</div>' +
            (ts ? '<div class="msg-time">' + ts + '</div>' : '') +
            '</div>';
    }).join('') + '</div>';
}

function renderClientDataSubTab(conv) {
    const res = (conv.analysis && conv.analysis.data_collection_results) || {};
    const keys = Object.keys(res);
    if (keys.length === 0) {
        return '<div style="color:#64748B;font-size:13px;padding:20px;text-align:center">No client data was collected during this call.</div>';
    }

    return '<div class="data-list">' + keys.map(k => {
        const item = res[k];
        const val = item.value || item;
        return '<div class="data-row">' +
            '<span class="data-key">' + escHtml(k.replace(/_/g, ' ')) + '</span>' +
            '<span class="data-val">' + escHtml(String(val)) + '</span>' +
            '</div>';
    }).join('') + '</div>';
}

function renderWhatsAppSubTab(conv) {
    const phone = (conv.metadata && (conv.metadata.phone || conv.metadata.caller_id || conv.metadata.from_number)) ||
        conv.caller_id || conv.from || '';
    if (!phone) {
        return '<div style="color:#64748B;font-size:13px;padding:20px;text-align:center">WhatsApp metadata unavailable.</div>';
    }

    const clean = String(phone).replace(/\+/g, '').replace(/\s/g, '');
    const waLink = 'https://wa.me/' + clean;

    return '<div class="whatsapp-connect">' +
        '<div style="font-size:18px;font-weight:700;color:#F1F5F9;margin-bottom:20px">' + escHtml(phone) + '</div>' +
        '<div class="details-grid" style="margin-bottom:24px">' +
        renderDetailItem('Direction', 'Inbound') +
        renderDetailItem('WhatsApp account', 'Pinnacle Dental Centre (+254 706 076636)') +
        renderDetailItem('User ID', clean) +
        '</div>' +
        '<a href="' + waLink + '" target="_blank" class="wa-btn">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.551 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>' +
        'Message Patient' +
        '</a>' +
        '</div>';
}

function renderDetailItem(label, value) {
    return '<div class="detail-item">' +
        '<div class="detail-label">' + escHtml(label) + '</div>' +
        '<div class="detail-value">' + escHtml(String(value)) + '</div>' +
        '</div>';
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
