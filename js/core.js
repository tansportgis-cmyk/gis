// ==========================================================
//  core.js — الأساسيات المشتركة بين كل الصفحات
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as A from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as F from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as S from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig, APP } from "./firebase-config.js";
import { t, lang, isEn, setLang, applyI18n } from "./i18n.js";

export { A, F, S, APP, t, lang, isEn, setLang, applyI18n };

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

// القيم المخزنة بالعربي، والعرض يُترجم عبر t()
export const ROLE_KEYS = {
  company: "شركة",
  maintenance: "قسم الصيانة",
  gis: "GIS (مدير النظام)"
};
export const ROLES = new Proxy(ROLE_KEYS, { get: (o, k) => (k in o ? t(o[k]) : undefined) });

const STATUS_KEYS = {
  new:         { label: "جديد",            cls: "st-new" },
  needs_info:  { label: "مطلوب استكمال",   cls: "st-warn" },
  gis_work:    { label: "قيد العمل في GIS", cls: "st-gis" },
  maintenance: { label: "عند الصيانة",      cls: "st-maint" },
  gis_review:  { label: "مراجعة GIS",       cls: "st-review" },
  approved:    { label: "مكتمل",            cls: "st-done" },
  rejected:    { label: "مرفوض",            cls: "st-rejected" }
};
export const STATUS = Object.fromEntries(Object.entries(STATUS_KEYS).map(([k, v]) => [k, { ...v, label: t(v.label) }]));

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
    ? { label: t("قيد المعالجة"), cls: "st-gis" }
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
const LOCALE = isEn ? "en-GB" : "ar-u-nu-latn";
const dFmt = new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "2-digit", day: "2-digit" });
const dtFmt = new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtDate = ts => { const d = toDate(ts); return d ? dFmt.format(d) : "—"; };
export const fmtDateTime = ts => { const d = toDate(ts); return d ? dtFmt.format(d) : "—"; };
export function timeAgo(ts) {
  const d = toDate(ts);
  if (!d) return t("الآن");
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return t("الآن");
  if (s < 3600) return t("منذ {n} دقيقة", { n: Math.floor(s / 60) });
  if (s < 86400) return t("منذ {n} ساعة", { n: Math.floor(s / 3600) });
  if (s < 86400 * 7) return t("منذ {n} يوم", { n: Math.floor(s / 86400) });
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
  edit: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.63a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
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
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>'
};
export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

/* ---------------- زر تغيير اللغة ---------------- */
export function langButtonHTML(cls = "lang-btn") {
  return `<button type="button" class="${cls}" data-lang-toggle aria-label="${isEn ? "العربية" : "English"}">${icon("globe")}<span>${isEn ? "عربي" : "EN"}</span></button>`;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-lang-toggle]")) setLang(isEn ? "ar" : "en");
});

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
  return map[c] ? t(map[c]) : (e?.message || t("حدث خطأ غير متوقع"));
}

/* ---------------- الإشعارات المنبثقة (Toast) ---------------- */
export function toast(msg, type = "info", ms = 3400) {
  let wrap = $("#toasts");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "toasts"; document.body.append(wrap); }
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  wrap.append(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ms);
}

export function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle("is-busy", on);
}

/* شريط تقدم الرفع */
export function progressBar(label = t("جارٍ الرفع…")) {
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
export function modal({ title, body = "", confirmText = t("تأكيد"), cancelText = t("إلغاء"), danger = false, success = false, onConfirm, onOpen, wide = false }) {
  return new Promise(resolve => {
    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    const okCls = danger ? "btn-danger" : success ? "btn-success" : "btn-primary";
    bd.innerHTML = `
      <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="${t("إغلاق")}">${icon("x")}</button></div>
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

export function askNote({ title, label, placeholder = "", required = true, confirmText = t("تأكيد"), danger = false, success = false, onConfirm }) {
  return modal({
    title, confirmText, danger, success,
    body: `<label class="field"><span>${esc(label)}${required ? ' <i class="req">*</i>' : ""}</span><textarea rows="4" placeholder="${esc(placeholder)}"></textarea></label>`,
    onConfirm: async bd => {
      const v = bd.querySelector("textarea").value.trim();
      if (required && !v) { toast(t("الرجاء كتابة الملاحظة"), "error"); return false; }
      if (onConfirm) await onConfirm(v);
      return v;
    }
  });
}

/* ---------------- المصادقة وحماية الصفحات ---------------- */
export function requireAuth(roles) {
  applyI18n();
  return new Promise(resolve => {
    const unsub = A.onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { location.replace("index.html"); return; }
      try {
        const snap = await F.getDoc(F.doc(db, "users", user.uid));
        const p = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        if (!p || p.status !== "approved") { location.replace("index.html"); return; }
        if (roles && !roles.includes(p.role)) { location.replace(homeFor(p.role)); return; }
        // لو تم إيقاف الحساب أو حذفه أثناء الاستخدام
        F.onSnapshot(F.doc(db, "users", user.uid), s => {
          const d = s.data();
          if (!d || d.status !== "approved" || (roles && !roles.includes(d.role))) location.replace("index.html");
        }, () => {});
        resolve({ user, profile: p });
      } catch (e) {
        console.error(e);
        document.body.innerHTML = `<div class="fatal">${icon("alert")}<h2>${t("تعذر تحميل الحساب")}</h2><p>${esc(errMsg(e))}</p><a class="btn btn-primary" href="index.html">${t("العودة")}</a></div>`;
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

/* ---------------- الصورة الشخصية ---------------- */
export function initials(u) {
  return (u?.orgName || u?.name || u?.email || "?").trim().slice(0, 1).toUpperCase();
}
/** صورة الحساب أو أول حرف من الاسم */
export function avatarHTML(u, cls = "") {
  return u?.photoURL
    ? `<span class="av ${cls}"><img src="${esc(u.photoURL)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`
    : `<span class="av ${cls}">${esc(initials(u))}</span>`;
}
/** يصغّر الصورة إلى مربع (افتراضياً 400px) ويحوّلها JPEG */
export function resizeImage(file, size = 400) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error(t("الرجاء اختيار صورة"))); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error(t("تعذر قراءة الصورة"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t("تعذر قراءة الصورة"))); };
    img.src = url;
  });
}
/** يرفع صورة الحساب ويرجع {photoURL, photoPath} ويحذف القديمة */
export async function uploadAvatar(uid, blob, oldPath) {
  const path = `avatars/${uid}/avatar_${Date.now()}.jpg`;
  const r = S.ref(storage, path);
  await S.uploadBytes(r, blob, { contentType: "image/jpeg" });
  const photoURL = await S.getDownloadURL(r);
  if (oldPath) S.deleteObject(S.ref(storage, oldPath)).catch(() => {});
  return { photoURL, photoPath: path };
}
/** عنصر اختيار صورة: معاينة دائرية + أزرار تغيير/إزالة. يرجع {blob, removed} */
export function avatarPicker(el, u = {}) {
  let blob = null, removed = false, preview = u.photoURL || "";
  const render = () => {
    el.innerHTML = `
      <div class="av-picker">
        ${preview ? `<span class="av av-xl"><img src="${esc(preview)}" alt=""></span>` : `<span class="av av-xl av-empty">${icon("camera")}</span>`}
        <div class="av-picker-actions">
          <input type="file" accept="image/*" hidden data-av-in>
          <button type="button" class="btn btn-outline btn-sm" data-av-pick>${icon("camera")} ${preview ? t("تغيير الصورة") : t("إضافة صورة")}</button>
          ${preview ? `<button type="button" class="btn btn-ghost btn-sm" data-av-rm>${t("إزالة")}</button>` : ""}
          <small class="muted">${t("صورة الشعار أو الملف الشخصي (اختياري)")}</small>
        </div>
      </div>`;
    $("[data-av-pick]", el).onclick = () => $("[data-av-in]", el).click();
    $("[data-av-in]", el).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        blob = await resizeImage(f);
        removed = false;
        if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
        preview = URL.createObjectURL(blob);
        render();
      } catch (err) { toast(err.message, "error"); }
    };
    const rm = $("[data-av-rm]", el);
    if (rm) rm.onclick = () => { blob = null; removed = true; preview = ""; render(); };
  };
  render();
  return { get blob() { return blob; }, get removed() { return removed; } };
}
/** يحفظ تغيير الصورة لحساب ويرجع الحقول المطلوب تحديثها */
export async function avatarChanges(uid, picker, current = {}) {
  if (picker.blob) return uploadAvatar(uid, picker.blob, current.photoPath);
  if (picker.removed && current.photoURL) {
    if (current.photoPath) S.deleteObject(S.ref(storage, current.photoPath)).catch(() => {});
    return { photoURL: F.deleteField(), photoPath: F.deleteField() };
  }
  return {};
}

/** نافذة "ملفي الشخصي": الصورة والاسم والهاتف */
export async function editMyProfile(profile) {
  let picker;
  await modal({
    title: t("ملفي الشخصي"), confirmText: t("حفظ"),
    body: `
      <div id="myAv"></div>
      <label class="field"><span>${profile.role === "company" ? t("اسم الشركة") : t("اسم القسم / الفريق")}</span><input value="${esc(profile.orgName || "")}" disabled><small>${t("لتغيير الاسم تواصل مع قسم GIS.")}</small></label>
      <div class="row2">
        <label class="field"><span>${t("اسم المسؤول")}</span><input id="myName" value="${esc(profile.name || "")}"></label>
        <label class="field"><span>${t("رقم الهاتف")}</span><input id="myPhone" type="tel" value="${esc(profile.phone || "")}"></label>
      </div>
      <label class="field"><span>${t("البريد الإلكتروني")}</span><input value="${esc(profile.email || "")}" disabled></label>`,
    onOpen: bd => { picker = avatarPicker($("#myAv", bd), profile); },
    onConfirm: async bd => {
      const data = { name: $("#myName", bd).value.trim(), phone: $("#myPhone", bd).value.trim(), ...(await avatarChanges(profile.id, picker, profile)) };
      await F.updateDoc(F.doc(db, "users", profile.id), data);
      Object.assign(profile, data);
      if (data.photoURL && typeof data.photoURL !== "string") { delete profile.photoURL; delete profile.photoPath; }
      updateShellAvatar(profile);
      toast(t("تم حفظ التعديلات"), "success");
    }
  });
}
function updateShellAvatar(profile) {
  const b = $("#userBtn"); if (b) b.innerHTML = avatarHTML(profile);
  const h = $("#umAvatar"); if (h) h.innerHTML = avatarHTML(profile, "av-lg");
}

/* ---------------- الشريط العلوي ---------------- */
export function renderShell(profile, { title, subtitle = "", back = "" } = {}) {
  $("#topbar").innerHTML = `
    <div class="topbar-inner">
      <div class="tb-start">
        ${back ? `<a class="icon-btn back-btn" href="${esc(back)}" aria-label="${t("رجوع")}">${icon("back")}</a>` : `<div class="brand-mark">${icon("layers")}</div>`}
        <div class="tb-title"><strong>${esc(title)}</strong>${subtitle ? `<small>${esc(subtitle)}</small>` : ""}</div>
      </div>
      <div class="tb-end">
        ${langButtonHTML()}
        <div class="pop-wrap">
          <button class="icon-btn" id="bellBtn" aria-label="${t("الإشعارات")}">${icon("bell")}<span class="badge-dot" id="bellCount" hidden></span></button>
          <div class="dropdown bell-panel" id="bellPanel" hidden></div>
        </div>
        <div class="pop-wrap">
          <button class="avatar" id="userBtn" aria-label="${t("الحساب")}">${avatarHTML(profile)}</button>
          <div class="dropdown user-menu" id="userMenu" hidden>
            <div class="um-head">
              <span id="umAvatar">${avatarHTML(profile, "av-lg")}</span>
              <strong>${esc(profile.orgName || profile.name || profile.email)}</strong>${profile.name ? `<small>${esc(profile.name)}</small>` : ""}<small>${esc(profile.email)}</small><span class="chip st-new">${esc(ROLES[profile.role] || profile.role)}</span>
            </div>
            <button class="um-item um-plain" id="profileBtn">${icon("users")} ${t("ملفي الشخصي")}</button>
            <button class="um-item" id="logoutBtn">${icon("logout")} ${t("تسجيل الخروج")}</button>
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
  $("#profileBtn").addEventListener("click", () => { $("#userMenu").hidden = true; editMyProfile(profile); });
  initBell(profile);
}

/* ---------------- نظام الإشعارات ----------------
   العنوان والنص يُحفظان كنص عربي (مفتاح ترجمة) + متغيرات،
   ويُترجمان عند العرض حسب لغة المستلم. */
export async function notify({ toUid = null, toRole = null, title, tp = null, body = "", bp = null, link = "" }) {
  try {
    await F.addDoc(F.collection(db, "notifications"), {
      toUid, toRole, title, tp, body, bp, link,
      from: auth.currentUser?.uid || null,
      readBy: [],
      createdAt: F.serverTimestamp()
    });
  } catch (e) { console.warn("notify failed", e); }
}
const nTitle = n => t(n.title || "", n.tp || undefined);
const nBody = n => t(n.body || "", n.bp || undefined);

function showDeviceNotification(n) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body: nBody(n), icon: "icons/icon-192.png", tag: n.id, data: { link: n.link } };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(r => r.showNotification(nTitle(n), opts)).catch(() => {});
  } else {
    try { new Notification(nTitle(n), opts); } catch {}
  }
}

// هل رابط الإشعار يشير للصفحة المفتوحة حالياً؟
function linkIsCurrent(link) {
  if (!link) return false;
  try {
    const u = new URL(link, location.href);
    const file = p => p.split("/").pop() || "index.html";
    if (file(u.pathname) !== file(location.pathname)) return false;
    const id = u.searchParams.get("id");
    if (id) return id === new URLSearchParams(location.search).get("id");
    if (u.hash) return u.hash === location.hash;
    return true;
  } catch { return false; }
}

let bellApi = null;
/** تحديد إشعارات الصفحة الحالية كمقروءة (تُستدعى عند تغيير التبويب) */
export function markCurrentPageRead() { bellApi?.markCurrent(); }

function initBell(profile) {
  const uid = profile.id;
  let mine = [], byRole = [];
  const firstLoad = { a: true, b: true };
  const seen = new Set();
  const marking = new Set();

  const isUnread = n => !(n.readBy || []).includes(uid);
  const markRead = ids => Promise.all(ids.filter(id => !marking.has(id)).map(id => {
    marking.add(id);
    return F.updateDoc(F.doc(db, "notifications", id), { readBy: F.arrayUnion(uid) })
      .catch(e => console.warn("mark read failed", e))
      .finally(() => marking.delete(id));
  }));
  const all = () => [...mine, ...byRole].sort(byDateDesc);
  const markCurrent = () => {
    const ids = all().filter(n => isUnread(n) && linkIsCurrent(n.link)).map(n => n.id);
    if (ids.length) markRead(ids);
  };
  bellApi = { markCurrent };
  window.addEventListener("hashchange", markCurrent);

  const render = () => {
    const list = all().slice(0, 40);
    const unread = list.filter(isUnread);
    const cnt = $("#bellCount");
    cnt.hidden = unread.length === 0;
    cnt.textContent = unread.length > 9 ? "9+" : unread.length;
    const canAsk = "Notification" in window && Notification.permission === "default";
    $("#bellPanel").innerHTML = `
      <div class="bp-head"><strong>${t("الإشعارات")}</strong>${unread.length ? `<button class="link-btn" id="markAll">${t("تحديد الكل كمقروء")}</button>` : ""}</div>
      ${canAsk ? `<button class="bp-enable" id="enableNotif">${icon("bell")} ${t("تفعيل تنبيهات الجهاز")}</button>` : ""}
      <div class="bp-list">
        ${list.length ? list.map(n => `
          <button class="bp-item ${isUnread(n) ? "unread" : ""}" data-id="${esc(n.id)}" data-link="${esc(n.link || "")}">
            <span class="bp-ic">${icon("bell")}</span>
            <span class="bp-txt"><strong>${esc(nTitle(n))}</strong><small>${esc(nBody(n))}</small><em>${esc(timeAgo(n.createdAt))}</em></span>
          </button>`).join("") : `<div class="bp-empty">${t("لا توجد إشعارات")}</div>`}
      </div>`;
    $("#markAll")?.addEventListener("click", async e => {
      e.stopPropagation();
      await markRead(unread.map(n => n.id));
    });
    $("#enableNotif")?.addEventListener("click", async e => {
      e.stopPropagation();
      const r = await Notification.requestPermission();
      toast(r === "granted" ? t("تم تفعيل التنبيهات") : t("لم يتم السماح بالتنبيهات"), r === "granted" ? "success" : "info");
      render();
    });
    $$(".bp-item").forEach(b => b.addEventListener("click", async e => {
      e.stopPropagation();
      const n = all().find(x => x.id === b.dataset.id);
      // ننتظر حفظ "مقروء" قبل الانتقال، وإلا يلغيه المتصفح عند مغادرة الصفحة
      if (n && isUnread(n)) { b.classList.remove("unread"); await markRead([n.id]); }
      const link = b.dataset.link;
      if (!link) return;
      if (linkIsCurrent(link)) { $("#bellPanel").hidden = true; return; }
      location.href = link;
    }));
  };

  const handle = (key, snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!firstLoad[key]) {
      snap.docChanges().forEach(ch => {
        const n = { id: ch.doc.id, ...ch.doc.data() };
        if (ch.type === "added" && !seen.has(n.id) && isUnread(n) && n.from !== uid && !linkIsCurrent(n.link)) showDeviceNotification(n);
      });
    }
    list.forEach(n => seen.add(n.id));
    firstLoad[key] = false;
    if (key === "a") mine = list; else byRole = list;
    render();
    markCurrent();
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
    const list = s.exists() ? s.data().requestTypes : null;
    return list?.length ? list : DEFAULT_TYPES;
  } catch { return DEFAULT_TYPES; }
}

/* ---------------- الملفات ---------------- */
const safeName = n => n.replace(/[\/\\#?%*:|"<>\[\]]/g, "_");

export async function uploadFiles(rid, section, files, profile, label) {
  if (!files.length) return [];
  for (const f of files) {
    if (f.size > APP.maxFileMB * 1048576) throw new Error(t("الملف \"{name}\" أكبر من {mb} ميجابايت", { name: f.name, mb: APP.maxFileMB }));
  }
  const bar = progressBar(label || t("جارٍ رفع {n} ملف…", { n: files.length }));
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
  if (!files.length) return `<div class="files-empty">${icon("file")} ${t("لا توجد ملفات")}</div>`;
  const imgs = opts.thumbs ? files.filter(isImage) : [];
  const others = opts.thumbs ? files.filter(f => !isImage(f)) : files;
  const thumbs = imgs.length ? `<div class="thumb-grid">${imgs.map(f => `
      <button type="button" class="thumb" data-open="${esc(f.path)}" title="${esc(f.name)}">
        <img data-thumb="${esc(f.path)}" alt="${esc(f.name)}">
        ${opts.canDelete ? `<span class="thumb-del" data-del="${esc(f.path)}" role="button" aria-label="${t("حذف")}">${icon("x")}</span>` : ""}
      </button>`).join("")}</div>` : "";
  const list = others.length ? `<ul class="file-list">${others.map(f => `
      <li class="file-item">
        ${opts.selectable ? `<input type="checkbox" class="file-check" value="${esc(f.path)}" ${opts.checked !== false ? "checked" : ""}>` : ""}
        <span class="fi-ic">${icon(fileIcon(f))}<em>${esc(fileExt(f.name))}</em></span>
        <span class="fi-txt"><strong>${esc(f.name)}</strong><small><bdi>${esc(fmtSize(f.size))}</bdi>${f.byName ? ` · <bdi>${esc(f.byName)}</bdi>` : ""}${f.uploadedAt ? ` · <bdi>${esc(fmtDate(f.uploadedAt))}</bdi>` : ""}</small></span>
        <button type="button" class="icon-btn sm" data-open="${esc(f.path)}" aria-label="${t("تنزيل")}">${icon("download")}</button>
        ${opts.canDelete ? `<button type="button" class="icon-btn sm danger" data-del="${esc(f.path)}" aria-label="${t("حذف")}">${icon("trash")}</button>` : ""}
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
export function filePicker(el, { camera = false, label = t("إرفاق ملفات"), accept = "" } = {}) {
  let files = [];
  el.innerHTML = `
    <div class="dropzone">
      <input type="file" multiple hidden data-in ${accept ? `accept="${esc(accept)}"` : ""}>
      ${camera ? `<input type="file" accept="image/*" capture="environment" hidden data-cam>` : ""}
      <div class="dz-icon">${icon("upload")}</div>
      <div class="dz-actions">
        <button type="button" class="btn btn-outline btn-sm" data-pick>${icon("file")} ${esc(label)}</button>
        ${camera ? `<button type="button" class="btn btn-outline btn-sm" data-campick>${icon("camera")} ${t("تصوير")}</button>` : ""}
      </div>
      <small class="muted">${t("أو اسحب الملفات هنا · الحد الأقصى {mb} ميجابايت للملف", { mb: APP.maxFileMB })}</small>
    </div>
    <ul class="file-list" data-list></ul>`;
  const list = $("[data-list]", el);
  const render = () => {
    list.innerHTML = files.map((f, i) => `
      <li class="file-item">
        <span class="fi-ic">${icon(fileIcon(f))}<em>${esc(fileExt(f.name))}</em></span>
        <span class="fi-txt"><strong>${esc(f.name)}</strong><small><bdi>${esc(fmtSize(f.size))}</bdi></small></span>
        <button type="button" class="icon-btn sm" data-rm="${i}" aria-label="${t("إزالة")}">${icon("x")}</button>
      </li>`).join("");
  };
  const add = fl => {
    for (const f of fl) {
      if (f.size > APP.maxFileMB * 1048576) { toast(t("الملف \"{name}\" أكبر من {mb} ميجابايت", { name: f.name, mb: APP.maxFileMB }), "error"); continue; }
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
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("over"); }));
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
      if (!navigator.geolocation) { toast(t("المتصفح لا يدعم تحديد الموقع"), "error"); return; }
      navigator.geolocation.getCurrentPosition(
        p => { const ll = L.latLng(p.coords.latitude, p.coords.longitude); map.setView(ll, 16); set(ll); },
        () => toast(t("تعذر تحديد موقعك، اسمح بالوصول للموقع"), "error"),
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
        <div class="req-top"><strong>${t("طلب #{n}", { n: r.number })}</strong>${chip(r.status, forCompany)}</div>
        <div class="req-type">${esc(t(r.type || ""))}</div>
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
