// واجهة قسم الصيانة
import { db, F, $, $$, toast, errMsg, requireAuth, renderShell, hideBoot, requestCard, emptyState, byDateDesc, t } from "./core.js";

const { profile } = await requireAuth(["maintenance"]);
renderShell(profile, { title: t("قسم الصيانة"), subtitle: profile.orgName });

const GROUPS = {
  current: { label: t("قيد التنفيذ"),       match: r => r.status === "maintenance" },
  review:  { label: t("بانتظار مراجعة GIS"), match: r => r.status === "gis_review" },
  done:    { label: t("مكتملة"),            match: r => r.status === "approved" },
  closed:  { label: t("مرفوضة / أخرى"),      match: r => !["maintenance", "gis_review", "approved"].includes(r.status) },
  all:     { label: t("الكل"),              match: () => true }
};
let filter = "current";
let requests = [];

function render() {
  const c = k => requests.filter(GROUPS[k].match).length;
  $("#stats").innerHTML = `
    <button class="stat purple" data-f="current"><b>${c("current")}</b><span>${t("قيد التنفيذ")}</span></button>
    <button class="stat teal" data-f="review"><b>${c("review")}</b><span>${t("عند GIS للمراجعة")}</span></button>
    <button class="stat green" data-f="done"><b>${c("done")}</b><span>${t("مكتملة")}</span></button>
    <button class="stat blue" data-f="all"><b>${requests.length}</b><span>${t("كل الطلبات")}</span></button>`;
  $("#tabs").innerHTML = Object.entries(GROUPS).map(([k, g]) =>
    `<button class="tab ${k === filter ? "active" : ""}" data-f="${k}">${g.label} <span class="n">${c(k)}</span></button>`).join("");
  const list = requests.filter(GROUPS[filter].match);
  $("#list").innerHTML = list.length ? list.map(r => requestCard(r)).join("")
    : emptyState(filter === "current" ? t("لا توجد طلبات بانتظار التنفيذ") : t("لا توجد طلبات"));
  $$("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
}

F.onSnapshot(
  F.query(F.collection(db, "requests"), F.where("maintVisible", "==", true)),
  snap => {
    requests = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc);
    render();
    hideBoot();
  },
  e => { toast(errMsg(e), "error"); hideBoot(); }
);
