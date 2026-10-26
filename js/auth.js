// صفحة الدخول والتسجيل
import { auth, db, A, F, $, $$, esc, icon, toast, busy, errMsg, homeFor, notify, ROLES, hideBoot, modal } from "./core.js";

const VIEWS = ["login", "register", "status"];
const show = v => VIEWS.forEach(x => ($("#view-" + x).hidden = x !== v));

$$("[data-go]").forEach(b => b.addEventListener("click", () => show(b.dataset.go)));

// تغيير عنوان الحقل حسب نوع الحساب
$$('#registerForm input[name=role]').forEach(r => r.addEventListener("change", () => {
  const role = $('#registerForm input[name=role]:checked').value;
  $("#orgLabel").innerHTML = role === "company"
    ? 'اسم الشركة <i class="req">*</i>'
    : 'اسم القسم / الفريق <i class="req">*</i>';
}));

let registering = false;
let unsubProfile = null;

function showStatus(p) {
  const ic = $("#stIcon");
  $("#stExtra").innerHTML = "";
  if (!p) {
    ic.className = "status-ic bad"; ic.innerHTML = icon("alert");
    $("#stTitle").textContent = "الحساب غير مكتمل";
    $("#stText").textContent = "لم يتم العثور على بيانات حسابك. تواصل مع قسم GIS أو سجّل بحساب آخر.";
  } else if (p.status === "pending") {
    ic.className = "status-ic pending"; ic.innerHTML = icon("clock");
    $("#stTitle").textContent = "حسابك قيد المراجعة";
    $("#stText").textContent = `تم استلام طلب تسجيل "${p.orgName}" كـ ${ROLES[p.role] || p.role}. سيتم تفعيل الحساب من قسم GIS، وستنتقل للتطبيق تلقائياً بعد الموافقة.`;
  } else if (p.status === "rejected") {
    ic.className = "status-ic bad"; ic.innerHTML = icon("x");
    $("#stTitle").textContent = "تم رفض طلب التسجيل";
    $("#stText").textContent = "تواصل مع قسم GIS لمعرفة التفاصيل.";
    if (p.rejectReason) $("#stExtra").innerHTML = `<div class="alert danger">${icon("alert")}<div><b>السبب</b><p>${esc(p.rejectReason)}</p></div></div>`;
  } else if (p.status === "disabled") {
    ic.className = "status-ic bad"; ic.innerHTML = icon("ban");
    $("#stTitle").textContent = "الحساب موقوف";
    $("#stText").textContent = "تم إيقاف هذا الحساب. تواصل مع قسم GIS.";
  } else {
    // قيم غير متوقعة (غالباً خطأ كتابة عند التعديل اليدوي في Firestore)
    ic.className = "status-ic bad"; ic.innerHTML = icon("alert");
    $("#stTitle").textContent = "بيانات الحساب غير صحيحة";
    $("#stText").textContent = "القيم المحفوظة لهذا الحساب في Firestore غير معروفة. صحّحها بحروف صغيرة وبدون مسافات أو علامات تنصيص.";
    $("#stExtra").innerHTML = `<div class="alert warn" style="text-align:right">${icon("alert")}<div>
      <p>role الحالي: <b dir="ltr">${esc(JSON.stringify(p.role))}</b> ← المطلوب: <b dir="ltr">gis</b> أو <b dir="ltr">company</b> أو <b dir="ltr">maintenance</b></p>
      <p>status الحالي: <b dir="ltr">${esc(JSON.stringify(p.status))}</b> ← المطلوب: <b dir="ltr">approved</b></p></div></div>`;
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
  if (!email || !password) { toast("أدخل البريد وكلمة المرور", "error"); return; }
  busy(btn, true);
  try {
    await A.signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    toast(errMsg(err), "error");
  } finally { busy(btn, false); }
});

// نسيت كلمة المرور
$("#forgotLink").addEventListener("click", async e => {
  e.preventDefault();
  const pre = $("#loginForm").email.value.trim();
  await modal({
    title: "استعادة كلمة المرور",
    confirmText: "إرسال الرابط",
    body: `<p class="muted" style="margin-bottom:12px">سنرسل رابط تعيين كلمة مرور جديدة إلى بريدك.</p>
           <label class="field"><span>البريد الإلكتروني</span><input type="email" value="${esc(pre)}"></label>`,
    onConfirm: async bd => {
      const email = bd.querySelector("input").value.trim();
      if (!email) { toast("أدخل البريد", "error"); return false; }
      await A.sendPasswordResetEmail(auth, email);
      toast("تم إرسال الرابط إلى بريدك", "success");
    }
  });
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
  if (!data.orgName || !data.name || !data.email) { toast("أكمل الحقول المطلوبة", "error"); return; }
  if (f.password.value.length < 6) { toast("كلمة المرور 6 أحرف على الأقل", "error"); return; }
  if (f.password.value !== f.password2.value) { toast("كلمتا المرور غير متطابقتين", "error"); return; }

  busy(btn, true);
  registering = true;
  try {
    const cred = await A.createUserWithEmailAndPassword(auth, data.email, f.password.value);
    await A.updateProfile(cred.user, { displayName: data.name }).catch(() => {});
    await F.setDoc(F.doc(db, "users", cred.user.uid), {
      ...data,
      email: cred.user.email,
      status: "pending",
      createdAt: F.serverTimestamp()
    });
    await notify({
      toRole: "gis",
      title: "طلب تسجيل حساب جديد",
      body: `${data.orgName} — ${ROLES[data.role]}`,
      link: "gis.html#accounts"
    });
    toast("تم إرسال طلب التسجيل", "success");
  } catch (err) {
    toast(errMsg(err), "error");
  } finally {
    registering = false;
    busy(btn, false);
  }
});

$("#stLogout").addEventListener("click", () => A.signOut(auth));
