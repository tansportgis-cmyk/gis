// ==========================================================
//  reports.js — تقارير وإحصائيات لوحة GIS
//  الرسوم: Chart.js · التصدير: SheetJS (يُحمّلان عند فتح التبويب فقط)
// ==========================================================
import { $, $$, esc, icon, t, isEn, toDate, fmtDate, STATUS, overdueInfo, toast, emptyState } from "./core.js";

const DAY = 86400000;
const LIBS = {
  chart: ["https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js", "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"],
  xlsx: ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"]
};
const loaded = {};
function loadLib(name, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (loaded[name]) return loaded[name];
  loaded[name] = (async () => {
    for (const src of LIBS[name]) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.append(s);
        });
        if (window[globalName]) return window[globalName];
      } catch { /* نجرب الرابط التالي */ }
    }
    throw new Error(t("تعذر تحميل مكتبة الرسوم، تحقق من الإنترنت"));
  })();
  return loaded[name];
}

/* ---------------- حساب مدة المراحل لكل طلب ---------------- */
export function durations(r) {
  const h = (r.history || [])
    .map(x => ({ a: x.action, t: toDate(x.at)?.getTime() }))
    .filter(x => x.t).sort((a, b) => a.t - b.t);
  const created = toDate(r.createdAt)?.getTime() || h[0]?.t;
  const first = (acts, after = 0) => h.find(x => acts.includes(x.a) && x.t >= after);
  const out = {};
  const resp = first(["accepted", "needs_info", "rejected"]);
  if (resp && created) out.firstResponse = (resp.t - created) / DAY;
  const acc = first(["accepted"]);
  const sent = acc && first(["sent_maint"], acc.t);
  if (acc && sent) out.gisWork = (sent.t - acc.t) / DAY;
  let m = 0, ms = null, mAny = false;
  for (const x of h) {
    if (x.a === "sent_maint" || x.a === "returned_maint") ms = x.t;
    else if (x.a === "maint_done" && ms != null) { m += x.t - ms; ms = null; mAny = true; }
  }
  if (mAny) out.maint = m / DAY;
  let v = 0, vs = null, vAny = false;
  for (const x of h) {
    if (x.a === "maint_done") vs = x.t;
    else if (["approved", "returned_maint", "rejected"].includes(x.a) && vs != null) { v += x.t - vs; vs = null; vAny = true; }
  }
  if (vAny) out.review = v / DAY;
  const appr = [...h].reverse().find(x => x.a === "approved");
  if (r.status === "approved" && appr && created) { out.total = (appr.t - created) / DAY; out.approvedAt = appr.t; }
  return out;
}
const avg = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
const fmt1 = v => v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString(isEn ? "en-GB" : "ar-u-nu-latn");

/* ---------------- الواجهة ---------------- */
export function initReports({ getRequests, getSla }) {
  let period = 6, charts = [], ready = false, pending = false;
  const box = $("#tab-reports");
  box.innerHTML = `
    <div class="rep-tools">
      <select class="input act-period" id="repPeriod">
        <option value="3">${t("آخر 3 أشهر")}</option>
        <option value="6" selected>${t("آخر 6 أشهر")}</option>
        <option value="12">${t("آخر 12 شهر")}</option>
        <option value="0">${t("كل الفترات")}</option>
      </select>
      <button class="btn btn-primary" id="repExport" type="button">${icon("download")} ${t("تصدير Excel")}</button>
    </div>
    <div class="stats" id="repKpis"></div>
    <div class="rep-grid">
      <section class="card rep-card rep-wide"><h3>${t("الطلبات شهرياً")}</h3><p class="muted">${t("المقدّمة والمكتملة في كل شهر")}</p><div class="rep-chart"><canvas id="chMonthly"></canvas></div></section>
      <section class="card rep-card"><h3>${t("متوسط مدة كل مرحلة")}</h3><p class="muted">${t("بالأيام، للطلبات في الفترة المختارة")}</p><div class="rep-chart"><canvas id="chStages"></canvas></div></section>
      <section class="card rep-card"><h3>${t("الطلبات حسب الحالة")}</h3><p class="muted">${t("كل الطلبات المقدّمة في الفترة")}</p><div class="rep-chart"><canvas id="chStatus"></canvas></div></section>
      <section class="card rep-card rep-wide"><h3>${t("أكثر الشركات طلباً")}</h3><div class="rep-table" id="repCompanies"></div></section>
      <section class="card rep-card rep-wide"><h3>${t("أداء فرق الصيانة")}</h3><div class="rep-table" id="repTeams"></div></section>
    </div>`;
  $("#repPeriod").onchange = e => { period = +e.target.value; render(); };
  $("#repExport").onclick = () => exportExcel(compute());

  function inPeriod(ms) { return !period || ms >= monthStart(period - 1); }
  function monthStart(back) { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - back); return d.getTime(); }

  function compute() {
    const sla = getSla();
    const all = getRequests().map(r => ({ r, d: durations(r), created: toDate(r.createdAt)?.getTime() || Date.now() }));
    const submitted = all.filter(x => inPeriod(x.created));
    const completed = all.filter(x => x.d.approvedAt && inPeriod(x.d.approvedAt));
    const late = getRequests().filter(r => overdueInfo(r, sla)?.late);
    // الأشهر
    const months = [];
    let n = period || 0;
    if (!n) {
      const first = Math.min(...all.map(x => x.created), Date.now());
      const a = new Date(first), b = new Date();
      n = Math.min(24, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
    }
    for (let i = n - 1; i >= 0; i--) {
      const s = monthStart(i), e = monthStart(i - 1);
      months.push({
        label: new Intl.DateTimeFormat(isEn ? "en-GB" : "ar-u-nu-latn", { month: "short", year: "2-digit" }).format(new Date(s)),
        submitted: all.filter(x => x.created >= s && x.created < e).length,
        completed: all.filter(x => x.d.approvedAt >= s && x.d.approvedAt < e).length
      });
    }
    const stageKeys = [["firstResponse", "أول رد من GIS"], ["gisWork", "عمل GIS"], ["maint", "الصيانة"], ["review", "مراجعة GIS"], ["total", "مدة الإنجاز الكاملة"]];
    const stages = stageKeys.map(([k, l]) => ({ key: k, label: t(l), value: avg(submitted.map(x => x.d[k]).filter(v => v != null)) }));
    const byStatus = Object.keys(STATUS).map(k => ({ key: k, label: STATUS[k].label, value: submitted.filter(x => x.r.status === k).length }));
    // الشركات
    const cmap = new Map();
    submitted.forEach(({ r, d }) => {
      const k = r.companyId || r.companyName;
      const c = cmap.get(k) || { name: r.companyName || "—", total: 0, done: 0, durs: [] };
      c.total++; if (r.status === "approved") c.done++; if (d.total != null) c.durs.push(d.total);
      cmap.set(k, c);
    });
    const companies = [...cmap.values()].map(c => ({ ...c, avg: avg(c.durs) })).sort((a, b) => b.total - a.total);
    // فرق الصيانة
    const tmap = new Map();
    submitted.filter(x => x.r.maintVisible).forEach(({ r, d }) => {
      const k = r.maintTeamId || "";
      const tm = tmap.get(k) || { name: r.maintTeamName || t("كل فرق الصيانة"), total: 0, done: 0, durs: [], late: 0 };
      tm.total++; if (r.status === "approved") tm.done++; if (d.maint != null) tm.durs.push(d.maint);
      if (overdueInfo(r, sla)?.late && r.status === "maintenance") tm.late++;
      tmap.set(k, tm);
    });
    const teams = [...tmap.values()].map(x => ({ ...x, avg: avg(x.durs) })).sort((a, b) => b.total - a.total);
    return { all, submitted, completed, late, months, stages, byStatus, companies, teams, avgTotal: avg(completed.map(x => x.d.total).filter(v => v != null)) };
  }

  function render() {
    if (!ready) return;
    const c = compute();
    $("#repKpis").innerHTML = `
      <div class="stat blue"><b>${c.submitted.length}</b><span>${t("طلبات مقدّمة")}</span></div>
      <div class="stat green"><b>${c.completed.length}</b><span>${t("طلبات مكتملة")}</span></div>
      <div class="stat purple"><b>${fmt1(c.avgTotal)}</b><span>${t("متوسط مدة الإنجاز (يوم)")}</span></div>
      <div class="stat ${c.late.length ? "red" : "teal"}"><b>${c.late.length}</b><span>${t("طلبات متأخرة الآن")}</span></div>`;
    const tableHTML = (rows, cols) => rows.length
      ? `<table><thead><tr>${cols.map(x => `<th>${esc(x[0])}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(x => `<td>${x[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : emptyState(t("لا توجد بيانات في هذه الفترة"));
    $("#repCompanies").innerHTML = tableHTML(c.companies.slice(0, 10), [
      [t("الشركة"), r => esc(r.name)], [t("الطلبات"), r => r.total], [t("مكتملة"), r => r.done], [t("متوسط الإنجاز (يوم)"), r => fmt1(r.avg)]
    ]);
    $("#repTeams").innerHTML = tableHTML(c.teams, [
      [t("الفريق"), r => esc(r.name)], [t("الطلبات"), r => r.total], [t("مكتملة"), r => r.done],
      [t("متوسط مدة الصيانة (يوم)"), r => fmt1(r.avg)], [t("متأخرة الآن"), r => r.late ? `<span class="chip st-late">${r.late}</span>` : "0"]
    ]);
    drawCharts(c);
  }

  function drawCharts(c) {
    const Chart = window.Chart;
    if (!Chart) return;
    charts.forEach(ch => ch.destroy()); charts = [];
    const rtl = !isEn;
    const css = getComputedStyle(document.documentElement);
    Chart.defaults.font.family = "'IBM Plex Sans Arabic', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#6b7587";
    const grid = { color: "#e9edf3" };
    const tip = { rtl, textDirection: rtl ? "rtl" : "ltr", padding: 10, cornerRadius: 8 };
    const legend = { rtl, position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 14 } };
    charts.push(new Chart($("#chMonthly"), {
      type: "bar",
      data: {
        labels: c.months.map(m => m.label),
        datasets: [
          { label: t("مقدّمة"), data: c.months.map(m => m.submitted), backgroundColor: "#1d6fe0", borderRadius: 4, maxBarThickness: 26 },
          { label: t("مكتملة"), data: c.months.map(m => m.completed), backgroundColor: "#e8a33d", borderRadius: 4, maxBarThickness: 26 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend, tooltip: tip },
        scales: { x: { reverse: rtl, grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid, position: rtl ? "right" : "left" } }
      }
    }));
    const hbar = (el, labels, data, colors, unit) => new Chart(el, {
      type: "bar",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, maxBarThickness: 22 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tip, callbacks: { label: ctx => `${fmt1(ctx.parsed.x)}${unit}` } } },
        scales: { x: { reverse: rtl, beginAtZero: true, grid }, y: { position: rtl ? "right" : "left", grid: { display: false } } }
      }
    });
    charts.push(hbar($("#chStages"), c.stages.map(s => s.label), c.stages.map(s => s.value == null ? 0 : Math.round(s.value * 10) / 10), "#1d6fe0", " " + t("يوم")));
    const SC = { new: "#1d6fe0", needs_info: "#c26a00", gis_work: "#3a55c9", maintenance: "#7046d9", gis_review: "#0b8585", approved: "#1e9a52", rejected: "#d8393a" };
    charts.push(hbar($("#chStatus"), c.byStatus.map(s => s.label), c.byStatus.map(s => s.value), c.byStatus.map(s => SC[s.key]), ""));
    void css;
  }

  async function exportExcel(c) {
    const btn = $("#repExport");
    btn.disabled = true;
    try {
      const XLSX = await loadLib("xlsx", "XLSX");
      const sla = getSla();
      const rows = c.submitted.map(({ r, d }) => ({
        [t("رقم الطلب")]: r.number,
        [t("نوع الطلب")]: t(r.type || ""),
        [t("الشركة")]: r.companyName || "",
        [t("الحالة")]: STATUS[r.status]?.label || r.status,
        [t("فريق الصيانة")]: r.maintVisible ? (r.maintTeamName || t("كل فرق الصيانة")) : "",
        [t("تاريخ التقديم")]: fmtDate(r.createdAt),
        [t("تاريخ الإنجاز")]: d.approvedAt ? fmtDate(d.approvedAt) : "",
        [t("أول رد من GIS (يوم)")]: d.firstResponse != null ? +d.firstResponse.toFixed(1) : "",
        [t("عمل GIS (يوم)")]: d.gisWork != null ? +d.gisWork.toFixed(1) : "",
        [t("الصيانة (يوم)")]: d.maint != null ? +d.maint.toFixed(1) : "",
        [t("مراجعة GIS (يوم)")]: d.review != null ? +d.review.toFixed(1) : "",
        [t("مدة الإنجاز الكاملة (يوم)")]: d.total != null ? +d.total.toFixed(1) : "",
        [t("متأخر")]: overdueInfo(r, sla)?.late ? t("نعم") : "",
        [t("مؤرشف")]: r.archived ? t("نعم") : ""
      }));
      const sheet = (data, widths) => {
        const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ "": t("لا توجد بيانات في هذه الفترة") }]);
        ws["!cols"] = (widths || Object.keys(data[0] || { a: 1 }).map(() => 16)).map(w => ({ wch: w }));
        return ws;
      };
      const wb = XLSX.utils.book_new();
      if (!isEn) wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, sheet(rows, [10, 16, 26, 16, 22, 13, 13, 14, 12, 12, 13, 16, 8, 8]), t("الطلبات"));
      XLSX.utils.book_append_sheet(wb, sheet(c.months.map(m => ({ [t("الشهر")]: m.label, [t("مقدّمة")]: m.submitted, [t("مكتملة")]: m.completed }))), t("شهرياً"));
      XLSX.utils.book_append_sheet(wb, sheet(c.stages.map(s => ({ [t("المرحلة")]: s.label, [t("متوسط المدة (يوم)")]: s.value == null ? "" : +s.value.toFixed(1) })), [26, 18]), t("مدة المراحل"));
      XLSX.utils.book_append_sheet(wb, sheet(c.companies.map(x => ({ [t("الشركة")]: x.name, [t("الطلبات")]: x.total, [t("مكتملة")]: x.done, [t("متوسط الإنجاز (يوم)")]: x.avg == null ? "" : +x.avg.toFixed(1) })), [30, 10, 10, 18]), t("الشركات"));
      XLSX.utils.book_append_sheet(wb, sheet(c.teams.map(x => ({ [t("الفريق")]: x.name, [t("الطلبات")]: x.total, [t("مكتملة")]: x.done, [t("متوسط مدة الصيانة (يوم)")]: x.avg == null ? "" : +x.avg.toFixed(1), [t("متأخرة الآن")]: x.late })), [30, 10, 10, 22, 12]), t("فرق الصيانة"));
      XLSX.writeFile(wb, `gis-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast(e.message || String(e), "error");
    } finally { btn.disabled = false; }
  }

  return {
    // يُستدعى عند فتح التبويب
    async show() {
      if (ready) { render(); return; }
      if (pending) return;
      pending = true;
      try { await loadLib("chart", "Chart"); } catch (e) { toast(e.message, "error"); }
      ready = true; pending = false;
      render();
    },
    // يُستدعى عند تغيّر البيانات
    refresh() { if (ready && !$("#tab-reports").hidden) render(); }
  };
}
