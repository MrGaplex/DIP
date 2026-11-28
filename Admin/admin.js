// ===== ADMIN.JS - SEBELAH (Supabase) =====
const COLORS = {
  a: '#6366f1', b: '#a855f7', c: '#38bdf8', d: '#f59e0b',
  text: '#cbd5e1', grid: 'rgba(148,163,184,0.15)'
};
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const DB = { reguler: [], charter: [] };
const charts = {};

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const sum = (arr, k) => arr.reduce((s, d) => s + Number(d[k] || 0), 0);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
const pctText = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
function rp(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 1e9) return 'Rp ' + (n / 1e9).toFixed(2).replace('.', ',') + ' M';
  if (Math.abs(n) >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}
function groupSum(rows, keyField, valField) {
  const m = {};
  rows.forEach(d => { m[d[keyField]] = (m[d[keyField]] || 0) + Number(d[valField]); });
  return m;
}
function allYears() {
  return [...new Set([...DB.reguler, ...DB.charter].map(d => d.tahun))].sort();
}
function maxMonth(y) {
  const all = [...DB.reguler, ...DB.charter].filter(d => d.tahun === y);
  return all.length ? Math.max(...all.map(d => d.bulan)) : 12;
}
function fillYearSelect(id) {
  const sel = $(id); if (!sel) return;
  const ys = allYears();
  sel.innerHTML = ys.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = ys[ys.length - 1];
}
function makeChart(id, config) {
  const canvas = $(id); if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, config);
}
function opts(extra = {}, horizontal = false) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { labels: { color: COLORS.text } } },
    scales: {
      x: { ticks: { color: COLORS.text }, grid: { color: horizontal ? COLORS.grid : 'transparent' } },
      y: { beginAtZero: true, ticks: { color: COLORS.text }, grid: { color: horizontal ? 'transparent' : COLORS.grid } }
    }
  }, extra);
}
function sortedEntries(obj) { return Object.entries(obj).sort((a, b) => b[1] - a[1]); }

// ---------- auth ----------
async function logout() {
  await sb.auth.signOut();
  window.location.href = '../Index/index.html';
}

// ---------- init ----------
async function init() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { window.location.href = '../Index/index.html'; return; }
  try {
    const [r, c] = await Promise.all([
      sb.from('rute_reguler').select('*').limit(1000),
      sb.from('charter_wisata').select('*').limit(1000)
    ]);
    if (r.error) throw r.error;
    if (c.error) throw c.error;
    DB.reguler = r.data; DB.charter = c.data;
  } catch (e) {
    console.error(e);
    const main = document.querySelector('.page-content');
    if (main) main.innerHTML = '<p style="color:#f43f5e;padding:2rem;text-align:center;">Gagal memuat data dari Supabase. Cek Console (F12).</p>';
    return;
  }
  const p = window.location.pathname.toLowerCase();
  if (p.includes('rute-reguler')) initRute();
  else if (p.includes('wisata-charter')) initCharter();
  else initDashboard();
}

// ---------- DASHBOARD ----------
function initDashboard() {
  fillYearSelect('yearFilter');
  $('yearFilter').addEventListener('change', renderDashboard);
  renderDashboard();
}
function renderDashboard() {
  const y = +$('yearFilter').value, mm = maxMonth(y);
  const pick = (arr, yr) => arr.filter(d => d.tahun === yr && d.bulan <= mm);
  const r = pick(DB.reguler, y), c = pick(DB.charter, y);
  const gross = sum(r, 'pendapatan_kotor') + sum(c, 'pendapatan_kotor');
  const cost = sum(r, 'biaya_operasional') + sum(c, 'biaya_operasional');
  const net = gross - cost;
  const occ = sum(r, 'penumpang') / (sum(r, 'kursi_tersedia') || 1) * 100;

  const pr = pick(DB.reguler, y - 1), pc = pick(DB.charter, y - 1);
  const prevGross = sum(pr, 'pendapatan_kotor') + sum(pc, 'pendapatan_kotor');
  setText('stat-revenue', rp(gross));
  setText('stat-revenue-change', prevGross ? pctText((gross - prevGross) / prevGross * 100) + ' vs ' + (y - 1) : '');
  setText('stat-net', rp(net));
  setText('stat-margin', 'margin ' + (gross ? (net / gross * 100).toFixed(1) : 0) + '%');
  setText('stat-occupancy', occ.toFixed(1) + '%');
  setText('stat-charter', sum(c, 'jumlah_charter'));
  setText('periode-info', `Periode: Jan - ${BULAN[mm - 1]} ${y}` + (prevGross ? ` (dibanding Jan - ${BULAN[mm - 1]} ${y - 1})` : ''));

  const monthly = (arr, yr) => BULAN.map((_, i) => {
    const rows = arr.filter(d => d.tahun === yr && d.bulan === i + 1);
    return rows.length ? sum(rows, 'pendapatan_kotor') : null;
  });
  makeChart('monthlyChart', {
    type: 'line',
    data: { labels: BULAN, datasets: [
      { label: 'Reguler', data: monthly(DB.reguler, y), borderColor: COLORS.a, backgroundColor: 'rgba(99,102,241,0.15)', fill: true, tension: 0.3 },
      { label: 'Charter Wisata', data: monthly(DB.charter, y), borderColor: COLORS.d, backgroundColor: 'rgba(245,158,11,0.12)', fill: true, tension: 0.3 }
    ] },
    options: opts()
  });
  const byRoute = sortedEntries(groupSum(DB.reguler.filter(d => d.tahun === y), 'rute', 'pendapatan_kotor'));
  makeChart('routeChart', {
    type: 'bar',
    data: { labels: byRoute.map(e => e[0]), datasets: [{ label: 'Pendapatan kotor', data: byRoute.map(e => e[1]), backgroundColor: COLORS.b, borderRadius: 4 }] },
    options: opts({ plugins: { legend: { display: false } } }, true)
  });
}

// ---------- RUTE REGULER ----------
function initRute() {
  fillYearSelect('yearFilter');
  const routes = [...new Set(DB.reguler.map(d => d.rute))].sort();
  $('routeFilter').innerHTML = '<option value="">Semua Rute</option>' + routes.map(x => `<option>${x}</option>`).join('');
  $('yearFilter').addEventListener('change', renderRute);
  $('routeFilter').addEventListener('change', renderRute);
  renderRute();
}
function renderRute() {
  const y = +$('yearFilter').value, rt = $('routeFilter').value;
  const yearRows = DB.reguler.filter(d => d.tahun === y);
  const rows = rt ? yearRows.filter(d => d.rute === rt) : yearRows;
  const pax = sum(rows, 'penumpang'), seats = sum(rows, 'kursi_tersedia');
  setText('stat-pax', pax.toLocaleString('id-ID'));
  setText('stat-seats', seats.toLocaleString('id-ID'));
  setText('stat-occ', (pax / (seats || 1) * 100).toFixed(1) + '%');
  setText('stat-rev', rp(sum(rows, 'pendapatan_kotor')));

  const paxBy = groupSum(yearRows, 'rute', 'penumpang'), seatBy = groupSum(yearRows, 'rute', 'kursi_tersedia');
  const occ = Object.keys(paxBy).map(k => [k, paxBy[k] / seatBy[k] * 100]).sort((a, b) => b[1] - a[1]);
  setText('top-route', occ.length ? `Rute terlaris ${y}: ${occ[0][0]} (okupansi ${occ[0][1].toFixed(1)}%)` : '');
  makeChart('occupancyChart', {
    type: 'bar',
    data: { labels: occ.map(e => e[0]), datasets: [{ label: 'Okupansi (%)', data: occ.map(e => +e[1].toFixed(1)), backgroundColor: COLORS.a, borderRadius: 4 }] },
    options: opts({ plugins: { legend: { display: false } } }, true)
  });
  const per = k => BULAN.map((_, i) => { const m = rows.filter(d => d.bulan === i + 1); return m.length ? sum(m, k) : null; });
  makeChart('seatsChart', {
    type: 'bar',
    data: { labels: BULAN, datasets: [
      { label: 'Kursi tersedia', data: per('kursi_tersedia'), backgroundColor: COLORS.c, borderRadius: 4 },
      { label: 'Penumpang naik', data: per('penumpang'), backgroundColor: COLORS.b, borderRadius: 4 }
    ] },
    options: opts()
  });
}

// ---------- WISATA CHARTER ----------
function initCharter() {
  fillYearSelect('yearFilter');
  $('yearFilter').addEventListener('change', renderCharter);
  renderCharter();
}
function renderCharter() {
  const y = +$('yearFilter').value;
  const rows = DB.charter.filter(d => d.tahun === y);
  const n = sum(rows, 'jumlah_charter'), hari = sum(rows, 'total_hari_sewa');
  setText('stat-ch-total', n.toLocaleString('id-ID'));
  setText('stat-ch-hari', hari.toLocaleString('id-ID'));
  setText('stat-ch-avg', (hari / (n || 1)).toFixed(1) + ' hari');
  setText('stat-ch-rev', rp(sum(rows, 'pendapatan_kotor')));

  const perMonth = BULAN.map((_, i) => { const m = rows.filter(d => d.bulan === i + 1); return m.length ? sum(m, 'jumlah_charter') : null; });
  makeChart('charterMonthChart', {
    type: 'bar',
    data: { labels: BULAN, datasets: [{ label: 'Jumlah charter', data: perMonth, backgroundColor: COLORS.d, borderRadius: 4 }] },
    options: opts({ plugins: { legend: { display: false } } })
  });
  const armadas = ['Bus Besar', 'Bus Medium', 'Elf'];
  const cBy = groupSum(rows, 'armada', 'jumlah_charter'), hBy = groupSum(rows, 'armada', 'total_hari_sewa');
  makeChart('armadaChart', {
    type: 'bar',
    data: { labels: armadas, datasets: [
      { label: 'Jumlah charter', data: armadas.map(a => cBy[a] || 0), backgroundColor: COLORS.a, borderRadius: 4, yAxisID: 'y' },
      { label: 'Total hari sewa', data: armadas.map(a => hBy[a] || 0), backgroundColor: COLORS.c, borderRadius: 4, yAxisID: 'y1' }
    ] },
    options: opts({ scales: {
      x: { ticks: { color: COLORS.text }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: COLORS.text }, grid: { color: COLORS.grid } },
      y1: { beginAtZero: true, position: 'right', ticks: { color: COLORS.text }, grid: { display: false } }
    } })
  });
  const tj = sortedEntries(groupSum(rows, 'tujuan', 'jumlah_charter'));
  makeChart('tujuanChart', {
    type: 'bar',
    data: { labels: tj.map(e => e[0]), datasets: [{ label: 'Jumlah charter', data: tj.map(e => e[1]), backgroundColor: COLORS.b, borderRadius: 4 }] },
    options: opts({ plugins: { legend: { display: false } } }, true)
  });
  const N8N_WEBHOOK_URL = 'TEMPEL_PRODUCTION_URL_DI_SINI';

async function kirimKeTelegram() {
  const y = +$('yearFilter').value, mm = maxMonth(y);
  const r = DB.reguler.filter(d => d.tahun === y && d.bulan <= mm);
  const c = DB.charter.filter(d => d.tahun === y && d.bulan <= mm);
  const gross = sum(r, 'pendapatan_kotor') + sum(c, 'pendapatan_kotor');
  const cost = sum(r, 'biaya_operasional') + sum(c, 'biaya_operasional');
  const payload = {
    tahun: y,
    periode: 'Jan - ' + BULAN[mm - 1],
    pendapatan_kotor: gross,
    laba_bersih: gross - cost,
    okupansi: +(sum(r, 'penumpang') / (sum(r, 'kursi_tersedia') || 1) * 100).toFixed(1),
    total_charter: sum(c, 'jumlah_charter')
  };
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert(res.ok ? 'Terkirim ke Telegram.' : 'Gagal mengirim (status ' + res.status + ').');
  } catch (e) {
    console.error(e);
    alert('Gagal mengirim. Cek Console (F12).');
  }
 }
}

init();