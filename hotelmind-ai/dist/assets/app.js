import { parseCSV, toCSV } from './csv.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf = new Intl.NumberFormat('tr-TR');
const dec = (n, digits = 1) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n, digits = 1) => `%${dec(Number(n) * 100, digits)}`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const names = { logistic_regression: 'Logistic Regression', random_forest: 'Random Forest', xgboost: 'XGBoost', neural_network: 'Yapay sinir ağı' };
const descriptions = { logistic_regression: 'Doğrusal temel model', random_forest: '160 karar ağacı', xgboost: '240 ardışık ağaç', neural_network: 'MLP · 64 + 32 nöron' };
const numbers = ['lead_time', 'stays_in_weekend_nights', 'stays_in_week_nights', 'adults', 'children', 'babies', 'previous_cancellations', 'previous_bookings_not_canceled', 'adr'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const options = {
  hotel: [['Resort Hotel', 'Tatil oteli'], ['City Hotel', 'Şehir oteli']],
  arrival_date_month: months.map((m, i) => [m, monthNames[i]]),
  meal: [['BB', 'Oda + kahvaltı (BB)'], ['HB', 'Yarım pansiyon (HB)'], ['FB', 'Tam pansiyon (FB)'], ['SC', 'Yalnız oda (SC)'], ['Undefined', 'Belirtilmemiş']],
  market_segment: [['Online TA', 'Online seyahat acentesi'], ['Offline TA/TO', 'Acente / tur operatörü'], ['Direct', 'Doğrudan rezervasyon'], ['Groups', 'Grup rezervasyonu'], ['Corporate', 'Kurumsal'], ['Complementary', 'Ücretsiz / ağırlama'], ['Aviation', 'Havayolu'], ['Undefined', 'Belirtilmemiş']],
  distribution_channel: [['TA/TO', 'Acente / tur operatörü'], ['Direct', 'Doğrudan'], ['Corporate', 'Kurumsal'], ['GDS', 'Global dağıtım sistemi'], ['Undefined', 'Belirtilmemiş']],
  reserved_room_type: [...'ABCDEFGHLP'].map(c => [c, `Kategori ${c}`]),
  deposit_type: [['No Deposit', 'Depozito yok'], ['Non Refund', 'İade edilmez'], ['Refundable', 'İade edilebilir']],
  customer_type: [['Transient', 'Bireysel'], ['Transient-Party', 'Bağlantılı bireysel'], ['Contract', 'Sözleşmeli'], ['Group', 'Grup']],
};
const fields = [...numbers, ...Object.keys(options)];
const summer = { hotel: 'Resort Hotel', arrival_date_month: 'July', meal: 'BB', market_segment: 'Online TA', distribution_channel: 'TA/TO', reserved_room_type: 'A', deposit_type: 'No Deposit', customer_type: 'Transient', lead_time: 130, stays_in_weekend_nights: 2, stays_in_week_nights: 3, adults: 2, children: 0, babies: 0, previous_cancellations: 0, previous_bookings_not_canceled: 0, adr: 115.5 };
const presets = {
  summer,
  city: { ...summer, hotel: 'City Hotel', arrival_date_month: 'October', lead_time: 25, stays_in_week_nights: 2, stays_in_weekend_nights: 1, adr: 90, market_segment: 'Direct', distribution_channel: 'Direct' },
  business: { ...summer, hotel: 'City Hotel', arrival_date_month: 'March', lead_time: 7, stays_in_week_nights: 2, stays_in_weekend_nights: 0, adults: 1, adr: 85, market_segment: 'Corporate', distribution_channel: 'Corporate', customer_type: 'Contract', previous_bookings_not_canceled: 4 },
};
let report, summary, latest, busy = false, allContributions = false, history = [], csvBookings = [], csvResults = [];
let worker, rpcSequence = 0, ready = false;
const pending = new Map();
const api = document.body.dataset.runtime === 'api';
const mobileViewport = matchMedia('(max-width: 700px)');
function syncSidebarAccess() { $('#sidebar').inert = mobileViewport.matches && !$('#sidebar').classList.contains('mobile-open'); }
const historyKey = 'hotelmind-analyses-v02';
try { const stored = JSON.parse(localStorage.getItem(historyKey) || '[]'); history = Array.isArray(stored) ? stored.filter(r => r?.booking && r?.prediction && typeof r.id === 'string' && Number.isFinite(r.prediction.cancellation_probability)).slice(0, 50) : []; } catch { history = []; }

function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`; }
function showError(message, selector = '#form-error') { const node = $(selector); node.textContent = message; node.hidden = false; }
function toast(message) { const node = $('#toast'); node.textContent = message; node.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 3500); }
function download(name, content, mime = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function saveHistory() { try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch { toast('Tarayıcı depolaması dolu; bu analiz kalıcı kaydedilemedi.'); } renderHistory(); }
function getForm() { const data = Object.fromEntries(new FormData($('#booking-form'))); numbers.forEach(f => { data[f] = Number(data[f]); }); return data; }
function sameBooking(a, b) { return fields.every(f => a[f] === b[f]); }
function staySummary() { const b = getForm(); $('#stay-summary').textContent = `${nf.format(b.adults + b.children + b.babies)} misafir · ${nf.format(b.stays_in_week_nights + b.stays_in_weekend_nights)} gece`; }
function markDirty() { staySummary(); $$('.preset').forEach(b => b.classList.remove('active')); if (latest) { const stale = !sameBooking(latest.booking, getForm()); $('#stale-notice').hidden = !stale; $('#result-card').classList.toggle('stale', stale); $('#download-result').disabled = stale; } }
function setForm(booking, preset = '') { fields.forEach(f => { const input = document.getElementById(f); if (input) input.value = booking[f]; }); markDirty(); if (preset) $(`[data-preset="${preset}"]`)?.classList.add('active'); }
for (const [field, entries] of Object.entries(options)) { const select = document.getElementById(field); if (select) select.innerHTML = entries.map(([v, text]) => `<option value="${esc(v)}">${esc(text)}</option>`).join(''); }
setForm(presets.summer, 'summer');
$('#booking-form').addEventListener('input', markDirty);
$('#booking-form').addEventListener('change', markDirty);
$$('.preset').forEach(button => button.addEventListener('click', () => setForm(presets[button.dataset.preset], button.dataset.preset)));

function rpc(kind, payload = {}) { const id = ++rpcSequence; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, kind, ...payload }); }); }
async function jsonFetch(url, config) {
  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => `${d.loc?.slice(1).join('.') || 'Rezervasyon'}: ${d.msg}`).join(' · ') : 'İstek tamamlanamadı.';
    throw Error(message);
  }
  return data;
}
async function predict(booking) {
  if (!api) return rpc('predict', { booking });
  return jsonFetch('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) });
}
function localValidate(b) {
  for (const f of numbers) if (!Number.isFinite(b[f]) || b[f] < 0 || (f !== 'adr' && !Number.isInteger(b[f]))) throw Error(`${f}: negatif olmayan geçerli bir sayı girin.`);
  for (const [f, opts] of Object.entries(options)) if (!opts.some(([v]) => v === b[f])) throw Error(`${f}: geçerli bir kategori seçin.`);
  if (b.adults + b.children + b.babies < 1) throw Error('En az bir misafir olmalı.');
  if (b.stays_in_week_nights + b.stays_in_weekend_nights < 1) throw Error('En az bir gece konaklama olmalı.');
}
function renderExplanation(explanation) {
  const node = $('#explanation-content');
  if (!explanation) { node.innerHTML = '<p class="empty-copy">Bu model türünde SHAP açıklaması bu sürümde desteklenmiyor.</p>'; $('#all-contributions').hidden = true; return; }
  const features = explanation.features, items = allContributions ? features : features.slice(0, 6);
  const probabilityUnit = explanation.unit === 'probability';
  const scale = Math.max(...features.map(f => Math.abs(f.contribution)), 1e-10);
  $('#explanation-subtitle').textContent = probabilityUnit ? 'TreeSHAP · olasılık puanı katkıları' : `${explanation.method.split(' · ')[0]} · log-odds katkıları`;
  node.innerHTML = items.map(f => {
    const positive = f.contribution >= 0, width = Math.max(.3, Math.abs(f.contribution) / scale * 48);
    const label = `${positive ? '+' : '−'}${dec(Math.abs(f.contribution) * (probabilityUnit ? 100 : 1), probabilityUnit ? 1 : 3)}`;
    return `<div class="attribution"><span class="attribution-label" title="${esc(f.label)}">${esc(f.label)}</span><span class="attribution-bar" aria-hidden="true"><span style="width:${width}%;${positive ? 'left:50%;background:#d9a18d' : `right:50%;background:#91aa7a`}"></span></span><span class="attribution-value ${positive ? '' : 'negative'}" title="${probabilityUnit ? 'Yüzde puanı' : 'Log-odds'}">${label}</span></div>`;
  }).join('');
  $('#all-contributions').hidden = false;
  $('#all-contributions').textContent = allContributions ? 'En etkili 6 alanı göster' : `Tüm ${features.length} katkıyı göster`;
  const total = explanation.sum_contributions;
  $('#explanation-foot').textContent = probabilityUnit ? `Temel olasılık ${pct(explanation.base_value, 2)} ${total >= 0 ? '+' : '−'} ${dec(Math.abs(total) * 100, 2)} puan = ${pct(explanation.base_value + total, 2)}. Kategorik katkılar alan bazında toplanır; nedensellik göstermez.` : `Temel değer ${dec(explanation.base_value, 3)}; katkılar toplamı ${dec(total, 3)} log-odds. Bu değerler doğrudan yüzde puanı değildir.`;
}
function renderResult(record) {
  const r = record.prediction, p = r.cancellation_probability;
  const risks = { Low: 'Düşük risk', Medium: 'Orta risk', High: 'Yüksek risk' };
  const colors = { Low: '#bbd29e', Medium: '#deb17b', High: '#df9b87' };
  $('#probability').innerHTML = `${dec(p * 100, 1)}<span>%</span>`;
  $('#gauge-fill').style.strokeDashoffset = String(496.372 * (1 - p)); $('#gauge-fill').style.stroke = colors[r.risk_level];
  $('#risk-badge').textContent = risks[r.risk_level]; $('#risk-badge').className = `risk-badge ${r.risk_level.toLowerCase()}`;
  $('#model-pill').textContent = names[r.model_name] || 'Eğitilmiş model';
  $('#result-description').textContent = `${r.predicted_cancellation ? 'İptal yönünde sınıflandırıldı.' : 'İptal beklenmiyor yönünde sınıflandırıldı.'} Sınıf eşiği: %50.`;
  $('#inference-label').textContent = record.automatic ? 'Örnek rezervasyon · gerçek model' : 'Model tahmini tamamlandı';
  $('#download-result').disabled = false; $('#stale-notice').hidden = true; $('#result-card').classList.remove('stale');
  $('#result-card').setAttribute('aria-busy', 'false'); renderExplanation(r.explanation);
}
async function analyze(automatic = false) {
  if (!ready || busy) return;
  const booking = getForm();
  $('#form-error').hidden = true;
  try { localValidate(booking); } catch (error) { showError(error.message); return; }
  busy = true; $('#analyze-button').disabled = true; $('#analyze-button span').textContent = 'Model analiz ediyor…'; document.body.classList.add('loading'); $('#result-card').setAttribute('aria-busy', 'true');
  try {
    const prediction = await predict(booking);
    latest = { id: crypto.randomUUID ? crypto.randomUUID() : `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString(), booking, prediction, automatic };
    allContributions = false; renderResult(latest);
    if (!sameBooking(booking, getForm())) { $('#stale-notice').hidden = false; $('#result-card').classList.add('stale'); $('#download-result').disabled = true; }
    if (!automatic) { history.unshift(latest); history = history.slice(0, 50); saveHistory(); toast('Analiz tamamlandı ve geçmişe eklendi.'); }
  } catch (error) { showError(`Analiz tamamlanamadı: ${error.message}`); $('#result-card').setAttribute('aria-busy', 'false'); if (automatic) $('#result-description').textContent = 'Model analizi tamamlanamadı. Hata mesajını inceleyin.'; }
  finally { busy = false; $('#analyze-button').disabled = !ready; $('#analyze-button span').textContent = 'İptal riskini analiz et'; document.body.classList.remove('loading'); }
}
$('#booking-form').addEventListener('submit', event => { event.preventDefault(); analyze(false); });
$('#all-contributions').addEventListener('click', () => { if (latest) { allContributions = !allContributions; renderExplanation(latest.prediction.explanation); } });
$('#download-result').addEventListener('click', () => { if (latest) download('HotelMind_Analiz.json', JSON.stringify({ ...latest, limitations: report.limitations }, null, 2)); });

const viewNames = { analysis: 'Rezervasyon analizi', overview: 'Genel bakış', models: 'Model laboratuvarı', history: 'Analiz geçmişi', method: 'Yöntem & veri' };
function navigate() { const key = location.hash.slice(1) in viewNames ? location.hash.slice(1) : 'analysis'; $$('.view').forEach(s => { s.hidden = s.id !== `view-${key}`; }); $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === key)); $('#breadcrumb-title').textContent = viewNames[key]; document.title = `HotelMind AI · ${viewNames[key]}`; closeMenu(); }
window.addEventListener('hashchange', () => { navigate(); window.scrollTo({ top: 0, behavior: 'instant' }); });
function closeMenu() { $('#sidebar').classList.remove('mobile-open'); $('#mobile-scrim').hidden = true; $('#mobile-menu').setAttribute('aria-expanded', 'false'); syncSidebarAccess(); }
$('#mobile-menu').addEventListener('click', () => { const open = !$('#sidebar').classList.contains('mobile-open'); $('#sidebar').classList.toggle('mobile-open', open); $('#mobile-scrim').hidden = !open; $('#mobile-menu').setAttribute('aria-expanded', String(open)); syncSidebarAccess(); });
mobileViewport.addEventListener('change', closeMenu);
$('#mobile-scrim').addEventListener('click', closeMenu);
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
navigate();

function renderHistory() {
  $('#history-count').textContent = history.length;
  $('#export-history').disabled = history.length === 0; $('#clear-history').disabled = history.length === 0;
  if (!history.length) { $('#history-content').innerHTML = `<div class="empty-state">${icon('clock')}<h2>İlk analizinizi bekliyor.</h2><p>Rezervasyon formunda çalıştırdığınız analizler burada görünür. Başlangıçtaki örnek, geçmişe eklenmez.</p><a class="button button-primary" href="#analysis">Bir analiz yap ${icon('arrow')}</a></div>`; return; }
  $('#history-content').innerHTML = `<div class="panel-heading"><div><h2>Son ${history.length} analiz</h2><p>Bu tarayıcıda saklanır · en fazla 50 kayıt</p></div><span class="small-chip">Kişisel çalışma alanı</span></div><div class="table-scroll"><table><thead><tr><th>Oluşturulma</th><th>Otel / geliş ayı</th><th>Misafir / gece</th><th>İptal olasılığı</th><th>Risk</th><th></th></tr></thead><tbody>${history.map(r => {
    const b = r.booking, p = r.prediction;
    const date = new Date(r.created_at).toLocaleString('tr-TR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `<tr><td>${esc(date)}</td><td>${esc(b.hotel === 'Resort Hotel' ? 'Tatil oteli' : 'Şehir oteli')}<br><small>${esc(monthNames[months.indexOf(b.arrival_date_month)] || b.arrival_date_month)}</small></td><td>${nf.format(Number(b.adults) + Number(b.children) + Number(b.babies))} misafir · ${nf.format(Number(b.stays_in_week_nights) + Number(b.stays_in_weekend_nights))} gece</td><td><strong>${pct(p.cancellation_probability)}</strong></td><td><span class="history-risk ${esc(p.risk_level)}">${esc({ Low: 'Düşük', Medium: 'Orta', High: 'Yüksek' }[p.risk_level] || '—')}</span></td><td><div class="history-actions"><button type="button" data-history="${esc(r.id)}">Formda aç</button></div></td></tr>`;
  }).join('')}</tbody></table></div>`;
  $$('[data-history]').forEach(button => button.addEventListener('click', () => { const record = history.find(r => r.id === button.dataset.history); if (record) { setForm(record.booking); location.hash = 'analysis'; toast('Kayıt forma yüklendi. Güncel modelle yeniden analiz edebilirsiniz.'); } }));
}
$('#clear-history').addEventListener('click', () => { history = []; saveHistory(); toast('Bu tarayıcıdaki analiz geçmişi temizlendi.'); });
$('#export-history').addEventListener('click', () => { if (history.length) download('HotelMind_Analiz_Gecmisi.csv', '\uFEFF' + toCSV(['created_at', ...fields, 'cancellation_probability', 'risk_level', 'model_name', 'model_version'], history.map(r => [r.created_at, ...fields.map(f => r.booking[f]), r.prediction.cancellation_probability, r.prediction.risk_level, r.prediction.model_name, r.prediction.model_version])), 'text/csv'); });
renderHistory();

function renderStats() {
  $$('[data-stat="rows"]').forEach(n => { n.textContent = nf.format(report.rows_after_filtering); });
  $$('[data-stat="models"]').forEach(n => { n.textContent = Object.keys(report.validation_metrics).length; });
  $$('[data-stat="auc"]').forEach(n => { n.textContent = dec(report.holdout_test_metrics.roc_auc, 3); });
}
function monthLabel(value, short = false) { const [y, m] = value.split('-'); return `${monthNames[Number(m) - 1].slice(0, short ? 3 : undefined)} ${short ? y.slice(2) : y}`; }
function renderOverview() {
  if (!summary) { $('#overview-stats').innerHTML = '<p class="muted">Bu eğitim için tarihsel veri özeti oluşturulmadı.</p>'; return; }
  $('#overview-stats').innerHTML = [
    ['Gözlenen iptal oranı', pct(summary.cancellation_rate), 'Temizlenmiş veri setinin tamamı'],
    ['Ortalama rezervasyon ön süresi', `${dec(summary.average_lead_time, 0)} gün`, 'Gelişten ne kadar önce rezerve edildiği'],
    ['Ortalama gecelik fiyat', `${dec(summary.average_adr, 1)} EUR`, 'Tarihsel kaynak verisinin ölçeği'],
  ].map(([label, value, note]) => `<div class="overview-stat"><span>${label}</span><strong>${value}</strong><p>${note}</p></div>`).join('');
  $('#hotel-breakdown').innerHTML = summary.hotels.map(h => `<div class="hotel-breakdown-item"><div class="hotel-type-row"><span>${icon('hotel')}${h.hotel === 'City Hotel' ? 'Şehir oteli' : 'Tatil oteli'}</span><strong>${nf.format(h.bookings)}</strong></div><div class="hotel-breakdown-bar"><span style="width:${100 * h.bookings / summary.dataset_rows}%"></span></div><small>Veri setinin ${pct(h.bookings / summary.dataset_rows, 0)}’i · gözlenen iptal ${pct(h.cancellation_rate)}</small></div>`).join('');
  renderMonthlyChart();
}
function renderMonthlyChart() {
  if (!summary) return;
  const period = $('#chart-period').value;
  const data = summary.monthly.filter(d => period === 'all' || d.month.startsWith(period));
  const width = 700, height = 270, left = 44, top = 24, bottom = 218, max = Math.ceil(Math.max(...data.map(d => d.bookings)) / 1000) * 1000;
  const step = (width - left - 12) / data.length, bar = Math.min(step * .65, 33);
  let content = '';
  for (let n = 0; n <= 4; n++) { const y = bottom - (bottom - top) * n / 4; content += `<line x1="${left}" y1="${y}" x2="${width - 5}" y2="${y}" stroke="#edf0f8"/><text x="${left - 8}" y="${y + 3}" text-anchor="end">${nf.format(max * n / 4)}</text>`; }
  data.forEach((d, i) => { const x = left + i * step + (step - bar) / 2, total = d.bookings / max * (bottom - top), canceled = d.cancellations / max * (bottom - top); content += `<g class="bar-group"><title>${esc(monthLabel(d.month))}: ${nf.format(d.bookings)} rezervasyon, ${nf.format(d.cancellations)} iptal (${pct(d.rate)})</title><rect class="bar-total" x="${x}" y="${bottom - total}" width="${bar}" height="${total}" rx="2"/><rect class="bar-cancel" x="${x}" y="${bottom - canceled}" width="${bar}" height="${canceled}" rx="2"/></g>`; if (data.length <= 13 || i % 3 === 0 || i === data.length - 1) content += `<text x="${x + bar / 2}" y="${bottom + 22}" text-anchor="middle">${esc(monthLabel(d.month, true))}</text>`; });
  $('#monthly-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Geliş ayına göre toplam rezervasyon ve iptal sayıları. Tam değerler aşağıdaki tabloda.">${content}</svg>`;
  $('#monthly-table tbody').innerHTML = data.map(d => `<tr><td>${esc(monthLabel(d.month))}</td><td>${nf.format(d.bookings)}</td><td>${nf.format(d.cancellations)}</td><td>${pct(d.rate)}</td></tr>`).join('');
}
$('#chart-period').addEventListener('change', renderMonthlyChart);

function lineChart(points, calibration = false) {
  const w = 320, h = 230, left = 36, top = 20, right = 297, bottom = 190;
  let lines = '';
  [0, .25, .5, .75, 1].forEach(n => { const y = bottom - n * (bottom - top), x = left + n * (right - left); lines += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#edf0f8"/><text x="${left - 9}" y="${y + 3}" text-anchor="end">${dec(n, 2)}</text><text x="${x}" y="${bottom + 20}" text-anchor="middle">${dec(n, 2)}</text>`; });
  const xy = points.map(([a, b]) => [left + a * (right - left), bottom - b * (bottom - top)]);
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${calibration ? 'Test verisinde olasılık kalibrasyonu; kesikli çizgi ideal uyum' : 'Test verisi ROC eğrisi'}">${lines}<path d="M ${left} ${bottom} L ${right} ${top}" stroke="#b5bfd8" stroke-width="1" stroke-dasharray="4 4" fill="none"/>${!calibration ? `<path d="${path} L ${right} ${bottom} Z" fill="#ebefff" opacity=".65"/>` : ''}<path d="${path}" stroke="#6575d6" stroke-width="2.4" fill="none"/>${calibration ? xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#7888e4"/>`).join('') : ''}</svg>`;
}
function renderModels() {
  const m = report.holdout_test_metrics;
  $('#models-table-body').innerHTML = Object.entries(report.validation_metrics).sort((a, b) => b[1].pr_auc - a[1].pr_auc).map(([key, r]) => `<tr class="${key === report.selected_model ? 'selected' : ''}"><td><div class="model-name-cell"><div><strong>${names[key] || esc(key)}</strong><small>${descriptions[key] || ''}</small></div>${key === report.selected_model ? '<span class="winner-label">SEÇİLEN</span>' : ''}</div></td><td>${dec(r.pr_auc, 4)}</td><td>${dec(r.roc_auc, 4)}</td><td>${dec(r.f1_at_0_50, 4)}</td><td>${dec(r.brier_score, 4)}</td><td>${dec(report.training_seconds[key], 1)} sn</td></tr>`).join('');
  $('#split-strip').innerHTML = [['train', 'Eğitim'], ['validation', 'Doğrulama'], ['test', 'Test']].map(([key, label]) => { const dates = report.split_dates[key]; return `<div class="split-block"><strong>${nf.format(report.split_counts[key])}</strong><span>${label} · ${pct(report.split_counts[key] / report.rows_after_filtering)}</span><small>${dates ? `${dates[0]} — ${dates[1]}` : 'Sentetik sıra'}</small></div>`; }).join('');
  $('#test-range').textContent = `${names[report.selected_model]} · ${nf.format(report.split_counts.test)} rezervasyon · ${report.split_dates.test?.join(' — ') || 'Sentetik veri'}`;
  $('#test-stats').innerHTML = [
    ['ROC-AUC', dec(m.roc_auc, 3), 'Sıralama performansı'], ['Average Precision', dec(m.pr_auc, 3), 'Testteki iptal oranı: ' + pct(report.split_class_rates.test)],
    ['Precision @ %50', pct(m.precision_at_0_50), 'İptal denenlerin ne kadarı iptal etti?'], ['Recall @ %50', pct(m.recall_at_0_50), 'Gerçek iptallerin ne kadarı yakalandı?'],
  ].map(([label, value, note]) => `<div class="test-stat"><span>${label}</span><strong>${value}</strong><p>${note}</p></div>`).join('');
  $('#roc-chart').innerHTML = lineChart(report.holdout_curves.roc); $('#calibration-chart').innerHTML = lineChart(report.holdout_curves.calibration, true);
  const c = report.holdout_curves.confusion_matrix;
  $('#confusion-matrix').innerHTML = `<span>Gerçek ↓<br>Tahmin →</span><span>İptal değil</span><span>İptal</span><span>İptal değil</span><div class="cm-value correct"><strong>${nf.format(c[0][0])}</strong><small>Doğru negatif</small></div><div class="cm-value"><strong>${nf.format(c[0][1])}</strong><small>Yanlış pozitif</small></div><span>İptal</span><div class="cm-value"><strong>${nf.format(c[1][0])}</strong><small>Yanlış negatif</small></div><div class="cm-value correct"><strong>${nf.format(c[1][1])}</strong><small>Doğru pozitif</small></div>`;
  $('#recall-warning').textContent = `%50 eşiğinde gerçek iptallerin ${pct(m.recall_at_0_50)}’i yakalanıyor. ROC-AUC tek başına yeterli değildir: kaçırılan iptaller, olasılık kalibrasyonu ve otelin müdahale maliyetleri ayrıca değerlendirilmelidir. Test dönemi, eşik seçmek için kullanılmadı.`;
}
$('#download-metrics').addEventListener('click', () => { if (report) download('HotelMind_Deney_Raporu.json', JSON.stringify(report, null, 2)); });

const dialog = $('#csv-dialog');
$$('.csv-open').forEach(button => button.addEventListener('click', () => dialog.showModal()));
$('#close-csv').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
$('#csv-template').addEventListener('click', () => download('HotelMind_CSV_Sablonu.csv', '\uFEFF' + toCSV(fields, Object.values(presets).map(b => fields.map(f => b[f]))), 'text/csv'));
$('#csv-file').addEventListener('change', async event => {
  csvBookings = []; csvResults = []; $('#csv-download').hidden = true; $('#csv-run').disabled = true; $('#csv-status').textContent = '';
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw Error('Dosya 2 MB sınırını aşıyor.');
    const rows = parseCSV(await file.text());
    if (rows.length < 2) throw Error('Başlık ve en az bir rezervasyon satırı gerekli.');
    const header = rows.shift().map(x => x.trim());
    if (new Set(header).size !== fields.length || header.length !== fields.length || fields.some(f => !header.includes(f))) throw Error('Sütunlar şablondaki 17 alanla aynı olmalı. Örnek şablonu indirin.');
    if (rows.length > 500) throw Error('Tek dosyada en fazla 500 rezervasyon analiz edilebilir.');
    csvBookings = rows.map((row, i) => {
      try {
        if (row.length !== header.length) throw Error('Sütun sayısı başlıkla eşleşmiyor.');
        const b = Object.fromEntries(header.map((f, j) => { if (!row[j].trim()) throw Error(`${f} alanı boş.`); return [f, numbers.includes(f) ? Number(row[j].trim()) : row[j].trim()]; }));
        localValidate(b); return b;
      } catch (error) { throw Error(`Satır ${i + 2}: ${error.message}`); }
    });
    $('#csv-status').innerHTML = `<div class="csv-summary">${nf.format(csvBookings.length)} geçerli rezervasyon analize hazır.</div>`; $('#csv-run').disabled = !ready;
  } catch (error) { csvBookings = []; $('#csv-status').textContent = error.message; }
});
$('#csv-run').addEventListener('click', async () => {
  if (!csvBookings.length || !ready) return;
  $('#csv-file').disabled = true;
  $('#csv-run').disabled = true; $('#csv-run').textContent = 'Rezervasyonlar analiz ediliyor…'; $('#csv-download').hidden = true;
  try {
    csvResults = api ? (await jsonFetch('/predict/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookings: csvBookings }) })).predictions : await rpc('batch', { bookings: csvBookings });
    const high = csvResults.filter(r => r.risk_level === 'High').length;
    $('#csv-status').innerHTML = `<div class="csv-summary"><strong>${nf.format(csvResults.length)} rezervasyon analiz edildi.</strong><br>${nf.format(high)} yüksek riskli kayıt · Ortalama model olasılığı ${pct(csvResults.reduce((sum, r) => sum + r.cancellation_probability, 0) / csvResults.length)}<br>Sonuçlar analiz geçmişine eklenmez; CSV olarak indirebilirsiniz.</div>`;
    $('#csv-download').hidden = false;
  } catch (error) { $('#csv-status').textContent = `Analiz tamamlanamadı: ${error.message}`; }
  finally { $('#csv-file').disabled = false; $('#csv-run').disabled = false; $('#csv-run').innerHTML = `Dosyayı analiz et ${icon('arrow')}`; }
});
$('#csv-download').addEventListener('click', () => { if (!csvResults.length) return; download('HotelMind_Toplu_Analiz.csv', '\uFEFF' + toCSV([...fields, 'cancellation_probability', 'predicted_cancellation', 'risk_level', 'model_name', 'model_version'], csvBookings.map((b, i) => [...fields.map(f => b[f]), csvResults[i].cancellation_probability, csvResults[i].predicted_cancellation, csvResults[i].risk_level, csvResults[i].model_name, csvResults[i].model_version])), 'text/csv'); });

async function start() {
  try {
    [report, summary] = await Promise.all([jsonFetch('/assets/metrics.json'), jsonFetch('/assets/dataset_summary.json').catch(() => null)]);
    renderStats(); renderOverview(); renderModels();
    if (report.data_kind === 'synthetic') showError('Bu eğitim sentetik demo verisine aittir. Ölçümler gerçek otel performansını göstermez.', '#global-error');
    if (api) {
      const health = await jsonFetch('/health');
      if (!health.model_available) throw Error('Python model dosyası bulunamadı. Eğitim komutunu çalıştırın.');
    } else {
      worker = new Worker('/assets/analysis-worker.js', { type: 'module' });
      worker.onmessage = ({ data }) => { const item = pending.get(data.id); if (!item) return; pending.delete(data.id); data.error ? item.reject(Error(data.error)) : item.resolve(data.result); };
      worker.onerror = () => { for (const item of pending.values()) item.reject(Error('Model işlemcisi başlatılamadı. Sayfayı yenileyin.')); pending.clear(); };
      await rpc('init');
    }
    ready = true; $('#engine-status').classList.add('ready'); $('#engine-status').innerHTML = `<i></i>${api ? 'Python API · bağlı' : 'Model tarayıcıda çalışıyor'}`;
    $('#analyze-button').disabled = false; $('#model-pill').textContent = names[report.selected_model];
    await analyze(true);
  } catch (error) { showError(`Uygulama hazırlanamadı: ${error.message}`, '#global-error'); $('#engine-status').innerHTML = '<i></i>Bağlantı kurulamadı'; $('#risk-badge').textContent = 'Model kullanılamıyor'; $('#result-card').setAttribute('aria-busy', 'false'); }
}
start();
