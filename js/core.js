// ==========================================================
//  core.js — الأساسيات المشتركة بين كل الصفحات
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as A from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as F from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as S from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig, APP } from "./firebase-config.js";

export { A, F, S, APP };

export const app = initializeApp(firebaseConfig);
export const auth = A.getAuth(app);
// تجاهل أي حقل قيمته undefined بدل ما يسبب خطأ
export const db = F.initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = S.getStorage(app);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ---------------- أدوات عامة ---------------- */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const ROLES = {
  company: "شركة",
  maintenance: "قسم الصيانة",
  gis: "GIS (مدير النظام)"
};

export const STATUS = {
  new:         { label: "جديد",            cls: "st-new" },
  needs_info:  { label: "مطلوب استكمال",   cls: "st-warn" },
  gis_work:    { label: "قيد العمل في GIS", cls: "st-gis" },
  maintenance: { label: "عند الصيانة",      cls: "st-maint" },
  gis_review:  { label: "مراجعة GIS",       cls: "st-review" },
  approved:    { label: "مكتمل",            cls: "st-done" },
  rejected:    { label: "مرفوض",            cls: "st-rejected" }
};

export const HISTORY_LABELS = {
  created:        "تم تقديم الطلب",
  resubmitted:    "أعادت الشركة إرسال الطلب بعد الاستكمال",
  edited:         "عدّلت الشركة بيانات الطلب",
  needs_info:     "GIS طلب استكمال من الشركة",
  accepted:       "GIS قبل الطلب وبدأ العمل",
  sent_maint:     "تم إرسال الطلب لقسم الصيانة",
  maint_done:     "أنهت الصيانة العمل وأرجعته لـ GIS",
  returned_maint: "GIS أرجع الطلب للصيانة للتعديل",
  approved:       "تم اعتماد الطلب وإرساله للشركة",
  rejected:       "تم رفض الطلب",
  reopened:       "أعاد GIS فتح الطلب",
  files_gis:      "رفع GIS ملفات",
  files_maint:    "رفعت الصيانة ملفات"
};
// الأحداث التي تظهر للشركة في السجل
export const COMPANY_VISIBLE_HISTORY = ["created", "resubmitted", "edited", "needs_info", "accepted", "approved", "rejected"];

export const DEFAULT_TYPES = ["أعمال GIS", "أعمال ميدانية", "تحديث بيانات", "رفع مخطط", "أخرى"];

// الشركة ترى المراحل الداخلية كـ "قيد المعالجة"
const COMPANY_INTERNAL = ["gis_work", "maintenance", "gis_review"];
export function chip(status, forCompany = false) {
  const s = forCompany && COMPANY_INTERNAL.includes(status)
    ? { label: "قيد المعالجة", cls: "st-gis" }
    : (STATUS[status] || { label: status, cls: "" });
  return `<span class="chip ${s.cls}">${esc(s.label)}</span>`;
}

export function homeFor(role) {
  return { company: "company.html", maintenance: "maintenance.html", gis: "gis.html" }[role] || "index.html";
}

/* ---------------- التواريخ والأحجام ---------------- */
export function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}
const dFmt = new Intl.DateTimeFormat("ar-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" });
const dtFmt = new Intl.DateTimeFormat("ar-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtDate = ts => { const d = toDate(ts); return d ? dFmt.format(d) : "—"; };
export const fmtDateTime = ts => { const d = toDate(ts); return d ? dtFmt.format(d) : "—"; };
export function timeAgo(ts) {
  const d = toDate(ts);
  if (!d) return "الآن";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 86400 * 7) return `منذ ${Math.floor(s / 86400)} يوم`;
  return fmtDate(ts);
}
export function fmtSize(b) {
  if (!b && b !== 0) return "";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
export const byDateDesc = (a, b) => (toDate(b.createdAt)?.getTime() || Date.now()) - (toDate(a.createdAt)?.getTime() || Date.now());

/* ---------------- الأيقونات ---------------- */
const P = {
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  back: '<path d="m9 18 6-6-6-6"/>',
  chevron: '<path d="m15 18-6-6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>'
};
export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

/* ---------------- رسائل الخطأ ---------------- */
export function errMsg(e) {
  const c = e?.code || "";
  const map = {
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة",
    "auth/wrong-password": "البريد أو كلمة المرور غير صحيحة",
    "auth/user-not-found": "البريد أو كلمة المرور غير صحيحة",
    "auth/invalid-email": "البريد الإلكتروني غير صحيح",
    "auth/email-already-in-use": "هذا البريد مسجل مسبقاً",
    "auth/weak-password": "كلمة المرور ضعيفة (6 أحرف على الأقل)",
    "auth/too-many-requests": "محاولات كثيرة، حاول بعد قليل",
    "auth/network-request-failed": "تحقق من اتصال الإنترنت",
    "permission-denied": "ليس لديك صلاحية لهذا الإجراء",
    "storage/unauthorized": "ليس لديك صلاحية لهذا الملف",
    "storage/object-not-found": "الملف غير موجود",
    "storage/canceled": "تم إلغاء الرفع",
    "storage/quota-exceeded": "تم تجاوز مساحة التخزين",
    "unavailable": "تعذر الاتصال بالخادم، تحقق من الإنترنت",
    "not-found": "العنصر غير موجود"
  };
  return map[c] || e?.message || "حدث خطأ غير متوقع";
}

/* ---------------- الإشعارات المنبثقة (Toast) ---------------- */
export function toast(msg, type = "info", ms = 3400) {
  let wrap = $("#toasts");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "toasts"; document.body.append(wrap); }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  wrap.append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
}

export function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle("is-busy", on);
}

/* شريط تقدم الرفع */
export function progressBar(label = "جارٍ الرفع…") {
  const el = document.createElement("div");
  el.className = "upload-progress";
  el.innerHTML = `<div class="up-label">${esc(label)} <b>0%</b></div><div class="up-track"><div class="up-fill"></div></div>`;
  document.body.append(el);
  return {
    set(p) { const v = Math.round(p * 100); el.querySelector("b").textContent = v + "%"; el.querySelector(".up-fill").style.width = v + "%"; },
    done() { el.remove(); }
  };
}

/* ---------------- النوافذ (Modal) ---------------- */
export function modal({ title, body = "", confirmText = "تأكيد", cancelText = "إلغاء", danger = false, success = false, onConfirm, onOpen, wide = false }) {
  return new Promise(resolve => {
    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    const okCls = danger ? "btn-danger" : success ? "btn-success" : "btn-primary";
    bd.innerHTML = `
      <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="إغلاق">${icon("x")}</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn ${okCls}" data-ok>${esc(confirmText)}</button>
          <button class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
        </div>
      </div>`;
    document.body.append(bd);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => bd.classList.add("show"));
    let closed = false;
    const close = v => {
      if (closed) return; closed = true;
      bd.classList.remove("show");
      document.body.classList.remove("no-scroll");
      setTimeout(() => bd.remove(), 200);
      resolve(v);
    };
    bd.addEventListener("click", e => {
      if (e.target === bd || e.target.closest("[data-x],[data-cancel]")) {
        if (!bd.querySelector("[data-ok]").disabled) close(null);
      }
    });
    const ok = bd.querySelector("[data-ok]");
    ok.addEventListener("click", async () => {
      try {
        busy(ok, true);
        const v = onConfirm ? await onConfirm(bd) : true;
        if (v === false) { busy(ok, false); return; }
        close(v === undefined ? true : v);
      } catch (e) {
        console.error(e);
        busy(ok, false);
        toast(errMsg(e), "error");
      }
    });
    onOpen?.(bd);
    setTimeout(() => bd.querySelector("textarea, input, select")?.focus(), 150);
  });
}

export function askNote({ title, label, placeholder = "", required = true, confirmText = "تأكيد", danger = false, success = false, onConfirm }) {
  return modal({
    title, confirmText, danger, success,
    body: `<label class="field"><span>${esc(label)}${required ? ' <i class="req">*</i>' : ""}</span><textarea rows="4" placeholder="${esc(placeholder)}"></textarea></label>`,
    onConfirm: async bd => {
      const v = bd.querySelector("textarea").value.trim();
      if (required && !v) { toast("الرجاء كتابة الملاحظة", "error"); return false; }
      if (onConfirm) await onConfirm(v);
      return v;
    }
  });
}

/* ---------------- المصادقة وحماية الصفحات ---------------- */
export function requireAuth(roles) {
  return new Promise(resolve => {
    const unsub = A.onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { location.replace("index.html"); return; }
      try {
        const snap = await F.getDoc(F.doc(db, "users", user.uid));
        const p = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        if (!p || p.status !== "approved") { location.replace("index.html"); return; }
        if (roles && !roles.includes(p.role)) { location.replace(homeFor(p.role)); return; }
        // لو تم إيقاف الحساب أثناء الاستخدام
        F.onSnapshot(F.doc(db, "users", user.uid), s => {
          const d = s.data();
          if (!d || d.status !== "approved" || (roles && !roles.includes(d.role))) location.replace("index.html");
        }, () => {});
        resolve({ user, profile: p });
      } catch (e) {
        console.error(e);
        document.body.innerHTML = `<div class="fatal">${icon("alert")}<h2>تعذر تحميل الحساب</h2><p>${esc(errMsg(e))}</p><a class="btn btn-primary" href="index.html">العودة</a></div>`;
      }
    });
  });
}

export async function logout() {
  await A.signOut(auth);
  location.replace("index.html");
}

export function hideBoot() {
  $("#boot")?.remove();
  const m = $("#main"); if (m) m.hidden = false;
}

/* ---------------- الشريط العلوي ---------------- */
export function renderShell(profile, { title, subtitle = "", back = "" } = {}) {
  const initials = (profile.orgName || profile.name || "؟").trim().slice(0, 1);
  $("#topbar").innerHTML = `
    <div class="topbar-inner">
      <div class="tb-start">
        ${back ? `<a class="icon-btn" href="${esc(back)}" aria-label="رجوع">${icon("back")}</a>` : `<div class="brand-mark">${icon("layers")}</div>`}
        <div class="tb-title"><strong>${esc(title)}</strong>${subtitle ? `<small>${esc(subtitle)}</small>` : ""}</div>
      </div>
      <div class="tb-end">
        <div class="pop-wrap">
          <button class="icon-btn" id="bellBtn" aria-label="الإشعارات">${icon("bell")}<span class="badge-dot" id="bellCount" hidden></span></button>
          <div class="dropdown bell-panel" id="bellPanel" hidden></div>
        </div>
        <div class="pop-wrap">
          <button class="avatar" id="userBtn" aria-label="الحساب">${esc(initials)}</button>
          <div class="dropdown user-menu" id="userMenu" hidden>
            <div class="um-head"><strong>${esc(profile.orgName || profile.name)}</strong><small>${esc(profile.name)}</small><small>${esc(profile.email)}</small><span class="chip st-new">${esc(ROLES[profile.role] || profile.role)}</span></div>
            <button class="um-item" id="logoutBtn">${icon("logout")} تسجيل الخروج</button>
          </div>
        </div>
      </div>
    </div>`;
  const toggle = (btnId, panelId) => {
    $(btnId).addEventListener("click", e => {
      e.stopPropagation();
      const p = $(panelId);
      const willOpen = p.hidden;
      $$(".dropdown").forEach(d => d.hidden = true);
      p.hidden = !willOpen;
    });
  };
  toggle("#bellBtn", "#bellPanel");
  toggle("#userBtn", "#userMenu");
  document.addEventListener("click", e => { if (!e.target.closest(".dropdown")) $$(".dropdown").forEach(d => d.hidden = true); });
  $("#logoutBtn").addEventListener("click", logout);
  initBell(profile);
}

/* ---------------- نظام الإشعارات ---------------- */
export async function notify({ toUid = null, toRole = null, title, body = "", link = "" }) {
  try {
    await F.addDoc(F.collection(db, "notifications"), {
      toUid, toRole, title, body, link,
      from: auth.currentUser?.uid || null,
      readBy: [],
      createdAt: F.serverTimestamp()
    });
  } catch (e) { console.warn("notify failed", e); }
}

function showDeviceNotification(n) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body: n.body || "", icon: "icons/icon-192.png", tag: n.id, data: { link: n.link } };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(r => r.showNotification(n.title, opts)).catch(() => {});
  } else {
    try { new Notification(n.title, opts); } catch {}
  }
}

function initBell(profile) {
  const uid = profile.id;
  let mine = [], byRole = [];
  let firstLoad = { a: true, b: true };
  const seen = new Set();

  const render = () => {
    const all = [...mine, ...byRole].sort(byDateDesc).slice(0, 40);
    const unread = all.filter(n => !(n.readBy || []).includes(uid));
    const cnt = $("#bellCount");
    cnt.hidden = unread.length === 0;
    cnt.textContent = unread.length > 9 ? "9+" : unread.length;
    const canAsk = "Notification" in window && Notification.permission === "default";
    $("#bellPanel").innerHTML = `
      <div class="bp-head"><strong>الإشعارات</strong>${unread.length ? `<button class="link-btn" id="markAll">تحديد الكل كمقروء</button>` : ""}</div>
      ${canAsk ? `<button class="bp-enable" id="enableNotif">${icon("bell")} تفعيل تنبيهات الجهاز</button>` : ""}
      <div class="bp-list">
        ${all.length ? all.map(n => `
          <button class="bp-item ${(n.readBy || []).includes(uid) ? "" : "unread"}" data-id="${esc(n.id)}" data-link="${esc(n.link || "")}">
            <span class="bp-ic">${icon("bell")}</span>
            <span class="bp-txt"><strong>${esc(n.title)}</strong><small>${esc(n.body || "")}</small><em>${esc(timeAgo(n.createdAt))}</em></span>
          </button>`).join("") : `<div class="bp-empty">لا توجد إشعارات</div>`}
      </div>`;
    $("#markAll")?.addEventListener("click", async e => {
      e.stopPropagation();
      await Promise.all(unread.map(n => F.updateDoc(F.doc(db, "notifications", n.id), { readBy: F.arrayUnion(uid) }).catch(() => {})));
    });
    $("#enableNotif")?.addEventListener("click", async e => {
      e.stopPropagation();
      const r = await Notification.requestPermission();
      toast(r === "granted" ? "تم تفعيل التنبيهات" : "لم يتم السماح بالتنبيهات", r === "granted" ? "success" : "info");
      render();
    });
    $$(".bp-item").forEach(b => b.addEventListener("click", async () => {
      F.updateDoc(F.doc(db, "notifications", b.dataset.id), { readBy: F.arrayUnion(uid) }).catch(() => {});
      if (b.dataset.link) location.href = b.dataset.link;
    }));
  };

  const handle = (key, snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!firstLoad[key]) {
      snap.docChanges().forEach(ch => {
        const n = { id: ch.doc.id, ...ch.doc.data() };
        if (ch.type === "added" && !seen.has(n.id) && !(n.readBy || []).includes(uid) && n.from !== uid) showDeviceNotification(n);
      });
    }
    list.forEach(n => seen.add(n.id));
    firstLoad[key] = false;
    if (key === "a") mine = list; else byRole = list;
    render();
  };
  const col = F.collection(db, "notifications");
  F.onSnapshot(F.query(col, F.where("toUid", "==", uid)), s => handle("a", s), e => console.warn(e));
  F.onSnapshot(F.query(col, F.where("toRole", "==", profile.role)), s => handle("b", s), e => console.warn(e));
  render();
}

/* ---------------- السجل ---------------- */
export const hist = (p, action, note = "") => ({
  action, note,
  by: p.id, byName: p.orgName || p.name || p.email || "", role: p.role,
  at: F.Timestamp.now()
});

/* ---------------- إعدادات التطبيق ---------------- */
export async function getRequestTypes() {
  try {
    const s = await F.getDoc(F.doc(db, "settings", "app"));
    const t = s.exists() ? s.data().requestTypes : null;
    return t?.length ? t : DEFAULT_TYPES;
  } catch { return DEFAULT_TYPES; }
}

/* ---------------- الملفات ---------------- */
const safeName = n => n.replace(/[\/\\#?%*:|"<>\[\]]/g, "_");

export async function uploadFiles(rid, section, files, profile, label) {
  if (!files.length) return [];
  for (const f of files) {
    if (f.size > APP.maxFileMB * 1048576) throw new Error(`الملف "${f.name}" أكبر من ${APP.maxFileMB} ميجابايت`);
  }
  const bar = progressBar(label || `جارٍ رفع ${files.length} ملف…`);
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  let done = 0;
  const out = [];
  try {
    for (const f of files) {
      const path = `requests/${rid}/${section}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeName(f.name)}`;
      const task = S.uploadBytesResumable(S.ref(storage, path), f, { contentType: f.type || "application/octet-stream" });
      await new Promise((res, rej) => task.on("state_changed", s => bar.set((done + s.bytesTransferred) / total), rej, res));
      done += f.size;
      out.push({
        name: f.name, path, size: f.size, type: f.type || "",
        uploadedAt: F.Timestamp.now(), by: profile.id, byName: profile.orgName || profile.name || profile.email || ""
      });
    }
  } finally { bar.done(); }
  return out;
}

export async function openFile(path) {
  const w = window.open("", "_blank");
  try {
    const url = await S.getDownloadURL(S.ref(storage, path));
    if (w) w.location.href = url; else location.href = url;
  } catch (e) {
    w?.close();
    toast(errMsg(e), "error");
  }
}

const isImage = f => (f.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(f.name || "");
function fileIcon(f) {
  if (isImage(f)) return "image";
  return "file";
}
function fileExt(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toUpperCase().slice(0, 4) : ""; }

/** يعرض قائمة ملفات مرفوعة. opts: {canDelete, thumbs, selectable, checked} */
export function filesHTML(files = [], opts = {}) {
  if (!files.length) return `<div class="files-empty">${icon("file")} لا توجد ملفات</div>`;
  const imgs = opts.thumbs ? files.filter(isImage) : [];
  const others = opts.thumbs ? files.filter(f => !isImage(f)) : files;
  const thumbs = imgs.length ? `<div class="thumb-grid">${imgs.map(f => `
      <button type="button" class="thumb" data-open="${esc(f.path)}" title="${esc(f.name)}">
        <img data-thumb="${esc(f.path)}" alt="${esc(f.name)}">
        ${opts.canDelete ? `<span class="thumb-del" data-del="${esc(f.path)}" role="button" aria-label="حذف">${icon("x")}</span>` : ""}
      </button>`).join("")}</div>` : "";
  const list = others.length ? `<ul class="file-list">${others.map(f => `
      <li class="file-item">
        ${opts.selectable ? `<input type="checkbox" class="file-check" value="${esc(f.path)}" ${opts.checked !== false ? "checked" : ""}>` : ""}
        <span class="fi-ic">${icon(fileIcon(f))}<em>${esc(fileExt(f.name))}</em></span>
        <span class="fi-txt"><strong>${esc(f.name)}</strong><small><bdi>${esc(fmtSize(f.size))}</bdi>${f.byName ? ` · <bdi>${esc(f.byName)}</bdi>` : ""}${f.uploadedAt ? ` · <bdi>${esc(fmtDate(f.uploadedAt))}</bdi>` : ""}</small></span>
        <button type="button" class="icon-btn sm" data-open="${esc(f.path)}" aria-label="تنزيل">${icon("download")}</button>
        ${opts.canDelete ? `<button type="button" class="icon-btn sm danger" data-del="${esc(f.path)}" aria-label="حذف">${icon("trash")}</button>` : ""}
      </li>`).join("")}</ul>` : "";
  return thumbs + list;
}

/** يفعّل أزرار التنزيل والحذف والصور المصغرة داخل حاوية */
export function wireFiles(container, { onDelete } = {}) {
  container.addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    if (del) { e.preventDefault(); e.stopPropagation(); onDelete?.(del.dataset.del); return; }
    const op = e.target.closest("[data-open]");
    if (op) { e.preventDefault(); openFile(op.dataset.open); }
  });
}
const thumbCache = new Map();
export function hydrateThumbs(container) {
  $$("img[data-thumb]", container).forEach(async img => {
    const p = img.dataset.thumb;
    try {
      if (!thumbCache.has(p)) thumbCache.set(p, S.getDownloadURL(S.ref(storage, p)));
      img.src = await thumbCache.get(p);
    } catch { img.closest(".thumb")?.classList.add("broken"); }
  });
}

/** منتقي ملفات محلي (قبل الرفع) */
export function filePicker(el, { camera = false, label = "إرفاق ملفات", accept = "" } = {}) {
  let files = [];
  el.innerHTML = `
    <div class="dropzone">
      <input type="file" multiple hidden data-in ${accept ? `accept="${esc(accept)}"` : ""}>
      ${camera ? `<input type="file" accept="image/*" capture="environment" hidden data-cam>` : ""}
      <div class="dz-icon">${icon("upload")}</div>
      <div class="dz-actions">
        <button type="button" class="btn btn-outline btn-sm" data-pick>${icon("file")} ${esc(label)}</button>
        ${camera ? `<button type="button" class="btn btn-outline btn-sm" data-campick>${icon("camera")} تصوير</button>` : ""}
      </div>
      <small class="muted">أو اسحب الملفات هنا · الحد الأقصى ${APP.maxFileMB} ميجابايت للملف</small>
    </div>
    <ul class="file-list" data-list></ul>`;
  const list = $("[data-list]", el);
  const render = () => {
    list.innerHTML = files.map((f, i) => `
      <li class="file-item">
        <span class="fi-ic">${icon(fileIcon(f))}<em>${esc(fileExt(f.name))}</em></span>
        <span class="fi-txt"><strong>${esc(f.name)}</strong><small><bdi>${esc(fmtSize(f.size))}</bdi></small></span>
        <button type="button" class="icon-btn sm" data-rm="${i}" aria-label="إزالة">${icon("x")}</button>
      </li>`).join("");
  };
  const add = fl => {
    for (const f of fl) {
      if (f.size > APP.maxFileMB * 1048576) { toast(`"${f.name}" أكبر من ${APP.maxFileMB} ميجابايت`, "error"); continue; }
      files.push(f);
    }
    render();
  };
  $("[data-pick]", el).onclick = () => $("[data-in]", el).click();
  $("[data-in]", el).onchange = e => { add(e.target.files); e.target.value = ""; };
  if (camera) {
    $("[data-campick]", el).onclick = () => $("[data-cam]", el).click();
    $("[data-cam]", el).onchange = e => { add(e.target.files); e.target.value = ""; };
  }
  list.addEventListener("click", e => {
    const b = e.target.closest("[data-rm]");
    if (b) { files.splice(+b.dataset.rm, 1); render(); }
  });
  const dz = $(".dropzone", el);
  ["dragenter", "dragover"].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", e => add(e.dataTransfer.files));
  return { get files() { return files; }, clear() { files = []; render(); } };
}

/* ---------------- الخرائط (Leaflet + OpenStreetMap) ---------------- */
const pinIcon = () => window.L.divIcon({ className: "map-pin", html: '<span></span>', iconSize: [28, 38], iconAnchor: [14, 38] });
const tiles = map => window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

export function pickerMap(el, initial, onChange) {
  const L = window.L;
  const map = L.map(el).setView(initial ? [initial.lat, initial.lng] : APP.mapCenter, initial ? 15 : APP.mapZoom);
  tiles(map);
  let marker = null;
  const emit = ll => onChange?.({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
  const set = ll => {
    if (!marker) {
      marker = L.marker(ll, { icon: pinIcon(), draggable: true }).addTo(map);
      marker.on("dragend", () => emit(marker.getLatLng()));
    } else marker.setLatLng(ll);
    emit(ll);
  };
  if (initial) set(L.latLng(initial.lat, initial.lng));
  map.on("click", e => set(e.latlng));
  return {
    map,
    locate() {
      if (!navigator.geolocation) { toast("المتصفح لا يدعم تحديد الموقع", "error"); return; }
      navigator.geolocation.getCurrentPosition(
        p => { const ll = L.latLng(p.coords.latitude, p.coords.longitude); map.setView(ll, 16); set(ll); },
        () => toast("تعذر تحديد موقعك، اسمح بالوصول للموقع", "error"),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    },
    clear() { if (marker) { map.removeLayer(marker); marker = null; onChange?.(null); } }
  };
}

export function viewMap(el, loc) {
  const L = window.L;
  const map = L.map(el, { scrollWheelZoom: false }).setView([loc.lat, loc.lng], 16);
  tiles(map);
  L.marker([loc.lat, loc.lng], { icon: pinIcon() }).addTo(map);
  return map;
}
export const gmapsLink = loc => `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

/* ---------------- بطاقة طلب في القائمة ---------------- */
export function requestCard(r, { showCompany = true, forCompany = false } = {}) {
  return `
    <a class="req-card" href="request.html?id=${encodeURIComponent(r.id)}">
      <div class="req-icon">${icon(r.location ? "pin" : "file")}</div>
      <div class="req-body">
        <div class="req-top"><strong>طلب #${esc(r.number)}</strong>${chip(r.status, forCompany)}</div>
        <div class="req-type">${esc(r.type)}</div>
        <p class="req-desc">${esc(r.description)}</p>
        <div class="req-meta">
          ${showCompany ? `<span>${icon("building")} ${esc(r.companyName)}</span>` : ""}
          <span>${icon("clock")} ${esc(fmtDate(r.createdAt))}</span>
        </div>
      </div>
      <span class="req-go">${icon("chevron")}</span>
    </a>`;
}

export function emptyState(text, sub = "") {
  return `<div class="empty">${icon("inbox")}<strong>${esc(text)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
}
