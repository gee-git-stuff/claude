/* ============================================================
   FlipperAI — Frontend Application
   ============================================================ */

const API = '';  // same-origin; change to 'http://localhost:8000' if serving separately

// ---- State ----
let currentView = 'chat';
let currentConversationId = null;
let currentPropertyId = null;
let properties = [];
let documents = [];
let isThinking = false;

// ---- DOM refs ----
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const propertyList = document.getElementById('propertyList');
const topbarTitle = document.getElementById('topbarTitle');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadProperties();
  loadDocuments();
  setupEventListeners();
});

function setupEventListeners() {
  // Sidebar toggle (mobile)
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Nav buttons
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Chat
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  });
  document.getElementById('clearChatBtn').addEventListener('click', clearChat);

  // Hint chips
  document.querySelectorAll('.hint-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.hint;
      chatInput.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  // Property modal
  document.getElementById('newPropertyBtn').addEventListener('click', () => showModal('propertyModal'));
  document.getElementById('cancelPropertyModal').addEventListener('click', () => hideModal('propertyModal'));
  document.getElementById('savePropertyBtn').addEventListener('click', saveProperty);

  // Deal analyzer
  document.getElementById('analyzeDealBtn').addEventListener('click', analyzeDeal);

  // Repair estimator
  document.getElementById('estimateRepairsBtn').addEventListener('click', estimateRepairs);

  // Closing costs
  document.getElementById('calcClosingBtn').addEventListener('click', calcClosingCosts);

  // File upload
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  fileInput.addEventListener('change', () => handleFileUpload(fileInput.files));
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFileUpload(e.dataTransfer.files);
  });
}

// ---- View Switching ----
function switchView(view) {
  currentView = view;
  const viewMap = {
    chat: { el: 'viewChat', title: 'AI Advisor' },
    analyzer: { el: 'viewAnalyzer', title: 'Deal Analyzer' },
    repairs: { el: 'viewRepairs', title: 'Repair Estimator' },
    closing: { el: 'viewClosing', title: 'Closing Costs' },
    documents: { el: 'viewDocuments', title: 'Documents' },
  };

  Object.entries(viewMap).forEach(([v, { el }]) => {
    document.getElementById(el).style.display = v === view ? 'flex' : 'none';
  });

  topbarTitle.textContent = viewMap[view]?.title || view;
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Show/hide clear chat button only in chat view
  document.getElementById('clearChatBtn').style.display = view === 'chat' ? '' : 'none';

  // Mobile: close sidebar
  sidebar.classList.remove('open');
}

// ---- Chat ----
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isThinking) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  appendMessage('user', text);
  document.getElementById('chatHints').style.display = 'none';

  const typingEl = appendTyping();
  isThinking = true;
  sendBtn.disabled = true;

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        conversation_id: currentConversationId,
        property_id: currentPropertyId,
      }),
    });
    const data = await res.json();
    currentConversationId = data.conversation_id;
    typingEl.remove();
    appendMessage('assistant', data.message);
  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', `⚠️ Error: ${err.message}. Make sure the server is running.`);
  } finally {
    isThinking = false;
    sendBtn.disabled = false;
  }
}

function appendMessage(role, content) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;
  wrap.innerHTML = `
    <div class="avatar ${role}">${role === 'user' ? '👤' : '🏠'}</div>
    <div class="message-bubble">${renderMarkdown(content)}</div>
  `;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant';
  wrap.innerHTML = `
    <div class="avatar assistant">🏠</div>
    <div class="message-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function clearChat() {
  currentConversationId = null;
  // Keep only the welcome message
  while (chatMessages.children.length > 1) {
    chatMessages.removeChild(chatMessages.lastChild);
  }
  document.getElementById('chatHints').style.display = 'flex';
}

// Lightweight markdown renderer (bold, code, lists, headers, tables)
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Tables (must come before other rules)
    .replace(/(\|[^\n]+\|\n)((?:\|[-: ]+)+\|\n)((?:\|[^\n]+\|\n?)+)/g, (_, header, sep, body) => {
      const cols = header.trim().split('|').filter(c => c.trim());
      const rows = body.trim().split('\n').filter(Boolean);
      const th = cols.map(c => `<th>${c.trim()}</th>`).join('');
      const tb = rows.map(r => {
        const cells = r.trim().split('|').filter(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      }).join('');
      return `<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
    })
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ---- Properties ----
async function loadProperties() {
  try {
    const res = await fetch(`${API}/api/properties`);
    properties = await res.json();
    renderPropertyList();
  } catch { /* server may not be running yet */ }
}

function renderPropertyList() {
  if (!properties.length) {
    propertyList.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--text-muted)">No properties yet.</div>';
    return;
  }
  propertyList.innerHTML = properties.map(p => `
    <div class="property-item ${p.id === currentPropertyId ? 'active' : ''}" data-id="${p.id}">
      <div class="property-name">${esc(p.name)}</div>
      ${p.address ? `<div class="property-addr">${esc(p.address)}</div>` : ''}
      <div class="property-status">
        <span class="badge badge-${p.status || 'analyzing'}">${esc(p.status || 'analyzing')}</span>
      </div>
    </div>
  `).join('');

  propertyList.querySelectorAll('.property-item').forEach(el => {
    el.addEventListener('click', () => selectProperty(parseInt(el.dataset.id)));
  });
}

function selectProperty(id) {
  currentPropertyId = currentPropertyId === id ? null : id;
  renderPropertyList();
  const prop = properties.find(p => p.id === id);
  if (prop && currentPropertyId) {
    const hint = `Tell me about this property: ${prop.name}${prop.address ? ' at ' + prop.address : ''}`;
    if (currentView !== 'chat') switchView('chat');
    chatInput.value = hint;
    chatInput.dispatchEvent(new Event('input'));
  }
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

async function saveProperty() {
  const name = document.getElementById('pm_name').value.trim();
  if (!name) { alert('Property name is required'); return; }

  const data = {
    name,
    address: document.getElementById('pm_address').value.trim() || null,
    purchase_price: parseFloatOrNull(document.getElementById('pm_purchase').value),
    arv: parseFloatOrNull(document.getElementById('pm_arv').value),
    repair_costs: parseFloatOrNull(document.getElementById('pm_repairs').value),
    status: document.getElementById('pm_status').value,
  };

  try {
    const res = await fetch(`${API}/api/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const prop = await res.json();
    properties.unshift(prop);
    renderPropertyList();
    hideModal('propertyModal');
    // Clear form
    ['pm_name','pm_address','pm_purchase','pm_arv','pm_repairs'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } catch (err) {
    alert('Error saving property: ' + err.message);
  }
}

// ---- Deal Analyzer ----
async function analyzeDeal() {
  const data = {
    purchase_price: parseFloat(document.getElementById('da_purchase').value),
    repair_costs: parseFloat(document.getElementById('da_repairs').value),
    arv: parseFloat(document.getElementById('da_arv').value),
    holding_months: parseInt(document.getElementById('da_holding').value) || 6,
    monthly_holding_cost: parseFloat(document.getElementById('da_monthly').value) || 1500,
    loan_amount: parseFloat(document.getElementById('da_loan').value) || 0,
  };

  if (!data.purchase_price || !data.repair_costs || !data.arv) {
    alert('Please enter Purchase Price, Repair Costs, and ARV.');
    return;
  }

  try {
    const res = await fetch(`${API}/api/calculate/deal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    renderDealResults(result);
  } catch (err) {
    alert('Calculation error: ' + err.message);
  }
}

function renderDealResults(r) {
  const roi = r.roi_analysis;
  const score = r.deal_score || '';
  const scoreClass = score.startsWith('A') ? 'a' : score.startsWith('B') ? 'b' : score.startsWith('C') ? 'c' : 'd';

  document.getElementById('dealScoreBlock').innerHTML = `
    <div class="card-title">Deal Score</div>
    <div class="score-badge score-${scoreClass}">🏆 ${esc(score)}</div>
    <p style="font-size:14px;color:var(--text-muted);margin-top:8px">${esc(r.recommendation || '')}</p>
    <p style="font-size:12px;margin-top:6px;color:var(--text-muted)">
      70% Rule: Max purchase = <strong>${fmt(roi.rule_70_max_purchase)}</strong> —
      <span style="color:${roi.rule_70_compliant ? 'var(--success)' : 'var(--danger)'}">
        ${roi.rule_70_compliant ? '✓ Compliant' : '✗ Overpaying'}
      </span>
    </p>
  `;

  const profit = roi.profit;
  document.getElementById('roiStats').innerHTML = `
    <div class="stat-item">
      <div class="stat-label">Net Profit</div>
      <div class="stat-value ${profit >= 0 ? 'positive' : 'negative'}">${fmt(profit)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">ROI</div>
      <div class="stat-value ${roi.roi_pct >= 15 ? 'positive' : roi.roi_pct >= 8 ? 'neutral' : 'negative'}">${roi.roi_pct}%</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Annualized ROI</div>
      <div class="stat-value ${roi.annualized_roi_pct >= 20 ? 'positive' : 'neutral'}">${roi.annualized_roi_pct}%</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Total Investment</div>
      <div class="stat-value neutral">${fmt(roi.total_investment)}</div>
    </div>
  `;

  const rows = [
    ['Purchase Price', roi.purchase_price],
    ['Repair Costs', roi.repair_costs],
    ['Holding Costs', roi.holding_costs],
    ['Financing Costs', roi.financing_costs],
    ['Total Investment', roi.total_investment, true],
    ['ARV (Resale)', roi.arv],
    ['Selling Costs', roi.selling_costs],
    ['Net Proceeds', roi.net_proceeds, true],
    ['Net Profit', roi.profit, true],
    ['Break-even ARV', roi.break_even_arv],
  ];
  document.getElementById('roiBreakdown').innerHTML = rows.map(([label, val, bold]) =>
    `<div class="result-row">
      <span class="label">${label}</span>
      <span class="value" style="${bold ? 'color:var(--text)' : ''}">${fmt(val)}</span>
    </div>`
  ).join('');

  document.getElementById('dealResults').style.display = 'block';
  document.getElementById('dealResults').scrollIntoView({ behavior: 'smooth' });
}

// ---- Repair Estimator ----
async function estimateRepairs() {
  const scope = {
    sqft: parseFloat(document.getElementById('rep_sqft').value) || 1500,
    roof: document.getElementById('rep_roof').checked,
    hvac: document.getElementById('rep_hvac').checked,
    kitchen: document.getElementById('rep_kitchen').value || null,
    bathrooms: parseInt(document.getElementById('rep_baths').value) || 0,
    flooring: document.getElementById('rep_flooring').checked,
    paint: document.getElementById('rep_paint').checked,
    windows: document.getElementById('rep_windows').checked,
    window_count: parseInt(document.getElementById('rep_windows_count').value) || 10,
    electrical: document.getElementById('rep_electrical').checked,
    plumbing: document.getElementById('rep_plumbing').checked,
    foundation: document.getElementById('rep_foundation').checked,
    landscaping: document.getElementById('rep_landscaping').checked,
  };

  try {
    const res = await fetch(`${API}/api/calculate/repairs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scope),
    });
    const result = await res.json();
    renderRepairResults(result);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function renderRepairResults(r) {
  const items = r.line_items || {};
  const breakdown = Object.entries(items).map(([key, val]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<div class="result-row">
      <span class="label">${esc(label)}</span>
      <span class="value">${fmt(val)}</span>
    </div>`;
  }).join('');

  document.getElementById('repairBreakdown').innerHTML = `
    ${breakdown}
    <div class="result-row" style="border-top:2px solid var(--border);margin-top:4px">
      <span class="label" style="font-weight:700">Subtotal</span>
      <span class="value" style="color:var(--text)">${fmt(r.subtotal)}</span>
    </div>
    <div class="result-row">
      <span class="label" style="font-weight:700">Total w/ Contingency</span>
      <span class="value" style="color:var(--success);font-size:18px">${fmt(r.total_with_contingency)}</span>
    </div>
    <div class="result-row">
      <span class="label">Cost per Sq Ft</span>
      <span class="value">$${r.cost_per_sqft}/sqft</span>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:10px">${esc(r.note)}</p>
  `;

  document.getElementById('repairResults').style.display = 'block';
  document.getElementById('repairResults').scrollIntoView({ behavior: 'smooth' });
}

// ---- Closing Costs ----
async function calcClosingCosts() {
  const price = parseFloat(document.getElementById('cc_price').value);
  if (!price) { alert('Please enter a purchase/sale price.'); return; }

  const data = {
    purchase_price: price,
    state: document.getElementById('cc_state').value.trim() || 'general',
    is_buyer: document.getElementById('cc_role').value === 'buyer',
    loan_amount: parseFloat(document.getElementById('cc_loan').value) || 0,
  };

  try {
    const res = await fetch(`${API}/api/calculate/closing-costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    renderClosingResults(result);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function renderClosingResults(r) {
  const items = r.line_items || {};
  const breakdown = Object.entries(items).map(([key, val]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<div class="result-row">
      <span class="label">${esc(label)}</span>
      <span class="value">${fmt(val)}</span>
    </div>`;
  }).join('');

  document.getElementById('closingBreakdown').innerHTML = `
    <div style="margin-bottom:10px;font-size:14px;color:var(--text-muted)">
      Role: <strong style="color:var(--text)">${r.role}</strong> &nbsp;|&nbsp;
      State: <strong style="color:var(--text)">${r.state.toUpperCase()}</strong>
    </div>
    ${breakdown}
    <div class="result-row" style="border-top:2px solid var(--border);margin-top:4px">
      <span class="label" style="font-weight:700">Total Estimated</span>
      <span class="value" style="color:var(--success);font-size:18px">${fmt(r.total_estimated)}</span>
    </div>
    <div class="result-row">
      <span class="label">As % of Price</span>
      <span class="value">${r.total_as_pct_of_price}%</span>
    </div>
    ${r.state_notes ? `<p style="font-size:13px;color:var(--warning);margin-top:10px">⚠️ ${esc(r.state_notes)}</p>` : ''}
    <p style="font-size:12px;color:var(--text-muted);margin-top:8px">${esc(r.disclaimer)}</p>
  `;

  document.getElementById('closingResults').style.display = 'block';
  document.getElementById('closingResults').scrollIntoView({ behavior: 'smooth' });
}

// ---- Documents ----
async function loadDocuments() {
  try {
    const res = await fetch(`${API}/api/documents`);
    documents = await res.json();
    renderDocumentList();
  } catch { /* server may not be running yet */ }
}

function renderDocumentList() {
  const list = document.getElementById('docList');
  if (!documents.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;text-align:center;padding:20px">No documents uploaded yet.</div>';
    return;
  }

  const typeIcon = { pdf: '📄', txt: '📃', csv: '📊', md: '📝' };
  list.innerHTML = documents.map(doc => {
    const ext = doc.filename.split('.').pop().toLowerCase();
    const icon = typeIcon[ext] || '📄';
    const date = new Date(doc.created_at).toLocaleDateString();
    return `
      <div class="doc-item" data-id="${doc.id}">
        <div class="doc-icon">${icon}</div>
        <div class="doc-info">
          <div class="doc-name">${esc(doc.filename)}</div>
          <div class="doc-meta">${esc(doc.doc_type)} · ${date}${doc.property_id ? ' · Property #' + doc.property_id : ''}</div>
          ${doc.summary ? `<div class="doc-summary">${esc(doc.summary)}</div>` : ''}
        </div>
        <button class="doc-ask-btn" data-docid="${doc.id}" data-name="${esc(doc.filename)}">Ask AI</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.doc-ask-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = `Please analyze my uploaded document: "${btn.dataset.name}" (document ID ${btn.dataset.docid}). Give me a summary of the key points and anything I should pay attention to.`;
      switchView('chat');
      chatInput.value = msg;
      chatInput.dispatchEvent(new Event('input'));
    });
  });
}

async function handleFileUpload(files) {
  if (!files || !files.length) return;

  const progress = document.getElementById('uploadProgress');
  progress.style.display = 'block';

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    if (currentPropertyId) formData.append('property_id', currentPropertyId);

    try {
      const res = await fetch(`${API}/api/documents`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await res.text());
      const doc = await res.json();
      documents.unshift(doc);
    } catch (err) {
      alert(`Error uploading ${file.name}: ${err.message}`);
    }
  }

  progress.style.display = 'none';
  renderDocumentList();

  // Reset file input
  document.getElementById('fileInput').value = '';
}

// ---- Utilities ----
function fmt(val) {
  if (val == null) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseFloatOrNull(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}
