// لوحة GIS (مدير النظام)
import {
  db, F, $, $$, esc, icon, toast, errMsg, requireAuth, renderShell, hideBoot,
  requestCard, emptyState, byDateDesc, STATUS, ROLES, fmtDate, modal, askNote, notify,
  DEFAULT_TYPES
} from "./core.js";

const { profile } = await requireAuth(["gis"]);
renderShell(profile, { title: "لوحة GIS", subtitle: profile.orgName });
$("#searchIc").outerHTML = icon("search");

/* ---------- التنقل ---------- */
const TABS = { requests: ["الطلبات", "inbox"], accounts: ["الحسابات", "users"], settings: ["الإعدادات", "settings"] };
let tab = (location.hash.slice(1) in TABS) ? location.hash.slice(1) : "requests";
let requests = [], users = [];

function renderNav() {
  const pendingUsers = users.filter(u => u.status === "pending").length;
  const actionReqs = requests.filter(r => ["new", "gis_review"].includes(r.status)).length;
  const badge = { requests: actionReqs, accounts: pendingUsers };
  $("#nav").innerHTML = Object.entries(TABS).map(([k, [label, ic]]) =>
    `<button class="navtab ${k === tab ? "active" : ""}" data-tab="${k}">${icon(ic)} ${label}${badge[k] ? ` <span class="n">${badge[k]}</span>` : ""}</button>`).join("");
  $$("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, "", "#" + tab); showTab(); });
}
function showTab() {
  Object.keys(TABS).forEach(k => ($("#tab-" + k).hidden = k !== tab));
  renderNav();
}
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h in TABS) { tab = h; showTab(); } });

/* ---------- الطلبات ---------- */
const FILTERS = {
  action:      { label: "بحاجة لإجرائك", match: r => ["new", "gis_review"].includes(r.status) },
  all:         { label: "الكل", match: () => true },
  ...Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, { label: v.label, match: r => r.status === k }]))
};
let filter = "action", query = "";

function renderRequests() {
  const c = k => requests.filter(FILTERS[k].match).length;
  $("#stats").innerHTML = `
    <button class="stat blue" data-f="action"><b>${c("action")}</b><span>بحاجة لإجرائك</span></button>
    <button class="stat orange" data-f="gis_work"><b>${c("gis_work")}</b><span>قيد العمل في GIS</span></button>
    <button class="stat purple" data-f="maintenance"><b>${c("maintenance")}</b><span>عند الصيانة</span></button>
    <button class="stat green" data-f="approved"><b>${c("approved")}</b><span>مكتملة</span></button>`;
  $("#filters").innerHTML = Object.entries(FILTERS).map(([k, f]) =>
    `<button class="tab ${k === filter ? "active" : ""}" data-f="${k}">${f.label} <span class="n">${c(k)}</span></button>`).join("");
  const q = query.trim().toLowerCase().replace(/^#/, "");
  const list = requests.filter(FILTERS[filter].match).filter(r => !q ||
    String(r.number).includes(q) || (r.companyName || "").toLowerCase().includes(q) ||
    (r.description || "").toLowerCase().includes(q) || (r.type || "").toLowerCase().includes(q));
  $("#list").innerHTML = list.length ? list.map(r => requestCard(r)).join("")
    : emptyState(filter === "action" && !q ? "لا توجد طلبات بحاجة لإجرائك" : "لا توجد طلبات");
  $$("#stats [data-f], #filters [data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; renderRequests(); });
  renderNav();
}
$("#search").addEventListener("input", e => { query = e.target.value; renderRequests(); });

F.onSnapshot(F.query(F.collection(db, "requests"), F.orderBy("createdAt", "desc")), snap => {
  requests = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc);
  renderRequests();
  hideBoot();
}, e => { toast(errMsg(e), "error"); hideBoot(); });

/* ---------- الحسابات ---------- */
const UFILTERS = {
  pending:     { label: "بانتظار الموافقة", match: u => u.status === "pending" },
  company:     { label: "الشركات", match: u => u.status === "approved" && u.role === "company" },
  maintenance: { label: "الصيانة", match: u => u.status === "approved" && u.role === "maintenance" },
  gis:         { label: "GIS", match: u => u.status === "approved" && u.role === "gis" },
  inactive:    { label: "مرفوض / موقوف", match: u => ["rejected", "disabled"].includes(u.status) }
};
let ufilter = null;
const roleIcon = { company: "building", maintenance: "wrench", gis: "layers" };
const ST_U = { pending: ["بانتظار الموافقة", "st-warn"], approved: ["مفعّل", "st-done"], rejected: ["مرفوض", "st-rejected"], disabled: ["موقوف", "st-muted"] };

function renderUsers() {
  if (!ufilter) ufilter = users.some(u => u.status === "pending") ? "pending" : "company";
  const c = k => users.filter(UFILTERS[k].match).length;
  $("#userFilters").innerHTML = Object.entries(UFILTERS).map(([k, f]) =>
    `<button class="tab ${k === ufilter ? "active" : ""}" data-uf="${k}">${f.label} <span class="n">${c(k)}</span></button>`).join("");
  $$("[data-uf]").forEach(b => b.onclick = () => { ufilter = b.dataset.uf; renderUsers(); });
  const list = users.filter(UFILTERS[ufilter].match);
  $("#users").innerHTML = list.length ? list.map(u => {
    const st = ST_U[u.status] || [u.status, ""];
    const self = u.id === profile.id;
    let actions = "";
    if (u.status === "pending") actions = `
      <button class="btn btn-success btn-sm" data-act="approve" data-id="${u.id}">${icon("check")} قبول</button>
      <button class="btn btn-outline-danger btn-sm" data-act="reject" data-id="${u.id}">${icon("x")} رفض</button>`;
    else if (u.status === "approved" && !self) actions = `
      <button class="btn btn-ghost btn-sm" data-act="role" data-id="${u.id}">تغيير الصلاحية</button>
      <button class="btn btn-outline-danger btn-sm" data-act="disable" data-id="${u.id}">${icon("ban")} إيقاف</button>`;
    else if (!self) actions = `<button class="btn btn-outline btn-sm" data-act="enable" data-id="${u.id}">${icon("check")} تفعيل</button>`;
    return `
      <div class="user-card">
        <div class="user-av ${esc(u.role)}">${icon(roleIcon[u.role] || "users")}</div>
        <div class="user-info">
          <div class="top"><strong>${esc(u.orgName || u.name)}</strong><span class="chip ${st[1]}">${st[0]}</span>${self ? `<span class="chip st-new">أنت</span>` : ""}</div>
          <small>${esc(ROLES[u.role] || u.role)} · ${esc(u.name)}</small>
          <small dir="ltr" style="text-align:right">${esc(u.email)}${u.phone ? " · " + esc(u.phone) : ""}</small>
          <small>تاريخ التسجيل: ${esc(fmtDate(u.createdAt))}</small>
          ${u.rejectReason && u.status === "rejected" ? `<small style="color:var(--danger)">سبب الرفض: ${esc(u.rejectReason)}</small>` : ""}
          ${actions ? `<div class="user-actions">${actions}</div>` : ""}
        </div>
      </div>`;
  }).join("") : emptyState("لا توجد حسابات");
  renderNav();
}

const roleSelect = cur => `
  <label class="field"><span>الصلاحية</span>
    <select id="roleSel">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${v}</option>`).join("")}</select>
    <small>صلاحية GIS تعطي تحكماً كاملاً بالتطبيق، امنحها لموظفي القسم فقط.</small>
  </label>`;

$("#users").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const u = users.find(x => x.id === b.dataset.id); if (!u) return;
  const uref = F.doc(db, "users", u.id);
  const act = b.dataset.act;
  if (act === "approve") {
    await modal({
      title: `قبول ${u.orgName}`, success: true, confirmText: "قبول وتفعيل",
      body: `<p style="margin-bottom:12px">طلب التسجيل كـ <b>${esc(ROLES[u.role])}</b>.</p>${roleSelect(u.role)}`,
      onConfirm: async bd => {
        const role = $("#roleSel", bd).value;
        await F.updateDoc(uref, { status: "approved", role, approvedAt: F.serverTimestamp(), approvedBy: profile.id, rejectReason: F.deleteField() });
        await notify({ toUid: u.id, title: "تم تفعيل حسابك", body: `مرحباً بك في المنصة كـ ${ROLES[role]}`, link: "index.html" });
        toast("تم تفعيل الحساب", "success");
      }
    });
  } else if (act === "reject") {
    await askNote({
      title: `رفض ${u.orgName}`, label: "سبب الرفض (سيظهر لصاحب الحساب)", danger: true, confirmText: "رفض",
      onConfirm: async note => { await F.updateDoc(uref, { status: "rejected", rejectReason: note }); toast("تم رفض الحساب", "success"); }
    });
  } else if (act === "role") {
    await modal({
      title: `صلاحية ${u.orgName}`, confirmText: "حفظ", body: roleSelect(u.role),
      onConfirm: async bd => {
        const role = $("#roleSel", bd).value;
        if (role === u.role) return;
        if (role === "gis" && !confirm(`سيحصل "${u.orgName}" على صلاحيات GIS كاملة. متأكد؟`)) return false;
        await F.updateDoc(uref, { role });
        toast("تم تغيير الصلاحية", "success");
      }
    });
  } else if (act === "disable") {
    await modal({
      title: "إيقاف الحساب", danger: true, confirmText: "إيقاف",
      body: `<p>لن يتمكن <b>${esc(u.orgName)}</b> من الدخول للتطبيق حتى تعيد تفعيله.</p>`,
      onConfirm: async () => { await F.updateDoc(uref, { status: "disabled" }); toast("تم إيقاف الحساب", "success"); }
    });
  } else if (act === "enable") {
    await F.updateDoc(uref, { status: "approved", rejectReason: F.deleteField() }).then(() => toast("تم تفعيل الحساب", "success")).catch(e => toast(errMsg(e), "error"));
  }
});

F.onSnapshot(F.collection(db, "users"), snap => {
  users = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc);
  renderUsers();
}, e => toast(errMsg(e), "error"));

/* ---------- الإعدادات ---------- */
const settingsRef = F.doc(db, "settings", "app");
let types = [];
function renderTypes() {
  $("#types").innerHTML = types.map((t, i) => `<li>${esc(t)}<button class="icon-btn sm danger" data-rm="${i}" aria-label="حذف">${icon("trash")}</button></li>`).join("")
    || `<li class="muted">لا توجد أنواع</li>`;
}
async function saveTypes() {
  try { await F.setDoc(settingsRef, { requestTypes: types }, { merge: true }); toast("تم الحفظ", "success"); }
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

showTab();
