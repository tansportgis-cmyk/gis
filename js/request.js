// تفاصيل الطلب — مشتركة بين الشركة و GIS والصيانة، والإجراءات تتغير حسب الدور والحالة
import {
  db, storage, F, S, $, $$, esc, icon, toast, busy, errMsg, requireAuth, renderShell, hideBoot,
  chip, homeFor, fmtDate, fmtDateTime, HISTORY_LABELS, COMPANY_VISIBLE_HISTORY,
  filesHTML, wireFiles, hydrateThumbs, filePicker, uploadFiles, viewMap, gmapsLink,
  modal, askNote, notify, hist, ROLES
} from "./core.js";

const { profile } = await requireAuth(["company", "gis", "maintenance"]);
const role = profile.role;
const isGis = role === "gis", isCompany = role === "company", isMaint = role === "maintenance";
const id = new URLSearchParams(location.search).get("id");
renderShell(profile, { title: "تفاصيل الطلب", back: homeFor(role) });

if (!id) { location.replace(homeFor(role)); }
const ref = F.doc(db, "requests", id);
let r = null;
let lastActionKey = "";
let mapInstance = null;

if (new URLSearchParams(location.search).get("sent")) {
  $("#banner").innerHTML = `<div class="alert success">${icon("check")}<div><b>تم إرسال الطلب بنجاح</b><p>سيتم مراجعته من قسم GIS وستصلك الإشعارات عند أي تحديث.</p></div></div>`;
  history.replaceState(null, "", `request.html?id=${encodeURIComponent(id)}`);
}

F.onSnapshot(ref, snap => {
  if (!snap.exists()) {
    $("#main").innerHTML = `<div class="empty">${icon("inbox")}<strong>الطلب غير موجود</strong><a class="btn btn-primary" href="${homeFor(role)}">العودة</a></div>`;
    hideBoot(); return;
  }
  r = { id: snap.id, ...snap.data() };
  r.companyFiles ||= []; r.gisFiles ||= []; r.maintFiles ||= []; r.finalFiles ||= []; r.sharedPaths ||= [];
  $(".tb-title strong").textContent = `طلب #${r.number}`;
  document.title = `طلب #${r.number} — منصة طلبات GIS`;
  renderInfo();
  renderFiles();
  renderTimeline();
  const key = `${r.status}`;
  if (key !== lastActionKey) { lastActionKey = key; renderActions(); }
  hideBoot();
}, e => {
  $("#main").innerHTML = `<div class="empty">${icon("alert")}<strong>تعذر فتح الطلب</strong><small>${esc(errMsg(e))}</small><a class="btn btn-primary" href="${homeFor(role)}">العودة</a></div>`;
  hideBoot();
});

/* ================= معلومات الطلب ================= */
function stepperHTML() {
  if (r.status === "rejected") return "";
  const steps = isCompany
    ? [["تقديم", ["new", "needs_info"]], ["قيد المعالجة", ["gis_work", "maintenance", "gis_review"]], ["مكتمل", ["approved"]]]
    : [["تقديم", ["new", "needs_info"]], ["عمل GIS", ["gis_work"]], ["الصيانة", ["maintenance"]], ["مراجعة GIS", ["gis_review"]], ["مكتمل", ["approved"]]];
  const idx = steps.findIndex(s => s[1].includes(r.status));
  return `<div class="stepper">${steps.map((s, i) => {
    const last = i === steps.length - 1;
    const cls = i < idx || (last && i === idx) ? "done" : i === idx ? "current" : "";
    return `<div class="step ${cls} ${last ? "final" : ""}"><span class="dot">${cls === "done" ? icon("check") : ""}</span>${s[0]}</div>`;
  }).join("")}</div>`;
}

function alertsHTML() {
  const out = [];
  const note = r.companyNote ? `<p>${esc(r.companyNote)}</p>` : "";
  if (r.status === "needs_info") out.push(`<div class="alert warn">${icon("alert")}<div><b>${isCompany ? "مطلوب منك استكمال الطلب" : "بانتظار استكمال الشركة"}</b>${note}</div></div>`);
  if (r.status === "rejected") out.push(`<div class="alert danger">${icon("ban")}<div><b>تم رفض الطلب</b>${note}</div></div>`);
  if (r.status === "approved" && (isCompany || isGis)) out.push(`<div class="alert success">${icon("check")}<div><b>تم اعتماد الطلب</b>${note || (isCompany ? "<p>الملفات النهائية متاحة في قسم الملفات أدناه.</p>" : "")}</div></div>`);
  if ((isMaint || isGis) && r.maintInstructions && ["maintenance", "gis_review"].includes(r.status))
    out.push(`<div class="alert purple">${icon("wrench")}<div><b>تعليمات GIS للصيانة</b><p>${esc(r.maintInstructions)}</p></div></div>`);
  if ((isMaint || isGis) && r.maintNotes && r.status !== "maintenance")
    out.push(`<div class="alert info">${icon("file")}<div><b>ملاحظات الصيانة</b><p>${esc(r.maintNotes)}</p></div></div>`);
  return out.join("");
}

function renderInfo() {
  const loc = r.location;
  const contact = !isCompany ? `
    <div class="kv-row">
      <div><dt>الشركة</dt><dd>${esc(r.companyName)}</dd></div>
      <div><dt>المسؤول</dt><dd>${esc(r.contactName || "—")}${r.contactPhone ? `<br><a href="tel:${esc(r.contactPhone)}" dir="ltr">${esc(r.contactPhone)}</a>` : ""}</dd></div>
    </div>` : "";
  $("#infoCard").innerHTML = `
    <div class="req-head"><h1>طلب #${esc(r.number)}</h1>${chip(r.status, isCompany)}</div>
    <small class="muted">${esc(fmtDateTime(r.createdAt))}</small>
    ${stepperHTML()}
    <div style="margin-top:14px">${alertsHTML()}</div>
    <dl class="kv">
      <div><dt>نوع الطلب</dt><dd>${esc(r.type)}</dd></div>
      <div><dt>وصف الطلب</dt><dd>${esc(r.description)}</dd></div>
      ${contact}
      <div><dt>الموقع</dt><dd>${loc ? `<a href="${gmapsLink(loc)}" target="_blank" rel="noopener">${icon("external")} فتح في خرائط Google</a>` : "لم يتم تحديد موقع"}</dd></div>
    </dl>
    ${loc ? `<div class="map" id="viewMap" style="margin-top:10px"></div>` : ""}`;
  if (loc) {
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    mapInstance = viewMap($("#viewMap"), loc);
  }
}

/* ================= الملفات ================= */
const SECTIONS = [
  { key: "companyFiles", folder: "company", title: "ملفات الشركة", ic: "building",
    show: () => isGis || isCompany, canDelete: () => isGis },
  { key: "gisFiles", folder: "gis", title: "ملفات GIS (الخرائط)", ic: "layers",
    show: () => isGis || isMaint, canUpload: () => isGis && ["gis_work", "gis_review"].includes(r.status), canDelete: () => isGis },
  { key: "maintFiles", folder: "maint", title: "ملفات وصور الصيانة", ic: "wrench", thumbs: true, camera: true,
    show: () => isGis || isMaint, canUpload: () => isMaint && r.status === "maintenance",
    canDelete: () => isGis || (isMaint && r.status === "maintenance") },
  { key: "finalFiles", folder: "final", title: "الملفات النهائية", ic: "check", thumbs: true,
    show: () => (isCompany && r.status === "approved") || (isGis && r.finalFiles.length), canDelete: () => false }
];

function renderFiles() {
  const visible = SECTIONS.filter(s => s.show());
  $("#filesCard").innerHTML = visible.map(s => `
    <div class="files-section" data-sec="${s.key}">
      <div class="files-head">
        <h3>${icon(s.ic)} ${s.title} <span class="count">${r[s.key].length}</span></h3>
        ${s.canUpload?.() ? `
          <div style="display:flex;gap:6px">
            ${s.camera ? `<button class="btn btn-outline btn-sm" data-cam="${s.key}">${icon("camera")} تصوير</button>` : ""}
            <button class="btn btn-primary btn-sm" data-up="${s.key}">${icon("upload")} رفع</button>
          </div>` : ""}
      </div>
      ${filesHTML(r[s.key], { canDelete: s.canDelete?.(), thumbs: s.thumbs })}
    </div>`).join("") || `<div class="files-section">${filesHTML([])}</div>`;
  hydrateThumbs($("#filesCard"));
  $$("[data-up],[data-cam]", $("#filesCard")).forEach(b => b.addEventListener("click", () => pickAndUpload(SECTIONS.find(s => s.key === (b.dataset.up || b.dataset.cam)), !!b.dataset.cam)));
}

wireFiles($("#filesCard"), {
  onDelete: async path => {
    const sec = SECTIONS.find(s => r[s.key].some(f => f.path === path));
    const file = sec && r[sec.key].find(f => f.path === path);
    if (!file) return;
    await modal({
      title: "حذف الملف", danger: true, confirmText: "حذف",
      body: `<p>هل تريد حذف الملف <b dir="ltr">${esc(file.name)}</b>؟</p>`,
      onConfirm: async () => {
        await S.deleteObject(S.ref(storage, path)).catch(e => { if (e.code !== "storage/object-not-found") throw e; });
        await F.updateDoc(ref, { [sec.key]: F.arrayRemove(file), updatedAt: F.serverTimestamp() });
        toast("تم حذف الملف", "success");
      }
    });
  }
});

function pickAndUpload(sec, camera) {
  const input = document.createElement("input");
  input.type = "file";
  if (camera) { input.accept = "image/*"; input.capture = "environment"; } else input.multiple = true;
  input.onchange = async () => {
    const files = [...input.files];
    if (!files.length) return;
    try {
      const metas = await uploadFiles(r.id, sec.folder, files, profile);
      await F.updateDoc(ref, { [sec.key]: F.arrayUnion(...metas), updatedAt: F.serverTimestamp() });
      toast(`تم رفع ${metas.length} ملف`, "success");
    } catch (e) { console.error(e); toast(errMsg(e), "error"); }
  };
  input.click();
}

/* ================= السجل ================= */
function renderTimeline() {
  let items = [...(r.history || [])];
  if (isCompany) items = items.filter(h => COMPANY_VISIBLE_HISTORY.includes(h.action));
  items.reverse();
  $("#timeline").innerHTML = items.map(h => {
    const showNote = h.note && (!isCompany || ["needs_info", "rejected", "approved"].includes(h.action));
    const who = isCompany && h.role !== "company" ? "قسم GIS" : (h.byName || ROLES[h.role] || "");
    return `<li class="t-${esc(h.action)}">
      <strong>${esc(HISTORY_LABELS[h.action] || h.action)}</strong>
      <small><bdi>${esc(who)}</bdi> · <bdi>${esc(fmtDateTime(h.at))}</bdi></small>
      ${showNote ? `<p>${esc(h.note)}</p>` : ""}
    </li>`;
  }).join("") || `<li><small>لا يوجد سجل</small></li>`;
}

/* ================= الإجراءات ================= */
async function update(data, historyEntry) {
  await F.updateDoc(ref, {
    ...data,
    ...(historyEntry ? { history: F.arrayUnion(historyEntry) } : {}),
    updatedAt: F.serverTimestamp()
  });
}
const link = () => `request.html?id=${r.id}`;
const btn = (id, cls, ic, label) => `<button class="btn ${cls}" id="${id}">${ic ? icon(ic) : ""} ${label}</button>`;

function renderActions() {
  const box = $("#actionsCard");
  const set = (title, text, html = "") => { box.innerHTML = `<h3>${title}</h3><p>${text}</p><div class="actions">${html}</div>`; };
  const on = (id, fn) => { const el = $("#" + id); if (el) el.onclick = () => fn(el); };

  /* ---------- GIS ---------- */
  if (isGis) {
    const s = r.status;
    if (s === "new") {
      set("مراجعة الطلب", "راجع بيانات الطلب وملفات الشركة، ثم اختر الإجراء المناسب.",
        btn("aAccept", "btn-success", "check", "قبول وبدء العمل") +
        `<div class="row">${btn("aNeeds", "btn-warn", "undo", "طلب استكمال")}${btn("aReject", "btn-outline-danger", "ban", "رفض")}</div>`);
    } else if (s === "needs_info") {
      set("بانتظار الشركة", "تم إرجاع الطلب للشركة لاستكمال النواقص. سيصلك إشعار عند إعادة الإرسال.",
        `<div class="row">${btn("aAccept", "btn-ghost", "check", "قبول كما هو")}${btn("aReject", "btn-outline-danger", "ban", "رفض")}</div>`);
    } else if (s === "gis_work") {
      set("العمل على الطلب", "نزّل ملفات الشركة واعمل على الخرائط، ثم ارفعها في قسم «ملفات GIS» وأرسل الطلب للصيانة.",
        btn("aSendMaint", "btn-primary", "send", "إرسال لقسم الصيانة") +
        `<div class="row">${btn("aNeeds", "btn-warn", "undo", "طلب استكمال")}${btn("aReject", "btn-outline-danger", "ban", "رفض")}</div>`);
    } else if (s === "maintenance") {
      set("الطلب عند الصيانة", "سيصلك إشعار عندما تنهي الصيانة العمل وترجع الطلب.", "");
    } else if (s === "gis_review") {
      set("مراجعة عمل الصيانة", "راجع صور وملفات الصيانة وملاحظاتهم، ثم اعتمد الطلب للشركة أو أرجعه.",
        btn("aApprove", "btn-success", "check", "موافقة وإرسال للشركة") +
        `<div class="row">${btn("aReturn", "btn-warn", "undo", "إرجاع للصيانة")}${btn("aReject", "btn-outline-danger", "ban", "رفض")}</div>`);
    } else {
      set("الطلب مغلق", s === "approved" ? "تم اعتماد الطلب وإرساله للشركة." : "تم رفض الطلب وإبلاغ الشركة.",
        btn("aReopen", "btn-ghost", "undo", "إعادة فتح الطلب"));
    }
    box.insertAdjacentHTML("beforeend", `<div style="margin-top:14px;text-align:center"><button class="link-btn" id="aDelete" style="color:var(--danger)">حذف الطلب نهائياً</button></div>`);

    on("aAccept", () => modal({
      title: "قبول الطلب", success: true, confirmText: "قبول وبدء العمل",
      body: `<p>سيتم تحويل الطلب #${esc(r.number)} إلى «قيد العمل في GIS» وإبلاغ الشركة.</p>`,
      onConfirm: async () => {
        await update({ status: "gis_work", companyNote: "" }, hist(profile, "accepted"));
        await notify({ toUid: r.companyId, title: `تم قبول طلبك #${r.number}`, body: "بدأ قسم GIS العمل على طلبك", link: link() });
        toast("تم قبول الطلب", "success");
      }
    }));
    on("aNeeds", () => askNote({
      title: "طلب استكمال من الشركة", label: "ما الناقص؟ (ستظهر للشركة)", placeholder: "مثال: المخطط المرفق غير واضح، الرجاء رفع نسخة بصيغة DWG",
      confirmText: "إرسال للشركة",
      onConfirm: async note => {
        await update({ status: "needs_info", companyNote: note }, hist(profile, "needs_info", note));
        await notify({ toUid: r.companyId, title: `مطلوب استكمال الطلب #${r.number}`, body: note, link: link() });
        toast("تم إرجاع الطلب للشركة", "success");
      }
    }));
    on("aReject", () => askNote({
      title: "رفض الطلب", label: "سبب الرفض (سيظهر للشركة)", danger: true, confirmText: "رفض الطلب",
      onConfirm: async note => {
        await update({ status: "rejected", companyNote: note }, hist(profile, "rejected", note));
        await notify({ toUid: r.companyId, title: `تم رفض الطلب #${r.number}`, body: note, link: link() });
        if (r.maintVisible) await notify({ toRole: "maintenance", title: `تم رفض الطلب #${r.number}`, body: "أغلق قسم GIS الطلب", link: link() });
        toast("تم رفض الطلب", "success");
      }
    }));
    on("aSendMaint", () => {
      if (!r.gisFiles.length) { toast("ارفع ملفات GIS أولاً قبل الإرسال للصيانة", "error"); $('[data-sec="gisFiles"]')?.scrollIntoView({ behavior: "smooth" }); return; }
      askNote({
        title: "إرسال لقسم الصيانة", label: "تعليمات للصيانة (اختياري)", required: false, confirmText: "إرسال",
        placeholder: "مثال: تنفيذ الرفع الميداني حسب الخريطة المرفقة",
        onConfirm: async note => {
          await update({ status: "maintenance", maintVisible: true, maintInstructions: note }, hist(profile, "sent_maint", note));
          await notify({ toRole: "maintenance", title: `طلب جديد #${r.number} من GIS`, body: `${r.type} — ${r.companyName}`, link: link() });
          toast("تم الإرسال لقسم الصيانة", "success");
        }
      });
    });
    on("aReturn", () => askNote({
      title: "إرجاع للصيانة", label: "ما المطلوب تعديله؟", confirmText: "إرجاع للصيانة",
      onConfirm: async note => {
        await update({ status: "maintenance", maintInstructions: note }, hist(profile, "returned_maint", note));
        await notify({ toRole: "maintenance", title: `GIS أرجع الطلب #${r.number} للتعديل`, body: note, link: link() });
        toast("تم إرجاع الطلب للصيانة", "success");
      }
    }));
    on("aApprove", approveFlow);
    on("aReopen", () => modal({
      title: "إعادة فتح الطلب", confirmText: "إعادة الفتح",
      body: `<p>سيعود الطلب إلى «قيد العمل في GIS».</p>`,
      onConfirm: async () => { await update({ status: "gis_work" }, hist(profile, "reopened")); toast("تمت إعادة فتح الطلب", "success"); }
    }));
    on("aDelete", () => modal({
      title: "حذف الطلب نهائياً", danger: true, confirmText: "حذف نهائي",
      body: `<p>سيتم حذف الطلب #${esc(r.number)} وكل ملفاته. لا يمكن التراجع عن هذا الإجراء.</p>`,
      onConfirm: async () => {
        const all = [...r.companyFiles, ...r.gisFiles, ...r.maintFiles, ...r.finalFiles];
        const uniq = [...new Set(all.map(f => f.path))];
        await Promise.all(uniq.map(p => S.deleteObject(S.ref(storage, p)).catch(() => {})));
        await F.deleteDoc(ref);
        location.replace("gis.html");
      }
    }));
    return;
  }

  /* ---------- الصيانة ---------- */
  if (isMaint) {
    if (r.status === "maintenance") {
      box.innerHTML = `
        <h3>تنفيذ العمل</h3>
        <p>نزّل خرائط GIS، نفّذ العمل، ثم ارفع الصور والملفات في قسم «ملفات وصور الصيانة» واكتب ملاحظاتك.</p>
        <label class="field"><span>ملاحظات الصيانة</span><textarea id="mNotes" rows="4" placeholder="مثال: تم تنفيذ الرفع الميداني حسب المخطط">${esc(r.maintNotes || "")}</textarea></label>
        <div class="actions">
          ${btn("mDone", "btn-success", "send", "إنهاء وإرسال لـ GIS")}
          ${btn("mSave", "btn-ghost", "", "حفظ الملاحظات فقط")}
        </div>`;
      on("mSave", async b => {
        busy(b, true);
        try { await update({ maintNotes: $("#mNotes").value.trim() }); toast("تم حفظ الملاحظات", "success"); }
        catch (e) { toast(errMsg(e), "error"); } finally { busy(b, false); }
      });
      on("mDone", () => {
        const notes = $("#mNotes").value.trim();
        if (!notes && !r.maintFiles.length) { toast("ارفع صوراً أو اكتب ملاحظات قبل الإنهاء", "error"); return; }
        modal({
          title: "إنهاء العمل", success: true, confirmText: "إرسال لـ GIS",
          body: `<p>سيتم إرسال الطلب #${esc(r.number)} إلى GIS للمراجعة مع ${r.maintFiles.length} ملف.</p>`,
          onConfirm: async () => {
            await update({ status: "gis_review", maintNotes: notes }, hist(profile, "maint_done", notes));
            await notify({ toRole: "gis", title: `أنهت الصيانة الطلب #${r.number}`, body: "بانتظار مراجعتك", link: link() });
            toast("تم الإرسال لـ GIS", "success");
          }
        });
      });
    } else {
      const t = { gis_review: ["بانتظار مراجعة GIS", "أرسلت العمل لقسم GIS. سيصلك إشعار إذا تم إرجاعه للتعديل."],
                  approved: ["تم اعتماد العمل", "اعتمد قسم GIS هذا الطلب وأغلقه."],
                  rejected: ["الطلب مغلق", "تم رفض هذا الطلب من قسم GIS."] }[r.status] || ["", ""];
      set(t[0], t[1]);
    }
    return;
  }

  /* ---------- الشركة ---------- */
  if (isCompany) {
    if (r.status === "needs_info" || r.status === "new") {
      const needs = r.status === "needs_info";
      box.innerHTML = `
        <h3>${needs ? "استكمال الطلب" : "بانتظار مراجعة GIS"}</h3>
        <p>${needs ? "عدّل الوصف أو أرفق الملفات الناقصة ثم أعد إرسال الطلب." : "تم استلام طلبك. يمكنك إضافة ملفات أو تعديل الوصف قبل أن يبدأ GIS العمل."}</p>
        <div id="editBox" ${needs ? "" : "hidden"}>
          <label class="field"><span>وصف الطلب</span><textarea id="cDesc" rows="4">${esc(r.description)}</textarea></label>
          <div id="cPicker"></div>
        </div>
        <div class="actions">
          ${needs ? btn("cResubmit", "btn-primary", "send", "إعادة إرسال الطلب") : btn("cEdit", "btn-ghost", "", "تعديل / إضافة ملفات") + btn("cSave", "btn-primary", "check", "حفظ التعديلات")}
        </div>`;
      const picker = filePicker($("#cPicker"), { label: "إضافة ملفات" });
      $("#cSave") && ($("#cSave").hidden = true);
      on("cEdit", b => { $("#editBox").hidden = false; b.hidden = true; $("#cSave").hidden = false; });
      const save = async (b, resubmit) => {
        const desc = $("#cDesc").value.trim();
        if (!desc) { toast("اكتب وصف الطلب", "error"); return; }
        busy(b, true);
        try {
          const metas = await uploadFiles(r.id, "company", picker.files, profile);
          const data = { description: desc, status: "new" };
          if (metas.length) data.companyFiles = F.arrayUnion(...metas);
          await update(data, hist(profile, resubmit ? "resubmitted" : "edited"));
          await notify({
            toRole: "gis",
            title: resubmit ? `أعادت ${r.companyName} إرسال الطلب #${r.number}` : `تحديث على الطلب #${r.number}`,
            body: metas.length ? `تمت إضافة ${metas.length} ملف` : "تم تعديل الوصف",
            link: link()
          });
          picker.clear();
          toast(resubmit ? "تم إعادة إرسال الطلب" : "تم حفظ التعديلات", "success");
          lastActionKey = ""; renderActions();
        } catch (e) { console.error(e); toast(errMsg(e), "error"); busy(b, false); }
      };
      on("cResubmit", b => save(b, true));
      on("cSave", b => save(b, false));
    } else if (["gis_work", "maintenance", "gis_review"].includes(r.status)) {
      set("طلبك قيد المعالجة", "يعمل قسم GIS على طلبك حالياً. سيصلك إشعار عند الاعتماد.");
    } else if (r.status === "approved") {
      set("تم اعتماد طلبك", "يمكنك تنزيل الملفات النهائية من قسم الملفات.");
    } else {
      set("تم رفض الطلب", "راجع سبب الرفض أعلاه، ويمكنك تقديم طلب جديد.", `<a class="btn btn-primary" href="company.html#new">${icon("plus")} طلب جديد</a>`);
    }
  }
}

/* ---------- اعتماد الطلب وإرسال الملفات للشركة ---------- */
function approveFlow() {
  const candidates = [
    ...r.gisFiles.map(f => ({ ...f, _src: "GIS" })),
    ...r.maintFiles.map(f => ({ ...f, _src: "الصيانة" }))
  ];
  let picker;
  modal({
    title: `اعتماد الطلب #${r.number}`, success: true, confirmText: "اعتماد وإرسال للشركة", wide: true,
    body: `
      <h4>الملفات التي ستصل للشركة</h4>
      ${candidates.length ? `<p class="muted" style="font-size:13px;margin-bottom:8px">ألغِ تحديد أي ملف لا تريد مشاركته</p>${filesHTML(candidates, { selectable: true })}` : `<p class="muted">لا توجد ملفات من GIS أو الصيانة</p>`}
      <h4>ملفات نهائية إضافية (اختياري)</h4>
      <div id="apPicker"></div>
      <label class="field"><span>ملاحظة للشركة (اختياري)</span><textarea rows="3" id="apNote" placeholder="مثال: تم إنجاز الرفع الميداني، ومرفق المخطط النهائي"></textarea></label>`,
    onOpen: bd => {
      picker = filePicker($("#apPicker", bd), { label: "إضافة ملفات" });
      wireFiles($(".modal-body", bd));
    },
    onConfirm: async bd => {
      const chosen = new Set($$(".file-check:checked", bd).map(c => c.value));
      const shared = candidates.filter(f => chosen.has(f.path)).map(({ _src, ...f }) => f);
      if (!shared.length && !picker.files.length && !confirm("لن يتم إرسال أي ملف للشركة. هل تريد المتابعة؟")) return false;
      const extra = await uploadFiles(r.id, "final", picker.files, profile, "جارٍ رفع الملفات النهائية…");
      const note = $("#apNote", bd).value.trim();
      await update({
        status: "approved",
        companyNote: note,
        finalFiles: [...shared, ...extra],
        sharedPaths: shared.map(f => f.path)
      }, hist(profile, "approved", note));
      await notify({ toUid: r.companyId, title: `تم اعتماد طلبك #${r.number}`, body: note || "الملفات النهائية متاحة للتنزيل", link: link() });
      await notify({ toRole: "maintenance", title: `تم اعتماد الطلب #${r.number}`, body: "اعتمد GIS العمل وأغلق الطلب", link: link() });
      toast("تم اعتماد الطلب وإرساله للشركة", "success");
    }
  });
}
