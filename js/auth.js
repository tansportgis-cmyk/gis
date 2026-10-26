// صفحة الدخول والتسجيل
import { auth, db, A, F, $, $$, esc, icon, toast, busy, errMsg, homeFor, notify, ROLES, ROLE_KEYS, hideBoot, t, applyI18n, langButtonHTML, avatarPicker, uploadAvatar, lang } from "./core.js";

applyI18n();
$("#authLang").innerHTML = langButtonHTML();

const VIEWS = ["login", "register", "status", "reset"];
const show = v => { VIEWS.forEach(x => ($("#view-" + x).hidden = x !== v)); window.scrollTo(0, 0); };
const regAvatar = avatarPicker($("#regAvatar"));

$$("[data-go]").forEach(b => b.addEventListener("click", () => show(b.dataset.go)));

// تغيير عنوان الحقل حسب نوع الحساب
$$('#registerForm input[name=role]').forEach(r => r.addEventListener("change", () => {
  const role = $('#registerForm input[name=role]:checked').value;
  $("#orgLabel").textContent = role === "company" ? t("اسم الشركة") : t("اسم القسم / الفريق");
}));

let registering = false;
let unsubProfile = null;

function showStatus(p) {
  const ic = $("#stIcon");
  $("#stExtra").innerHTML = "";
  if (!p) {
    ic.className = "status-ic bad"; ic.innerHTML = icon("alert");
    $("#stTitle").textContent = t("الحساب غير موجود");
    $("#stText").textContent = t("لم يتم العثور على بيانات حسابك، ربما تم حذفه. تواصل مع قسم GIS.");
  } else if (p.status === "pending") {
    ic.className = "status-ic pending"; ic.innerHTML = icon("clock");
    $("#stTitle").textContent = t("حسابك قيد المراجعة");
    $("#stText").textContent = t("تم استلام طلب تسجيل \"{org}\" كـ {role}. سيتم تفعيل الحساب من قسم GIS، وستنتقل للتطبيق تلقائياً بعد الموافقة.", { org: p.orgName, role: ROLES[p.role] || p.role });
  } else if (p.status === "rejected") {
    ic.className = "status-ic bad"; ic.innerHTML = icon("x");
    $("#stTitle").textContent = t("تم رفض طلب التسجيل");
    $("#stText").textContent = t("تواصل مع قسم GIS لمعرفة التفاصيل.");
    if (p.rejectReason) $("#stExtra").innerHTML = `<div class="alert danger">${icon("alert")}<div><b>${t("السبب")}</b><p>${esc(p.rejectReason)}</p></div></div>`;
  } else if (p.status === "disabled") {
    ic.className = "status-ic bad"; ic.innerHTML = icon("ban");
    $("#stTitle").textContent = t("الحساب موقوف");
    $("#stText").textContent = t("تم إيقاف هذا الحساب. تواصل مع قسم GIS.");
  } else {
    // قيم غير متوقعة (غالباً خطأ كتابة عند التعديل اليدوي في Firestore)
    ic.className = "status-ic bad"; ic.innerHTML = icon("alert");
    $("#stTitle").textContent = t("بيانات الحساب غير صحيحة");
    $("#stText").textContent = t("القيم المحفوظة لهذا الحساب في Firestore غير معروفة. صحّحها بحروف صغيرة وبدون مسافات أو علامات تنصيص.");
    $("#stExtra").innerHTML = `<div class="alert warn" style="text-align:start">${icon("alert")}<div>
      <p>role: <b dir="ltr">${esc(JSON.stringify(p.role))}</b> → <b dir="ltr">gis / company / maintenance</b></p>
      <p>status: <b dir="ltr">${esc(JSON.stringify(p.status))}</b> → <b dir="ltr">approved</b></p></div></div>`;
  }
  show("status");
}

A.onAuthStateChanged(auth, user => {
  if (unsubProfile) { unsubProfile(); unsubProfile = null; }
  if (!user) { show("login"); hideBoot(); return; }
  unsubProfile = F.onSnapshot(F.doc(db, "users", user.uid), snap => {
    if (!snap.exists()) {
      if (registering) return;
      showStatus(null); hideBoot(); return;
    }
    const p = snap.data();
    if (p.status === "approved" && ["gis", "company", "maintenance"].includes(p.role)) { location.replace(homeFor(p.role)); return; }
    showStatus(p); hideBoot();
  }, e => { toast(errMsg(e), "error"); show("login"); hideBoot(); });
});

// تسجيل الدخول
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button[type=submit]");
  const email = f.email.value.trim(), password = f.password.value;
  if (!email || !password) { toast(t("أدخل البريد وكلمة المرور"), "error"); return; }
  busy(btn, true);
  try {
    await A.signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    toast(errMsg(err), "error");
  } finally { busy(btn, false); }
});

// نسيت كلمة المرور: يرسل Firebase رابط إعادة التعيين لبريد المستخدم
$("#forgotLink").addEventListener("click", e => {
  e.preventDefault();
  $("#resetForm").email.value = $("#loginForm").email.value.trim();
  $("#resetForm").hidden = false;
  $("#resetDone").hidden = true;
  show("reset");
  setTimeout(() => $("#resetForm").email.focus(), 50);
});
$("#resetForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button[type=submit]");
  const email = f.email.value.trim();
  if (!email) { toast(t("أدخل البريد"), "error"); return; }
  busy(btn, true);
  auth.languageCode = lang; // رسالة البريد بلغة المستخدم
  const back = { url: new URL("index.html", location.href).href };
  try {
    try { await A.sendPasswordResetEmail(auth, email, back); }
    catch (err) {
      // لو رابط العودة غير مسموح في Firebase نرسل بدونه
      if (/continue-uri|unauthorized-domain/.test(err.code || "")) await A.sendPasswordResetEmail(auth, email);
      else throw err;
    }
    $("#resetEmail").textContent = email;
    f.hidden = true;
    $("#resetDone").hidden = false;
  } catch (err) {
    toast(errMsg(err), "error");
  } finally { busy(btn, false); }
});
$("#resetAgain").addEventListener("click", () => { $("#resetForm").hidden = false; $("#resetDone").hidden = true; });
$("#resetBack").addEventListener("click", () => {
  $("#loginForm").email.value = $("#resetForm").email.value.trim();
  show("login");
});

// التسجيل
$("#registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button[type=submit]");
  const data = {
    role: f.role.value,
    orgName: f.orgName.value.trim(),
    name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    email: f.email.value.trim()
  };
  if (!data.orgName || !data.name || !data.email) { toast(t("أكمل الحقول المطلوبة"), "error"); return; }
  if (f.password.value.length < 6) { toast(t("كلمة المرور 6 أحرف على الأقل"), "error"); return; }
  if (f.password.value !== f.password2.value) { toast(t("كلمتا المرور غير متطابقتين"), "error"); return; }

  busy(btn, true);
  registering = true;
  try {
    const cred = await A.createUserWithEmailAndPassword(auth, data.email, f.password.value);
    await A.updateProfile(cred.user, { displayName: data.name }).catch(() => {});
    // الصورة الشخصية (اختيارية) — لا نوقف التسجيل لو فشل رفعها
    let photo = {};
    if (regAvatar.blob) photo = await uploadAvatar(cred.user.uid, regAvatar.blob).catch(err => { console.warn(err); return {}; });
    await F.setDoc(F.doc(db, "users", cred.user.uid), {
      ...data,
      ...photo,
      email: cred.user.email,
      status: "pending",
      createdAt: F.serverTimestamp()
    });
    await notify({
      toRole: "gis",
      title: "طلب تسجيل حساب جديد",
      body: "{org} — {role}", bp: { org: data.orgName, role: ROLE_KEYS[data.role] },
      link: "gis.html#accounts"
    });
    toast(t("تم إرسال طلب التسجيل"), "success");
  } catch (err) {
    toast(errMsg(err), "error");
  } finally {
    registering = false;
    busy(btn, false);
  }
});

$("#stLogout").addEventListener("click", () => A.signOut(auth));
