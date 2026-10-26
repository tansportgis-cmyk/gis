// لوحة GIS (مدير النظام)
import {
  db, F, $, $$, esc, icon, toast, errMsg, requireAuth, renderShell, hideBoot,
  requestCard, emptyState, byDateDesc, STATUS, ROLES, ROLE_KEYS, fmtDate, modal, askNote, notify,
  DEFAULT_TYPES, t, markCurrentPageRead, avatarPicker, avatarChanges
} from "./core.js";

const { profile } = await requireAuth(["gis"]);
renderShell(profile, { title: t("لوحة GIS"), subtitle: profile.orgName });
$("#searchIc").outerHTML = icon("search");

/* ---------- التنقل ---------- */
const TABS = { requests: [t("الطلبات"), "inbox"], accounts: [t("الحسابات"), "users"], settings: [t("الإعدادات"), "settings"] };
let tab = (location.hash.slice(1) in TABS) ? location.hash.slice(1) : "requests";
let requests = [], users = [];

function renderNav() {
  const pendingUsers = users.filter(u => u.status === "pending").length;
  const actionReqs = requests.filter(r => ["new", "gis_review"].includes(r.status)).length;
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
const FILTERS = {
  action:      { label: t("بحاجة لإجرائك"), match: r => ["new", "gis_review"].includes(r.status) },
  all:         { label: t("الكل"), match: () => true },
  ...Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, { label: v.label, match: r => r.status === k }]))
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
        toast(t("تم تفعيل الحساب"), "success");
      }
    });
  } else if (act === "reject") {
    await askNote({
      title: t("رفض {name}", { name: label }), label: t("سبب الرفض (سيظهر لصاحب الحساب)"), danger: true, confirmText: t("رفض"),
      onConfirm: async note => { await F.updateDoc(uref, { status: "rejected", rejectReason: note }); toast(t("تم رفض الحساب"), "success"); }
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
        toast(t("تم حذف الحساب"), "success");
      }
    });
  } else if (act === "disable") {
    await modal({
      title: t("إيقاف الحساب"), danger: true, confirmText: t("إيقاف"),
      body: `<p>${t("لن يتمكن <b>{name}</b> من الدخول للتطبيق حتى تعيد تفعيله.", { name: esc(label) })}</p>`,
      onConfirm: async () => { await F.updateDoc(uref, { status: "disabled" }); toast(t("تم إيقاف الحساب"), "success"); }
    });
  } else if (act === "enable") {
    await F.updateDoc(uref, { status: "approved", rejectReason: F.deleteField() }).then(() => toast(t("تم تفعيل الحساب"), "success")).catch(err => toast(errMsg(err), "error"));
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
  $("#types").innerHTML = types.map((v, i) => `<li>${esc(t(v))}<button class="icon-btn sm danger" data-rm="${i}" aria-label="${t("حذف")}">${icon("trash")}</button></li>`).join("")
    || `<li class="muted">${t("لا توجد أنواع")}</li>`;
}
async function saveTypes() {
  try { await F.setDoc(settingsRef, { requestTypes: types }, { merge: true }); toast(t("تم الحفظ"), "success"); }
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
