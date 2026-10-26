// لوحة GIS (مدير النظام)
import {
  db, F, $, $$, esc, icon, toast, errMsg, requireAuth, renderShell, hideBoot,
  requestCard, emptyState, byDateDesc, STATUS, ROLES, ROLE_KEYS, fmtDate, modal, askNote, notify,
  DEFAULT_TYPES, t, markCurrentPageRead, avatarPicker, avatarChanges,
  toDate, fmtDateTime, HISTORY_LABELS, ACTIVITY_LABELS, logActivity
} from "./core.js";

const { profile } = await requireAuth(["gis"]);
renderShell(profile, { title: t("لوحة GIS"), subtitle: profile.orgName });
$("#searchIc").outerHTML = icon("search");

/* ---------- التنقل ---------- */
const TABS = { requests: [t("الطلبات"), "inbox"], accounts: [t("الحسابات"), "users"], activity: [t("السجل"), "clock"], settings: [t("الإعدادات"), "settings"] };
let tab = (location.hash.slice(1) in TABS) ? location.hash.slice(1) : "requests";
let requests = [], users = [], activity = [];

function renderNav() {
  const pendingUsers = users.filter(u => u.status === "pending").length;
  const actionReqs = requests.filter(r => !r.archived && ["new", "gis_review"].includes(r.status)).length;
  const badge = { requests: actionReqs, accounts: pendingUsers };
  $("#nav").innerHTML = Object.entries(TABS).map(([k, [label, ic]]) =>
    `<button class="navtab ${k === tab ? "active" : ""}" data-tab="${k}">${icon(ic)} ${label}${badge[k] ? ` <span class="n">${badge[k]}</span>` : ""}</button>`).join("");
  $$("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, "", "#" + tab); showTab(); markCurrentPageRead(); });
}
function showTab() {
  Object.keys(TABS).forEach(k => ($("#tab-" + k).hidden = k !== tab));
  renderNav();
}
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h in TABS) { tab = h; showTab(); } });

/* ---------- الطلبات ---------- */
// الطلبات المؤرشفة لا تظهر إلا في تصنيف «الأرشيف»
const FILTERS = {
  action:      { label: t("بحاجة لإجرائك"), match: r => !r.archived && ["new", "gis_review"].includes(r.status) },
  all:         { label: t("الكل"), match: r => !r.archived },
  ...Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, { label: v.label, match: r => !r.archived && r.status === k }])),
  archived:    { label: t("الأرشيف"), match: r => !!r.archived }
};
let filter = "action", query = "";

function renderRequests() {
  const c = k => requests.filter(FILTERS[k].match).length;
  $("#stats").innerHTML = `
    <button class="stat blue" data-f="action"><b>${c("action")}</b><span>${t("بحاجة لإجرائك")}</span></button>
    <button class="stat orange" data-f="gis_work"><b>${c("gis_work")}</b><span>${t("قيد العمل في GIS")}</span></button>
    <button class="stat purple" data-f="maintenance"><b>${c("maintenance")}</b><span>${t("عند الصيانة")}</span></button>
    <button class="stat green" data-f="approved"><b>${c("approved")}</b><span>${t("مكتملة")}</span></button>`;
  $("#filters").innerHTML = Object.entries(FILTERS).map(([k, f]) =>
    `<button class="tab ${k === filter ? "active" : ""}" data-f="${k}">${f.label} <span class="n">${c(k)}</span></button>`).join("");
  const q = query.trim().toLowerCase().replace(/^#/, "");
  const list = requests.filter(FILTERS[filter].match).filter(r => !q ||
    String(r.number).includes(q) || (r.companyName || "").toLowerCase().includes(q) ||
    (r.description || "").toLowerCase().includes(q) || (r.type || "").toLowerCase().includes(q) ||
    t(r.type || "").toLowerCase().includes(q));
  $("#list").innerHTML = list.length ? list.map(r => requestCard(r)).join("")
    : emptyState(filter === "action" && !q ? t("لا توجد طلبات بحاجة لإجرائك") : t("لا توجد طلبات"));
  $$("#stats [data-f], #filters [data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; renderRequests(); });
  renderNav();
}
$("#search").addEventListener("input", e => { query = e.target.value; renderRequests(); });

F.onSnapshot(F.query(F.collection(db, "requests"), F.orderBy("createdAt", "desc")), snap => {
  requests = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc);
  renderRequests();
  renderActivity();
  archHint();
  hideBoot();
}, e => { toast(errMsg(e), "error"); hideBoot(); });

/* ---------- الحسابات ---------- */
const UFILTERS = {
  pending:     { label: t("بانتظار الموافقة"), match: u => u.status === "pending" },
  company:     { label: t("الشركات"), match: u => u.status === "approved" && u.role === "company" },
  maintenance: { label: t("الصيانة"), match: u => u.status === "approved" && u.role === "maintenance" },
  gis:         { label: "GIS", match: u => u.status === "approved" && u.role === "gis" },
  inactive:    { label: t("مرفوض / موقوف"), match: u => ["rejected", "disabled"].includes(u.status) }
};
let ufilter = null;
const roleIcon = { company: "building", maintenance: "wrench", gis: "layers" };
const ST_U = { pending: [t("بانتظار الموافقة"), "st-warn"], approved: [t("مفعّل"), "st-done"], rejected: [t("مرفوض"), "st-rejected"], disabled: [t("موقوف"), "st-muted"] };

function renderUsers() {
  if (!ufilter) ufilter = users.some(u => u.status === "pending") ? "pending" : "company";
  const c = k => users.filter(UFILTERS[k].match).length;
  $("#userFilters").innerHTML = Object.entries(UFILTERS).map(([k, f]) =>
    `<button class="tab ${k === ufilter ? "active" : ""}" data-uf="${k}">${f.label} <span class="n">${c(k)}</span></button>`).join("");
  $$("[data-uf]").forEach(b => b.onclick = () => { ufilter = b.dataset.uf; renderUsers(); });
  const list = users.filter(UFILTERS[ufilter].match);
  const B = (act, id, cls, ic, label) => `<button class="btn ${cls} btn-sm" data-act="${act}" data-id="${id}">${ic ? icon(ic) : ""} ${label}</button>`;
  $("#users").innerHTML = list.length ? list.map(u => {
    const st = ST_U[u.status] || [u.status, ""];
    const self = u.id === profile.id;
    const actions = [];
    if (u.status === "pending") actions.push(B("approve", u.id, "btn-success", "check", t("قبول")), B("reject", u.id, "btn-outline-danger", "x", t("رفض")));
    else if (u.status === "approved" && !self) actions.push(B("disable", u.id, "btn-warn", "ban", t("إيقاف")));
    else if (!self) actions.push(B("enable", u.id, "btn-outline", "check", t("تفعيل")));
    actions.push(B("edit", u.id, "btn-ghost", "edit", t("تعديل")));
    if (!self) actions.push(B("delete", u.id, "btn-outline-danger", "trash", t("حذف")));
    return `
      <div class="user-card">
        <div class="user-av ${esc(u.role)}">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" loading="lazy">` : icon(roleIcon[u.role] || "users")}</div>
        <div class="user-info">
          <div class="top"><strong>${esc(u.orgName || u.name || u.email)}</strong><span class="chip ${st[1]}">${st[0]}</span>${self ? `<span class="chip st-new">${t("أنت")}</span>` : ""}</div>
          <small>${esc(ROLES[u.role] || u.role)}${u.name ? " · " + esc(u.name) : ""}</small>
          <small><bdi>${esc(u.email || "")}</bdi>${u.phone ? ` · <bdi>${esc(u.phone)}</bdi>` : ""}</small>
          <small>${t("تاريخ التسجيل")}: ${esc(fmtDate(u.createdAt))}</small>
          ${u.rejectReason && u.status === "rejected" ? `<small style="color:var(--danger)">${t("سبب الرفض")}: ${esc(u.rejectReason)}</small>` : ""}
          <div class="user-actions">${actions.join("")}</div>
        </div>
      </div>`;
  }).join("") : emptyState(t("لا توجد حسابات"));
  renderNav();
}

const roleSelect = (cur, disabled = false) => `
  <label class="field"><span>${t("الصلاحية")}</span>
    <select id="roleSel" ${disabled ? "disabled" : ""}>${Object.keys(ROLE_KEYS).map(k => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(ROLES[k])}</option>`).join("")}</select>
    <small>${t("صلاحية GIS تعطي تحكماً كاملاً بالتطبيق، امنحها لموظفي القسم فقط.")}</small>
  </label>`;

// تحديث اسم الشركة في طلباتها بعد تعديل الاسم
async function syncCompanyName(uid, orgName) {
  const mine = requests.filter(r => r.companyId === uid && r.companyName !== orgName);
  for (let i = 0; i < mine.length; i += 400) {
    const batch = F.writeBatch(db);
    mine.slice(i, i + 400).forEach(r => batch.update(F.doc(db, "requests", r.id), { companyName: orgName }));
    await batch.commit();
  }
}

$("#users").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const u = users.find(x => x.id === b.dataset.id); if (!u) return;
  const uref = F.doc(db, "users", u.id);
  const label = u.orgName || u.name || u.email;
  const act = b.dataset.act;

  if (act === "approve") {
    await modal({
      title: t("قبول {name}", { name: label }), success: true, confirmText: t("قبول وتفعيل"),
      body: `<p style="margin-bottom:12px">${t("طلب التسجيل كـ {role}.", { role: esc(ROLES[u.role] || u.role) })}</p>${roleSelect(u.role)}`,
      onConfirm: async bd => {
        const role = $("#roleSel", bd).value;
        await F.updateDoc(uref, { status: "approved", role, approvedAt: F.serverTimestamp(), approvedBy: profile.id, rejectReason: F.deleteField() });
        await notify({ toUid: u.id, title: "تم تفعيل حسابك", body: "مرحباً بك في المنصة كـ {role}", bp: { role: ROLE_KEYS[role] }, link: "index.html" });
        await logActivity(profile, "user_approved", { targetId: u.id, targetName: label, note: ROLE_KEYS[role] });
        toast(t("تم تفعيل الحساب"), "success");
      }
    });
  } else if (act === "reject") {
    await askNote({
      title: t("رفض {name}", { name: label }), label: t("سبب الرفض (سيظهر لصاحب الحساب)"), danger: true, confirmText: t("رفض"),
      onConfirm: async note => { await F.updateDoc(uref, { status: "rejected", rejectReason: note }); await logActivity(profile, "user_rejected", { targetId: u.id, targetName: label, note }); toast(t("تم رفض الحساب"), "success"); }
    });
  } else if (act === "edit") {
    const self = u.id === profile.id;
    let editAv;
    await modal({
      title: t("تعديل الحساب"), confirmText: t("حفظ"),
      onOpen: bd => { editAv = avatarPicker($("#eAv", bd), u); },
      body: `
        <div id="eAv"></div>
        <label class="field"><span>${u.role === "company" ? t("اسم الشركة") : t("اسم القسم / الفريق")} <i class="req">*</i></span><input id="eOrg" value="${esc(u.orgName || "")}"></label>
        <div class="row2">
          <label class="field"><span>${t("اسم المسؤول")}</span><input id="eName" value="${esc(u.name || "")}"></label>
          <label class="field"><span>${t("رقم الهاتف")}</span><input id="ePhone" type="tel" value="${esc(u.phone || "")}"></label>
        </div>
        <label class="field"><span>${t("البريد الإلكتروني")}</span><input value="${esc(u.email || "")}" disabled><small>${t("لا يمكن تغيير البريد لأنه مرتبط بتسجيل الدخول.")}</small></label>
        ${roleSelect(u.role, self)}`,
      onConfirm: async bd => {
        const orgName = $("#eOrg", bd).value.trim();
        if (!orgName) { toast(t("أكمل الحقول المطلوبة"), "error"); return false; }
        const data = { orgName, name: $("#eName", bd).value.trim(), phone: $("#ePhone", bd).value.trim(), ...(await avatarChanges(u.id, editAv, u)) };
        if (!self) {
          const role = $("#roleSel", bd).value;
          if (role !== u.role) {
            if (role === "gis" && !confirm(t("سيحصل \"{name}\" على صلاحيات GIS كاملة. متأكد؟", { name: orgName }))) return false;
            data.role = role;
          }
        }
        await F.updateDoc(uref, data);
        if ((data.role || u.role) === "company" && orgName !== u.orgName) await syncCompanyName(u.id, orgName);
        await logActivity(profile, data.role ? "user_role" : "user_edited", { targetId: u.id, targetName: orgName, note: data.role ? ROLE_KEYS[data.role] : "" });
        toast(t("تم حفظ التعديلات"), "success");
      }
    });
  } else if (act === "delete") {
    const reqCount = requests.filter(r => r.companyId === u.id).length;
    await modal({
      title: t("حذف الحساب"), danger: true, confirmText: t("حذف نهائي"),
      body: `<p>${t("سيتم حذف حساب <b>{name}</b> من التطبيق ولن يتمكن من الدخول.", { name: esc(label) })}</p>
        ${reqCount ? `<div class="alert info" style="margin-top:12px">${icon("alert")}<div><p>${t("طلبات هذه الشركة ({n}) ستبقى محفوظة في النظام.", { n: reqCount })}</p></div></div>` : ""}
        <p class="muted" style="font-size:13px;margin-top:10px">${t("لحذف بيانات الدخول نهائياً: Firebase Console ← Authentication ← Users.")}</p>`,
      onConfirm: async () => {
        await F.deleteDoc(uref);
        await logActivity(profile, "user_deleted", { targetId: u.id, targetName: label, note: u.email || "" });
        toast(t("تم حذف الحساب"), "success");
      }
    });
  } else if (act === "disable") {
    await modal({
      title: t("إيقاف الحساب"), danger: true, confirmText: t("إيقاف"),
      body: `<p>${t("لن يتمكن <b>{name}</b> من الدخول للتطبيق حتى تعيد تفعيله.", { name: esc(label) })}</p>`,
      onConfirm: async () => { await F.updateDoc(uref, { status: "disabled" }); await logActivity(profile, "user_disabled", { targetId: u.id, targetName: label }); toast(t("تم إيقاف الحساب"), "success"); }
    });
  } else if (act === "enable") {
    try {
      await F.updateDoc(uref, { status: "approved", rejectReason: F.deleteField() });
      await logActivity(profile, "user_enabled", { targetId: u.id, targetName: label });
      toast(t("تم تفعيل الحساب"), "success");
    } catch (err) { toast(errMsg(err), "error"); }
  }
});

F.onSnapshot(F.collection(db, "users"), snap => {
  users = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc);
  renderUsers();
  renderActivity();
}, e => toast(errMsg(e), "error"));

/* ---------- الإعدادات ---------- */
const settingsRef = F.doc(db, "settings", "app");
let types = [];
function renderTypes() {
  $("#types").innerHTML = types.map((v, i) => `<li>${esc(t(v))}<button class="icon-btn sm danger" data-rm="${i}" aria-label="${t("حذف")}">${icon("trash")}</button></li>`).join("")
    || `<li class="muted">${t("لا توجد أنواع")}</li>`;
}
async function saveTypes() {
  try { await F.setDoc(settingsRef, { requestTypes: types }, { merge: true }); await logActivity(profile, "types_changed", { kind: "settings", note: types.join("، ") }); toast(t("تم الحفظ"), "success"); }
  catch (e) { toast(errMsg(e), "error"); }
}
$("#types").addEventListener("click", e => {
  const b = e.target.closest("[data-rm]"); if (!b) return;
  types.splice(+b.dataset.rm, 1); renderTypes(); saveTypes();
});
$("#addType").addEventListener("submit", e => {
  e.preventDefault();
  const v = e.target.t.value.trim();
  if (!v || types.includes(v)) return;
  types.push(v); e.target.reset(); renderTypes(); saveTypes();
});
F.onSnapshot(settingsRef, s => {
  types = s.exists() && s.data().requestTypes ? [...s.data().requestTypes] : [...DEFAULT_TYPES];
  renderTypes();
}, () => { types = [...DEFAULT_TYPES]; renderTypes(); });

/* ---------- سجل النشاط ---------- */
$("#actSearchIc").outerHTML = icon("search");
$("#actExport").innerHTML = `${icon("download")} ${t("تصدير Excel")}`;
const AFILTERS = { all: t("الكل"), request: t("الطلبات"), account: t("الحسابات والإعدادات") };
let afilter = "all", aquery = "", aperiod = 30, alimit = 80;
const roleClass = { company: "company", maintenance: "maintenance", gis: "gis" };

// يجمع: سجل كل طلب + تسجيلات الحسابات + أحداث GIS على الحسابات والإعدادات
function activityItems() {
  const items = [];
  for (const r of requests) for (const h of (r.history || [])) {
    items.push({ kind: "request", action: h.action, label: t(HISTORY_LABELS[h.action] || h.action), note: h.note || "", byName: h.byName, role: h.role, at: h.at, reqId: r.id, reqNo: r.number });
  }
  for (const u of users) if (u.createdAt) {
    items.push({ kind: "account", action: "user_registered", label: t(ACTIVITY_LABELS.user_registered), note: ROLES[u.role] || "", byName: u.orgName || u.name || u.email, role: u.role, at: u.createdAt });
  }
  for (const a of activity) {
    items.push({ kind: a.kind === "request" ? "request" : "account", action: a.action, label: t(ACTIVITY_LABELS[a.action] || a.action, { target: a.targetName }), note: a.note ? t(a.note) : "", byName: a.byName, role: a.role, at: a.at });
  }
  return items.map(i => ({ ...i, time: toDate(i.at)?.getTime() || Date.now() })).sort((a, b) => b.time - a.time);
}
function filteredActivity() {
  const from = aperiod ? Date.now() - aperiod * 86400000 : 0;
  const q = aquery.trim().toLowerCase().replace(/^#/, "");
  return activityItems().filter(i =>
    i.time >= from &&
    (afilter === "all" || i.kind === afilter) &&
    (!q || [i.byName, i.label, i.note, i.reqNo].some(v => String(v ?? "").toLowerCase().includes(q))));
}
function renderActivity() {
  if (!$("#actList")) return;
  const all = filteredActivity();
  const count = k => all.length && k === "all" ? all.length : all.filter(i => i.kind === k).length;
  $("#actFilters").innerHTML = Object.entries(AFILTERS).map(([k, l]) =>
    `<button class="tab ${k === afilter ? "active" : ""}" data-af="${k}">${l}</button>`).join("");
  $$("[data-af]").forEach(b => b.onclick = () => { afilter = b.dataset.af; alimit = 80; renderActivity(); });
  const list = all.slice(0, alimit);
  let lastDay = "";
  $("#actList").innerHTML = list.length ? list.map(i => {
    const day = fmtDate(i.at);
    const head = day !== lastDay ? `<li class="act-day">${esc(day)}</li>` : "";
    lastDay = day;
    return head + `
      <li class="act-item">
        <span class="act-dot ${roleClass[i.role] || ""}">${icon(i.kind === "request" ? "file" : "users")}</span>
        <div class="act-body">
          <div class="act-line"><strong>${esc(i.label)}</strong>${i.reqId ? ` <a href="request.html?id=${encodeURIComponent(i.reqId)}">${esc(t("طلب #{n}", { n: i.reqNo }))}</a>` : ""}</div>
          <small><bdi>${esc(i.byName || "")}</bdi>${i.role ? ` · ${esc(ROLES[i.role] || i.role)}` : ""} · <bdi>${esc(fmtDateTime(i.at).split(/,|،/).pop().trim())}</bdi></small>
          ${i.note ? `<p>${esc(i.note)}</p>` : ""}
        </div>
      </li>`;
  }).join("") : `<li>${emptyState(t("لا يوجد نشاط في هذه الفترة"))}</li>`;
  $("#actMore").hidden = all.length <= alimit;
}
$("#actSearch").addEventListener("input", e => { aquery = e.target.value; alimit = 80; renderActivity(); });
$("#actPeriod").addEventListener("change", e => { aperiod = +e.target.value; alimit = 80; renderActivity(); });
$("#actMore").addEventListener("click", () => { alimit += 80; renderActivity(); });
$("#actExport").addEventListener("click", () => {
  const rows = filteredActivity();
  if (!rows.length) { toast(t("لا يوجد نشاط في هذه الفترة"), "info"); return; }
  const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = [t("التاريخ والوقت"), t("الحدث"), t("رقم الطلب"), t("بواسطة"), t("الصلاحية"), t("ملاحظة")];
  const csv = [head, ...rows.map(i => [fmtDateTime(i.at), i.label, i.reqNo || "", i.byName || "", ROLES[i.role] || "", i.note])]
    .map(r => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
F.onSnapshot(F.collection(db, "activity"), snap => {
  activity = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderActivity();
}, e => console.warn("activity", e));

/* ---------- الأرشفة الجماعية ---------- */
const closedSince = days => {
  const limit = Date.now() - days * 86400000;
  return requests.filter(r => !r.archived && ["approved", "rejected"].includes(r.status) &&
    (toDate(r.updatedAt || r.createdAt)?.getTime() || 0) <= limit);
};
function archHint() {
  const days = Math.max(0, +$("#archDays").value || 0);
  const n = closedSince(days).length;
  $("#archHint").textContent = t("سيتم أرشفة {n} طلب.", { n });
  $("#archBtn").disabled = !n;
}
$("#archDays").addEventListener("input", archHint);
$("#archBtn").addEventListener("click", () => {
  const days = Math.max(0, +$("#archDays").value || 0);
  const list = closedSince(days);
  if (!list.length) return;
  modal({
    title: t("أرشفة الطلبات"), confirmText: t("أرشفة"),
    body: `<p>${t("سيتم نقل {n} طلب مغلق إلى الأرشيف. تبقى كل بياناتها وملفاتها، ويمكن إخراجها من الأرشيف في أي وقت.", { n: list.length })}</p>`,
    onConfirm: async () => {
      for (let i = 0; i < list.length; i += 400) {
        const batch = F.writeBatch(db);
        list.slice(i, i + 400).forEach(r => batch.update(F.doc(db, "requests", r.id), {
          archived: true, archivedAt: F.serverTimestamp(),
          history: F.arrayUnion({ action: "archived", note: "", by: profile.id, byName: profile.orgName || profile.name || profile.email || "", role: "gis", at: F.Timestamp.now() })
        }));
        await batch.commit();
      }
      await logActivity(profile, "bulk_archive", { kind: "request", targetName: list.length });
      toast(t("تمت أرشفة {n} طلب", { n: list.length }), "success");
    }
  });
});

showTab();
