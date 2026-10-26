// واجهة قسم الصيانة
import { db, F, $, $$, toast, errMsg, requireAuth, renderShell, hideBoot, requestCard, emptyState, byDateDesc, t, watchSla, overdueInfo } from "./core.js";

const { profile } = await requireAuth(["maintenance"]);
renderShell(profile, { title: t("قسم الصيانة"), subtitle: profile.orgName });

const GROUPS = {
  current:  { label: t("قيد التنفيذ"),       match: r => r.status === "maintenance" },
  review:   { label: t("بانتظار مراجعة GIS"), match: r => !r.archived && r.status === "gis_review" },
  done:     { label: t("مكتملة"),            match: r => !r.archived && r.status === "approved" },
  closed:   { label: t("مرفوضة / أخرى"),      match: r => !r.archived && !["maintenance", "gis_review", "approved"].includes(r.status) },
  all:      { label: t("الكل"),              match: r => !r.archived },
  archived: { label: t("الأرشيف"),           match: r => !!r.archived }
};
let filter = "current";
let requests = [];
let sla = null;

function render() {
  const c = k => requests.filter(GROUPS[k].match).length;
  $("#stats").innerHTML = `
    <button class="stat purple" data-f="current"><b>${c("current")}</b><span>${t("قيد التنفيذ")}</span></button>
    <button class="stat teal" data-f="review"><b>${c("review")}</b><span>${t("عند GIS للمراجعة")}</span></button>
    <button class="stat green" data-f="done"><b>${c("done")}</b><span>${t("مكتملة")}</span></button>
    <button class="stat blue" data-f="all"><b>${c("all")}</b><span>${t("كل الطلبات")}</span></button>`;
  $("#tabs").innerHTML = Object.entries(GROUPS).map(([k, g]) =>
    `<button class="tab ${k === filter ? "active" : ""}" data-f="${k}">${g.label} <span class="n">${c(k)}</span></button>`).join("");
  const list = requests.filter(GROUPS[filter].match);
  $("#list").innerHTML = list.length ? list.map(r => requestCard(r, { sla })).join("")
    : emptyState(filter === "current" ? t("لا توجد طلبات بانتظار التنفيذ") : t("لا توجد طلبات"));
  $$("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
}

// الطلبات المحوّلة لهذا الفريق + الطلبات المحوّلة لكل فرق الصيانة
let mine = [], shared = [], loaded = 0;
const merge = () => {
  const map = new Map([...shared, ...mine].map(r => [r.id, r]));
  requests = [...map.values()].sort(byDateDesc);
  render();
  if (++loaded >= 2) hideBoot();
};
const col = F.collection(db, "requests");
const onErr = e => { toast(errMsg(e), "error"); hideBoot(); };
F.onSnapshot(F.query(col, F.where("maintVisible", "==", true), F.where("maintTeamId", "==", profile.id)),
  snap => { mine = snap.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }, onErr);
F.onSnapshot(F.query(col, F.where("maintVisible", "==", true), F.where("maintTeamId", "==", "")),
  snap => { shared = snap.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }, onErr);
watchSla(v => { sla = v; render(); });
