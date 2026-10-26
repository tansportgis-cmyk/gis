// تفاصيل الطلب — مشتركة بين الشركة و GIS والصيانة، والإجراءات تتغير حسب الدور والحالة
import {
  db, storage, F, S, $, $$, esc, icon, toast, busy, errMsg, requireAuth, renderShell, hideBoot,
  chip, homeFor, fmtDate, fmtDateTime, HISTORY_LABELS, COMPANY_VISIBLE_HISTORY,
  filesHTML, wireFiles, hydrateThumbs, filePicker, uploadFiles, viewMap, gmapsLink,
  modal, askNote, notify, hist, ROLES, t, fmtSize, APP
} from "./core.js";

const { profile } = await requireAuth(["company", "gis", "maintenance"]);
const role = profile.role;
const isGis = role === "gis", isCompany = role === "company", isMaint = role === "maintenance";
const id = new URLSearchParams(location.search).get("id");
renderShell(profile, { title: t("تفاصيل الطلب"), back: homeFor(role) });

if (!id) { location.replace(homeFor(role)); }
const ref = F.doc(db, "requests", id);
let r = null;
let lastActionKey = "";
let mapInstance = null;

if (new URLSearchParams(location.search).get("sent")) {
  $("#banner").innerHTML = `<div class="alert success">${icon("check")}<div><b>${t("تم إرسال الطلب بنجاح")}</b><p>${t("سيتم مراجعته من قسم GIS وستصلك الإشعارات عند أي تحديث.")}</p></div></div>`;
  history.replaceState(null, "", `request.html?id=${encodeURIComponent(id)}`);
}

F.onSnapshot(ref, snap => {
  if (!snap.exists()) {
    $("#main").innerHTML = `<div class="empty">${icon("inbox")}<strong>${t("الطلب غير موجود")}</strong><a class="btn btn-primary" href="${homeFor(role)}">${t("العودة")}</a></div>`;
    hideBoot(); return;
  }
  r = { id: snap.id, ...snap.data() };
  r.companyFiles ||= []; r.gisFiles ||= []; r.maintFiles ||= []; r.finalFiles ||= []; r.sharedPaths ||= [];
  $(".tb-title strong").textContent = t("طلب #{n}", { n: r.number });
  document.title = `${t("طلب #{n}", { n: r.number })} — ${t("منصة طلبات GIS")}`;
  renderInfo();
  renderFiles();
  renderTimeline();
  const key = `${r.status}|${!!r.archived}`;
  if (key !== lastActionKey) { lastActionKey = key; renderActions(); }
  hideBoot();
}, e => {
  $("#main").innerHTML = `<div class="empty">${icon("alert")}<strong>${t("تعذر فتح الطلب")}</strong><small>${esc(errMsg(e))}</small><a class="btn btn-primary" href="${homeFor(role)}">${t("العودة")}</a></div>`;
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
    return `<div class="step ${cls} ${last ? "final" : ""}"><span class="dot">${cls === "done" ? icon("check") : ""}</span>${t(s[0])}</div>`;
  }).join("")}</div>`;
}

function alertsHTML() {
  const out = [];
  const note = r.companyNote ? `<p>${esc(r.companyNote)}</p>` : "";
  if (r.status === "needs_info") out.push(`<div class="alert warn">${icon("alert")}<div><b>${isCompany ? t("مطلوب منك استكمال الطلب") : t("بانتظار استكمال الشركة")}</b>${note}</div></div>`);
  if (r.status === "rejected") out.push(`<div class="alert danger">${icon("ban")}<div><b>${t("تم رفض الطلب")}</b>${note}</div></div>`);
  if (r.status === "approved" && (isCompany || isGis)) out.push(`<div class="alert success">${icon("check")}<div><b>${t("تم اعتماد الطلب")}</b>${note || (isCompany ? `<p>${t("الملفات النهائية متاحة في قسم الملفات أدناه.")}</p>` : "")}</div></div>`);
  if ((isMaint || isGis) && r.maintInstructions && ["maintenance", "gis_review"].includes(r.status))
    out.push(`<div class="alert purple">${icon("wrench")}<div><b>${t("تعليمات GIS للصيانة")}</b><p>${esc(r.maintInstructions)}</p></div></div>`);
  if ((isMaint || isGis) && r.maintNotes && r.status !== "maintenance")
    out.push(`<div class="alert info">${icon("file")}<div><b>${t("ملاحظات الصيانة")}</b><p>${esc(r.maintNotes)}</p></div></div>`);
  return out.join("");
}

function renderInfo() {
  const loc = r.location;
  const contact = !isCompany ? `
    <div class="kv-row">
      <div><dt>${t("الشركة")}</dt><dd>${esc(r.companyName)}</dd></div>
      <div><dt>${t("المسؤول")}</dt><dd>${esc(r.contactName || "—")}${r.contactPhone ? `<br><a href="tel:${esc(r.contactPhone)}" dir="ltr">${esc(r.contactPhone)}</a>` : ""}</dd></div>
    </div>` : "";
  $("#infoCard").innerHTML = `
    <div class="req-head"><h1>${t("طلب #{n}", { n: esc(r.number) })}</h1>
      <span class="chips">${r.archived ? `<span class="chip st-muted">${t("مؤرشف")}</span>` : ""}${chip(r.status, isCompany)}
        <button class="btn btn-ghost btn-sm" id="printBtn" type="button">${icon("file")} ${t("طباعة")}</button></span></div>
    <small class="muted">${esc(fmtDateTime(r.createdAt))}</small>
    ${stepperHTML()}
    <div style="margin-top:14px">${alertsHTML()}</div>
    <dl class="kv">
      <div><dt>${t("نوع الطلب")}</dt><dd>${esc(t(r.type || ""))}</dd></div>
      <div><dt>${t("وصف الطلب")}</dt><dd>${esc(r.description)}</dd></div>
      ${contact}
      <div><dt>${t("الموقع")}</dt><dd>${loc ? `<a href="${gmapsLink(loc)}" target="_blank" rel="noopener">${icon("external")} ${t("فتح في خرائط Google")}</a>` : t("لم يتم تحديد موقع")}</dd></div>
    </dl>
    ${loc ? `<div class="map" id="viewMap" style="margin-top:10px"></div>` : ""}`;
  $("#printBtn").onclick = printRequest;
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
        <h3>${icon(s.ic)} ${t(s.title)} <span class="count">${r[s.key].length}</span></h3>
        ${s.canUpload?.() ? `
          <div style="display:flex;gap:6px">
            ${s.camera ? `<button class="btn btn-outline btn-sm" data-cam="${s.key}">${icon("camera")} ${t("تصوير")}</button>` : ""}
            <button class="btn btn-primary btn-sm" data-up="${s.key}">${icon("upload")} ${t("رفع")}</button>
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
      title: t("حذف الملف"), danger: true, confirmText: t("حذف"),
      body: `<p>${t("هل تريد حذف الملف <b>{name}</b>؟", { name: `<bdi>${esc(file.name)}</bdi>` })}</p>`,
      onConfirm: async () => {
        await S.deleteObject(S.ref(storage, path)).catch(e => { if (e.code !== "storage/object-not-found") throw e; });
        await F.updateDoc(ref, { [sec.key]: F.arrayRemove(file), history: F.arrayUnion(hist(profile, "file_deleted", file.name)), updatedAt: F.serverTimestamp() });
        toast(t("تم حذف الملف"), "success");
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
      await F.updateDoc(ref, {
        [sec.key]: F.arrayUnion(...metas),
        history: F.arrayUnion(hist(profile, `files_${sec.folder}`, metas.map(m => m.name).join("، "))),
        updatedAt: F.serverTimestamp()
      });
      toast(t("تم رفع {n} ملف", { n: metas.length }), "success");
    } catch (e) { console.error(e); toast(errMsg(e), "error"); }
  };
  input.click();
}

/* ================= السجل ================= */
// أحداث السجل التي يراها المستخدم الحالي
function timelineItems() {
  let items = [...(r.history || [])];
  if (isCompany) items = items.filter(h => COMPANY_VISIBLE_HISTORY.includes(h.action));
  return items.map(h => ({
    ...h,
    who: isCompany && h.role !== "company" ? t("قسم GIS") : (h.byName || ROLES[h.role] || ""),
    showNote: !!h.note && (!isCompany || ["needs_info", "rejected", "approved"].includes(h.action))
  }));
}
function renderTimeline() {
  const items = timelineItems().reverse();
  $("#timeline").innerHTML = items.map(h => {
    const { showNote, who } = h;
    return `<li class="t-${esc(h.action)}">
      <strong>${esc(t(HISTORY_LABELS[h.action] || h.action))}</strong>
      <small><bdi>${esc(who)}</bdi> · <bdi>${esc(fmtDateTime(h.at))}</bdi></small>
      ${showNote ? `<p>${esc(h.note)}</p>` : ""}
    </li>`;
  }).join("") || `<li><small>${t("لا يوجد سجل")}</small></li>`;
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
  const set = (title, text, html = "") => { box.innerHTML = `<h3>${t(title)}</h3><p>${t(text)}</p><div class="actions">${html}</div>`; };
  const on = (id, fn) => { const el = $("#" + id); if (el) el.onclick = () => fn(el); };

  /* ---------- GIS ---------- */
  if (isGis) {
    const s = r.status;
    if (s === "new") {
      set("مراجعة الطلب", "راجع بيانات الطلب وملفات الشركة، ثم اختر الإجراء المناسب.",
        btn("aAccept", "btn-success", "check", t("قبول وبدء العمل")) +
        `<div class="row">${btn("aNeeds", "btn-warn", "undo", t("طلب استكمال"))}${btn("aReject", "btn-outline-danger", "ban", t("رفض"))}</div>`);
    } else if (s === "needs_info") {
      set("بانتظار الشركة", "تم إرجاع الطلب للشركة لاستكمال النواقص. سيصلك إشعار عند إعادة الإرسال.",
        `<div class="row">${btn("aAccept", "btn-ghost", "check", t("قبول كما هو"))}${btn("aReject", "btn-outline-danger", "ban", t("رفض"))}</div>`);
    } else if (s === "gis_work") {
      set("العمل على الطلب", "نزّل ملفات الشركة واعمل على الخرائط، ثم ارفعها في قسم «ملفات GIS» وأرسل الطلب للصيانة.",
        btn("aSendMaint", "btn-primary", "send", t("إرسال لقسم الصيانة")) +
        `<div class="row">${btn("aNeeds", "btn-warn", "undo", t("طلب استكمال"))}${btn("aReject", "btn-outline-danger", "ban", t("رفض"))}</div>`);
    } else if (s === "maintenance") {
      set("الطلب عند الصيانة", "سيصلك إشعار عندما تنهي الصيانة العمل وترجع الطلب.", "");
    } else if (s === "gis_review") {
      set("مراجعة عمل الصيانة", "راجع صور وملفات الصيانة وملاحظاتهم، ثم اعتمد الطلب للشركة أو أرجعه.",
        btn("aApprove", "btn-success", "check", t("موافقة وإرسال للشركة")) +
        `<div class="row">${btn("aReturn", "btn-warn", "undo", t("إرجاع للصيانة"))}${btn("aReject", "btn-outline-danger", "ban", t("رفض"))}</div>`);
    } else {
      set("الطلب مغلق", s === "approved" ? "تم اعتماد الطلب وإرساله للشركة." : "تم رفض الطلب وإبلاغ الشركة.",
        `<div class="row">${btn("aReopen", "btn-ghost", "undo", t("إعادة فتح الطلب"))}${btn("aArchive", "btn-ghost", "inbox", r.archived ? t("إخراج من الأرشيف") : t("أرشفة الطلب"))}</div>`);
    }
    box.insertAdjacentHTML("beforeend", `<div style="margin-top:14px;text-align:center"><button class="link-btn" id="aDelete" style="color:var(--danger)">${t("حذف الطلب نهائياً")}</button></div>`);

    on("aAccept", () => modal({
      title: t("قبول الطلب"), success: true, confirmText: t("قبول وبدء العمل"),
      body: `<p>${t("سيتم تحويل الطلب #{n} إلى «قيد العمل في GIS» وإبلاغ الشركة.", { n: esc(r.number) })}</p>`,
      onConfirm: async () => {
        await update({ status: "gis_work", companyNote: "" }, hist(profile, "accepted"));
        await notify({ toUid: r.companyId, title: "تم قبول طلبك #{n}", tp: { n: r.number }, body: "بدأ قسم GIS العمل على طلبك", link: link() });
        toast(t("تم قبول الطلب"), "success");
      }
    }));
    on("aNeeds", () => askNote({
      title: t("طلب استكمال من الشركة"), label: t("ما الناقص؟ (ستظهر للشركة)"), placeholder: t("مثال: المخطط المرفق غير واضح، الرجاء رفع نسخة بصيغة DWG"),
      confirmText: t("إرسال للشركة"),
      onConfirm: async note => {
        await update({ status: "needs_info", companyNote: note }, hist(profile, "needs_info", note));
        await notify({ toUid: r.companyId, title: "مطلوب استكمال الطلب #{n}", tp: { n: r.number }, body: note, link: link() });
        toast(t("تم إرجاع الطلب للشركة"), "success");
      }
    }));
    on("aReject", () => askNote({
      title: t("رفض الطلب"), label: t("سبب الرفض (سيظهر للشركة)"), danger: true, confirmText: t("رفض الطلب"),
      onConfirm: async note => {
        await update({ status: "rejected", companyNote: note }, hist(profile, "rejected", note));
        await notify({ toUid: r.companyId, title: "تم رفض الطلب #{n}", tp: { n: r.number }, body: note, link: link() });
        if (r.maintVisible) await notify({ toRole: "maintenance", title: "تم رفض الطلب #{n}", tp: { n: r.number }, body: "أغلق قسم GIS الطلب", link: link() });
        toast(t("تم رفض الطلب"), "success");
      }
    }));
    on("aSendMaint", () => {
      if (!r.gisFiles.length) { toast(t("ارفع ملفات GIS أولاً قبل الإرسال للصيانة"), "error"); $('[data-sec="gisFiles"]')?.scrollIntoView({ behavior: "smooth" }); return; }
      askNote({
        title: t("إرسال لقسم الصيانة"), label: t("تعليمات للصيانة (اختياري)"), required: false, confirmText: t("إرسال"),
        placeholder: t("مثال: تنفيذ الرفع الميداني حسب الخريطة المرفقة"),
        onConfirm: async note => {
          await update({ status: "maintenance", maintVisible: true, maintInstructions: note }, hist(profile, "sent_maint", note));
          await notify({ toRole: "maintenance", title: "طلب جديد #{n} من GIS", tp: { n: r.number }, body: "{type} — {org}", bp: { type: r.type, org: r.companyName }, link: link() });
          toast(t("تم الإرسال لقسم الصيانة"), "success");
        }
      });
    });
    on("aReturn", () => askNote({
      title: t("إرجاع للصيانة"), label: t("ما المطلوب تعديله؟"), confirmText: t("إرجاع للصيانة"),
      onConfirm: async note => {
        await update({ status: "maintenance", maintInstructions: note }, hist(profile, "returned_maint", note));
        await notify({ toRole: "maintenance", title: "GIS أرجع الطلب #{n} للتعديل", tp: { n: r.number }, body: note, link: link() });
        toast(t("تم إرجاع الطلب للصيانة"), "success");
      }
    }));
    on("aApprove", approveFlow);
    on("aReopen", () => modal({
      title: t("إعادة فتح الطلب"), confirmText: t("إعادة الفتح"),
      body: `<p>${t("سيعود الطلب إلى «قيد العمل في GIS».")}</p>`,
      onConfirm: async () => { await update({ status: "gis_work", archived: false }, hist(profile, "reopened")); toast(t("تمت إعادة فتح الطلب"), "success"); }
    }));
    on("aArchive", () => modal({
      title: r.archived ? t("إخراج من الأرشيف") : t("أرشفة الطلب"), confirmText: r.archived ? t("إخراج من الأرشيف") : t("أرشفة"),
      body: `<p>${r.archived ? t("سيعود الطلب للظهور في القوائم الرئيسية.") : t("سينتقل الطلب إلى الأرشيف ويختفي من القوائم الرئيسية. تبقى كل بياناته وملفاته.")}</p>`,
      onConfirm: async () => {
        const arch = !r.archived;
        await update({ archived: arch, archivedAt: arch ? F.serverTimestamp() : F.deleteField() }, hist(profile, arch ? "archived" : "unarchived"));
        toast(arch ? t("تمت أرشفة الطلب") : t("تم إخراج الطلب من الأرشيف"), "success");
      }
    }));
    on("aDelete", () => modal({
      title: t("حذف الطلب نهائياً"), danger: true, confirmText: t("حذف نهائي"),
      body: `<p>${t("سيتم حذف الطلب #{n} وكل ملفاته. لا يمكن التراجع عن هذا الإجراء.", { n: esc(r.number) })}</p>`,
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
        <h3>${t("تنفيذ العمل")}</h3>
        <p>${t("نزّل خرائط GIS، نفّذ العمل، ثم ارفع الصور والملفات في قسم «ملفات وصور الصيانة» واكتب ملاحظاتك.")}</p>
        <label class="field"><span>${t("ملاحظات الصيانة")}</span><textarea id="mNotes" rows="4" placeholder="${t("مثال: تم تنفيذ الرفع الميداني حسب المخطط")}">${esc(r.maintNotes || "")}</textarea></label>
        <div class="actions">
          ${btn("mDone", "btn-success", "send", t("إنهاء وإرسال لـ GIS"))}
          ${btn("mSave", "btn-ghost", "", t("حفظ الملاحظات فقط"))}
        </div>`;
      on("mSave", async b => {
        busy(b, true);
        try { await update({ maintNotes: $("#mNotes").value.trim() }); toast(t("تم حفظ الملاحظات"), "success"); }
        catch (e) { toast(errMsg(e), "error"); } finally { busy(b, false); }
      });
      on("mDone", () => {
        const notes = $("#mNotes").value.trim();
        if (!notes && !r.maintFiles.length) { toast(t("ارفع صوراً أو اكتب ملاحظات قبل الإنهاء"), "error"); return; }
        modal({
          title: t("إنهاء العمل"), success: true, confirmText: t("إرسال لـ GIS"),
          body: `<p>${t("سيتم إرسال الطلب #{n} إلى GIS للمراجعة مع {c} ملف.", { n: esc(r.number), c: r.maintFiles.length })}</p>`,
          onConfirm: async () => {
            await update({ status: "gis_review", maintNotes: notes }, hist(profile, "maint_done", notes));
            await notify({ toRole: "gis", title: "أنهت الصيانة الطلب #{n}", tp: { n: r.number }, body: "بانتظار مراجعتك", link: link() });
            toast(t("تم الإرسال لـ GIS"), "success");
          }
        });
      });
    } else {
      const m = { gis_review: ["بانتظار مراجعة GIS", "أرسلت العمل لقسم GIS. سيصلك إشعار إذا تم إرجاعه للتعديل."],
                  approved: ["تم اعتماد العمل", "اعتمد قسم GIS هذا الطلب وأغلقه."],
                  rejected: ["الطلب مغلق", "تم رفض هذا الطلب من قسم GIS."] }[r.status] || ["", ""];
      set(m[0], m[1]);
    }
    return;
  }

  /* ---------- الشركة ---------- */
  if (isCompany) {
    if (r.status === "needs_info" || r.status === "new") {
      const needs = r.status === "needs_info";
      box.innerHTML = `
        <h3>${needs ? t("استكمال الطلب") : t("بانتظار مراجعة GIS")}</h3>
        <p>${needs ? t("عدّل الوصف أو أرفق الملفات الناقصة ثم أعد إرسال الطلب.") : t("تم استلام طلبك. يمكنك إضافة ملفات أو تعديل الوصف قبل أن يبدأ GIS العمل.")}</p>
        <div id="editBox" ${needs ? "" : "hidden"}>
          <label class="field"><span>${t("وصف الطلب")}</span><textarea id="cDesc" rows="4">${esc(r.description)}</textarea></label>
          <div id="cPicker"></div>
        </div>
        <div class="actions">
          ${needs ? btn("cResubmit", "btn-primary", "send", t("إعادة إرسال الطلب")) : btn("cEdit", "btn-ghost", "", t("تعديل / إضافة ملفات")) + btn("cSave", "btn-primary", "check", t("حفظ التعديلات"))}
        </div>`;
      const picker = filePicker($("#cPicker"), { label: t("إضافة ملفات") });
      $("#cSave") && ($("#cSave").hidden = true);
      on("cEdit", b => { $("#editBox").hidden = false; b.hidden = true; $("#cSave").hidden = false; });
      const save = async (b, resubmit) => {
        const desc = $("#cDesc").value.trim();
        if (!desc) { toast(t("اكتب وصف الطلب"), "error"); return; }
        busy(b, true);
        try {
          const metas = await uploadFiles(r.id, "company", picker.files, profile);
          const data = { description: desc, status: "new" };
          if (metas.length) data.companyFiles = F.arrayUnion(...metas);
          await update(data, hist(profile, resubmit ? "resubmitted" : "edited"));
          await notify({
            toRole: "gis",
            title: resubmit ? "أعادت {org} إرسال الطلب #{n}" : "تحديث على الطلب #{n}", tp: { org: r.companyName, n: r.number },
            body: metas.length ? "تمت إضافة {c} ملف" : "تم تعديل الوصف", bp: { c: metas.length },
            link: link()
          });
          picker.clear();
          toast(resubmit ? t("تم إعادة إرسال الطلب") : t("تم حفظ التعديلات"), "success");
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
      set("تم رفض الطلب", "راجع سبب الرفض أعلاه، ويمكنك تقديم طلب جديد.", `<a class="btn btn-primary" href="company.html#new">${icon("plus")} ${t("طلب جديد")}</a>`);
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
    title: t("اعتماد الطلب #{n}", { n: r.number }), success: true, confirmText: t("اعتماد وإرسال للشركة"), wide: true,
    body: `
      <h4>${t("الملفات التي ستصل للشركة")}</h4>
      ${candidates.length ? `<p class="muted" style="font-size:13px;margin-bottom:8px">${t("ألغِ تحديد أي ملف لا تريد مشاركته")}</p>${filesHTML(candidates, { selectable: true })}` : `<p class="muted">${t("لا توجد ملفات من GIS أو الصيانة")}</p>`}
      <h4>${t("ملفات نهائية إضافية (اختياري)")}</h4>
      <div id="apPicker"></div>
      <label class="field"><span>${t("ملاحظة للشركة (اختياري)")}</span><textarea rows="3" id="apNote" placeholder="${t("مثال: تم إنجاز الرفع الميداني، ومرفق المخطط النهائي")}"></textarea></label>`,
    onOpen: bd => {
      picker = filePicker($("#apPicker", bd), { label: t("إضافة ملفات") });
      wireFiles($(".modal-body", bd));
    },
    onConfirm: async bd => {
      const chosen = new Set($$(".file-check:checked", bd).map(c => c.value));
      const shared = candidates.filter(f => chosen.has(f.path)).map(({ _src, ...f }) => f);
      if (!shared.length && !picker.files.length && !confirm(t("لن يتم إرسال أي ملف للشركة. هل تريد المتابعة؟"))) return false;
      const extra = await uploadFiles(r.id, "final", picker.files, profile, t("جارٍ رفع الملفات النهائية…"));
      const note = $("#apNote", bd).value.trim();
      await update({
        status: "approved",
        companyNote: note,
        finalFiles: [...shared, ...extra],
        sharedPaths: shared.map(f => f.path)
      }, hist(profile, "approved", note));
      await notify({ toUid: r.companyId, title: "تم اعتماد طلبك #{n}", tp: { n: r.number }, body: note || "الملفات النهائية متاحة للتنزيل", link: link() });
      await notify({ toRole: "maintenance", title: "تم اعتماد الطلب #{n}", tp: { n: r.number }, body: "اعتمد GIS العمل وأغلق الطلب", link: link() });
      toast(t("تم اعتماد الطلب وإرساله للشركة"), "success");
    }
  });
}

/* ================= الطباعة ================= */
function printRequest() {
  let el = $("#printView");
  if (!el) { el = document.createElement("div"); el.id = "printView"; document.body.append(el); }
  const loc = r.location;
  const row = (k, v) => v ? `<tr><th>${esc(k)}</th><td>${v}</td></tr>` : "";
  const status = isCompany && ["gis_work", "maintenance", "gis_review"].includes(r.status) ? t("قيد المعالجة") : t((STATUS_AR[r.status] || r.status));
  const notes = [];
  if (r.companyNote && (isCompany || isGis) && ["needs_info", "rejected", "approved"].includes(r.status)) notes.push([t("ملاحظة GIS للشركة"), r.companyNote]);
  if ((isMaint || isGis) && r.maintInstructions) notes.push([t("تعليمات GIS للصيانة"), r.maintInstructions]);
  if ((isMaint || isGis) && r.maintNotes) notes.push([t("ملاحظات الصيانة"), r.maintNotes]);
  const fileSecs = SECTIONS.filter(sec => sec.show() && r[sec.key].length);
  el.innerHTML = `
    <div class="pv-head">
      <div><div class="pv-brand">${esc(t("منصة طلبات GIS"))}</div><h1>${esc(t("طلب #{n}", { n: r.number }))}</h1></div>
      <div class="pv-meta">
        <div>${esc(t("تاريخ الطباعة"))}: <bdi>${esc(fmtDateTime(new Date()))}</bdi></div>
        <div>${esc(t("بواسطة"))}: <bdi>${esc(profile.orgName || profile.name || profile.email)}</bdi></div>
      </div>
    </div>
    <h2>${esc(t("بيانات الطلب"))}</h2>
    <table class="pv-table">
      ${row(t("الحالة"), esc(status) + (r.archived ? ` (${esc(t("مؤرشف"))})` : ""))}
      ${row(t("نوع الطلب"), esc(t(r.type || "")))}
      ${row(t("تاريخ التقديم"), `<bdi>${esc(fmtDateTime(r.createdAt))}</bdi>`)}
      ${row(t("آخر تحديث"), `<bdi>${esc(fmtDateTime(r.updatedAt))}</bdi>`)}
      ${row(t("الشركة"), esc(r.companyName))}
      ${row(t("المسؤول"), esc(r.contactName || ""))}
      ${row(t("رقم الهاتف"), r.contactPhone ? `<bdi>${esc(r.contactPhone)}</bdi>` : "")}
      ${row(t("البريد الإلكتروني"), r.contactEmail ? `<bdi>${esc(r.contactEmail)}</bdi>` : "")}
      ${row(t("الموقع"), loc ? `<bdi>${loc.lat}, ${loc.lng}</bdi>` : esc(t("لم يتم تحديد موقع")))}
      ${row(t("وصف الطلب"), `<span class="pv-pre">${esc(r.description)}</span>`)}
    </table>
    ${notes.length ? `<h2>${esc(t("الملاحظات"))}</h2><table class="pv-table">${notes.map(([k, v]) => row(k, `<span class="pv-pre">${esc(v)}</span>`)).join("")}</table>` : ""}
    ${fileSecs.length ? `<h2>${esc(t("الملفات المرفقة"))}</h2>
      <table class="pv-table pv-grid"><thead><tr><th>${esc(t("القسم"))}</th><th>${esc(t("اسم الملف"))}</th><th>${esc(t("الحجم"))}</th><th>${esc(t("رفع بواسطة"))}</th><th>${esc(t("التاريخ"))}</th></tr></thead><tbody>
      ${fileSecs.map(sec => r[sec.key].map(f => `<tr><td>${esc(t(sec.title))}</td><td><bdi>${esc(f.name)}</bdi></td><td><bdi>${esc(fmtSize(f.size))}</bdi></td><td>${esc(f.byName || "")}</td><td><bdi>${esc(fmtDate(f.uploadedAt))}</bdi></td></tr>`).join("")).join("")}
      </tbody></table>` : ""}
    <h2>${esc(t("سجل الطلب"))}</h2>
    <table class="pv-table pv-grid"><thead><tr><th>${esc(t("التاريخ والوقت"))}</th><th>${esc(t("الحدث"))}</th><th>${esc(t("بواسطة"))}</th><th>${esc(t("ملاحظة"))}</th></tr></thead><tbody>
      ${timelineItems().map(h => `<tr><td><bdi>${esc(fmtDateTime(h.at))}</bdi></td><td>${esc(t(HISTORY_LABELS[h.action] || h.action))}</td><td>${esc(h.who)}</td><td class="pv-pre">${h.showNote ? esc(h.note) : ""}</td></tr>`).join("")}
    </tbody></table>
    <div class="pv-sign">
      <div><span>${esc(t("اسم المختص"))}</span></div>
      <div><span>${esc(t("التوقيع"))}</span></div>
      <div><span>${esc(t("الختم"))}</span></div>
    </div>`;
  const prevTitle = document.title;
  document.title = `${t("طلب #{n}", { n: r.number })} - ${t("منصة طلبات GIS")}`;
  window.print();
  setTimeout(() => { document.title = prevTitle; }, 500);
}
const STATUS_AR = { new: "جديد", needs_info: "مطلوب استكمال", gis_work: "قيد العمل في GIS", maintenance: "عند الصيانة", gis_review: "مراجعة GIS", approved: "مكتمل", rejected: "مرفوض" };
