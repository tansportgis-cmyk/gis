// واجهة الشركة
import {
  db, F, $, $$, esc, icon, toast, busy, errMsg, requireAuth, renderShell, hideBoot,
  requestCard, emptyState, byDateDesc, getRequestTypes, filePicker, uploadFiles,
  pickerMap, notify, hist
} from "./core.js";

const { profile } = await requireAuth(["company"]);
renderShell(profile, { title: "طلباتي", subtitle: profile.orgName });
$("#hello").textContent = `مرحباً، ${profile.orgName}`;
$("#newBtn").innerHTML = `${icon("plus")} طلب جديد`;
$("#filesTitle").innerHTML = `${icon("file")} إرفاق الملفات`;
$("#mapTitle").innerHTML = `${icon("pin")} الموقع على الخريطة`;
$("#myLoc").innerHTML = `${icon("crosshair")} موقعي`;
$("#submitBtn").innerHTML = `${icon("send")} إرسال الطلب`;

/* ---------- القائمة ---------- */
const GROUPS = {
  all:      { label: "الكل",          match: () => true },
  active:   { label: "قيد المعالجة",  match: r => ["new", "gis_work", "maintenance", "gis_review"].includes(r.status) },
  needs:    { label: "مطلوب استكمال", match: r => r.status === "needs_info" },
  done:     { label: "مكتملة",        match: r => r.status === "approved" },
  rejected: { label: "مرفوضة",        match: r => r.status === "rejected" }
};
let filter = "all";
let requests = [];

function render() {
  const count = k => requests.filter(GROUPS[k].match).length;
  $("#stats").innerHTML = `
    <button class="stat blue" data-f="active"><b>${count("active")}</b><span>قيد المعالجة</span></button>
    <button class="stat orange" data-f="needs"><b>${count("needs")}</b><span>مطلوب استكمال</span></button>
    <button class="stat green" data-f="done"><b>${count("done")}</b><span>مكتملة</span></button>
    <button class="stat purple" data-f="all"><b>${requests.length}</b><span>كل الطلبات</span></button>`;
  $("#tabs").innerHTML = Object.entries(GROUPS).map(([k, g]) =>
    `<button class="tab ${k === filter ? "active" : ""}" data-f="${k}">${g.label} <span class="n">${count(k)}</span></button>`).join("");
  const list = requests.filter(GROUPS[filter].match);
  $("#list").innerHTML = list.length
    ? list.map(r => requestCard(r, { showCompany: false, forCompany: true })).join("")
    : emptyState(requests.length ? "لا توجد طلبات في هذا التصنيف" : "لا توجد طلبات بعد", requests.length ? "" : "اضغط \"طلب جديد\" لإرسال أول طلب");
  $$("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
}

F.onSnapshot(
  F.query(F.collection(db, "requests"), F.where("companyId", "==", profile.id)),
  snap => {
    requests = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc);
    render();
    hideBoot();
  },
  e => { toast(errMsg(e), "error"); hideBoot(); }
);

/* ---------- طلب جديد ---------- */
const types = await getRequestTypes();
$("#typeSelect").innerHTML = `<option value="">اختر نوع الطلب</option>` + types.map(t => `<option>${esc(t)}</option>`).join("");

const picker = filePicker($("#picker"), { label: "اختيار ملفات" });
let location_ = null;
let mapCtl = null;

function openNew() {
  $("#listView").hidden = true;
  $("#newView").hidden = false;
  $("#newBtn").hidden = true;
  window.scrollTo(0, 0);
  if (!mapCtl) {
    mapCtl = pickerMap($("#pickMap"), null, loc => {
      location_ = loc;
      $("#locText").innerHTML = loc ? `${icon("pin")} <code>${loc.lat}, ${loc.lng}</code>` : "اضغط على الخريطة لتحديد الموقع (اختياري)";
    });
  }
  setTimeout(() => mapCtl.map.invalidateSize(), 60);
  history.replaceState(null, "", "#new");
}
function closeNew() {
  $("#newView").hidden = true;
  $("#listView").hidden = false;
  $("#newBtn").hidden = false;
  history.replaceState(null, "", location.pathname);
}
$("#newBtn").onclick = openNew;
$("#cancelNew").onclick = () => { $("#newForm").reset(); picker.clear(); mapCtl?.clear(); closeNew(); };
$("#myLoc").onclick = () => mapCtl?.locate();
$("#clearLoc").onclick = () => mapCtl?.clear();
if (location.hash === "#new") openNew();

$("#newForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = $("#submitBtn");
  const type = f.type.value, description = f.description.value.trim();
  if (!type) { toast("اختر نوع الطلب", "error"); return; }
  if (!description) { toast("اكتب وصف الطلب", "error"); return; }
  if (!picker.files.length && !confirm("لم ترفق أي ملف. هل تريد الإرسال بدون ملفات؟")) return;

  busy(btn, true);
  try {
    const reqRef = F.doc(F.collection(db, "requests"));
    const counterRef = F.doc(db, "counters", "requests");
    // رقم تسلسلي للطلب
    const number = await F.runTransaction(db, async tx => {
      const c = await tx.get(counterRef);
      const n = c.exists() ? c.data().last + 1 : 1001;
      tx.set(counterRef, { last: n });
      tx.set(reqRef, {
        number: n, type, description,
        location: location_,
        companyId: profile.id,
        companyName: profile.orgName,
        contactName: profile.name,
        contactPhone: profile.phone || "",
        contactEmail: profile.email || "",
        status: "new",
        maintVisible: false,
        companyFiles: [], gisFiles: [], maintFiles: [], finalFiles: [], sharedPaths: [],
        companyNote: "", maintInstructions: "", maintNotes: "",
        history: [hist(profile, "created")],
        createdAt: F.serverTimestamp(),
        updatedAt: F.serverTimestamp()
      });
      return n;
    });

    if (picker.files.length) {
      const metas = await uploadFiles(reqRef.id, "company", picker.files, profile, "جارٍ رفع ملفات الطلب…");
      await F.updateDoc(reqRef, { companyFiles: metas, updatedAt: F.serverTimestamp() });
    }

    await notify({
      toRole: "gis",
      title: `طلب جديد #${number}`,
      body: `${type} — ${profile.orgName}`,
      link: `request.html?id=${reqRef.id}`
    });

    toast(`تم إرسال الطلب #${number} بنجاح`, "success");
    f.reset(); picker.clear(); mapCtl?.clear();
    location.href = `request.html?id=${reqRef.id}&sent=1`;
  } catch (err) {
    console.error(err);
    toast(errMsg(err), "error");
  } finally { busy(btn, false); }
});
