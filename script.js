var GRADE_PCT = {
  "Apprenti": 0.15,
  "Expert": 0.25,
  "Chef d’équipe": 0.30,
  "Responsable": 0.40,
  "Propriétaire": 0.40
};

var EMP = [
  { id: "arthur", nom: "Arthur Blackwood", grade: "Propriétaire" },
  { id: "rico", nom: "Rico Blackwood", grade: "Responsable" },
  { id: "jack", nom: "Jack Blackwood", grade: "Chef d’équipe" },
  { id: "serge", nom: "Serge Blackwood", grade: "Chef d’équipe" }
];

var LS_KEY = "fiche_paie_entries_v6";      
var LS_LAST_EMP = "fiche_tuners_last_employee";  

var DISCORD_WEBHOOK_FICHE = "https://discordapp.com/api/webhooks/1438918928951672882/3tufNFwGiXhDwFi4nDF8YmIGaz1I1ymGWIpLNoCA3Venv1uIOQkeuod6Zc4mdwBOqtaQ";
var DISCORD_WEBHOOK_ENTREE = "https://discordapp.com/api/webhooks/1438915757898469386/dZ7HjeO-pU4O9y_NL_-KTb7eb8Jjt0ohG-aiZsfb2cCnKG0EruTKq4_buCvYp_3dFkRk";

var ENABLE_DISCORD_LOG_ON_ADD = true;

function $(sel) {
  return document.querySelector(sel);
}

function money(n) {
  var v = Number(n) || 0;
  return v.toLocaleString("fr-CA", {
    style: "currency",
    currency: "CAD"
  });
}

function isoToday() {
  var d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function weekKey(iso) {
  var d = new Date(iso);
  var target = new Date(d.valueOf());
  var dayNr = (d.getDay() + 6) % 7; 
  target.setDate(target.getDate() - dayNr + 3);
  var firstThu = new Date(target.getFullYear(), 0, 4);
  var week =
    1 +
    Math.round(
      ((target - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7
    );
  return target.getFullYear() + "-S" + String(week).padStart(2, "0");
}

function weekRange(iso) {
  var d = new Date(iso || isoToday());
  var day = (d.getDay() + 6) % 7;
  var mon = new Date(d);
  mon.setDate(d.getDate() - day);
  var sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  var f = (x) => x.toLocaleDateString("fr-CA");
  return { start: f(mon), end: f(sun) };
}

function save(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

var entries = load();

var currentPage = 1;
var pageSize = 10;

function initSelectors() {
  var empSel = $("#employeeSelect");

  empSel.innerHTML = EMP.map(
    (e) => `<option value="${e.id}">${e.nom}</option>`
  ).join("");

  var savedEmpId = localStorage.getItem(LS_LAST_EMP);
  if (savedEmpId && EMP.some((e) => e.id === savedEmpId)) {
    empSel.value = savedEmpId;
  } else {
    empSel.selectedIndex = 0;
  }

  $("#dateInput").value = isoToday();

  updateGradeHint();
  render();
}

function updateGradeHint() {
  var selId = $("#employeeSelect").value;

  localStorage.setItem(LS_LAST_EMP, selId);

  var emp = EMP.find((x) => x.id === selId);
  var pct = emp ? GRADE_PCT[emp.grade] || 0 : 0;

  if (emp) {
    $("#employeeGradeText").textContent =
      "Grade: " + emp.grade + " (" + Math.round(pct * 100) + "%)";
  } else {
    $("#employeeGradeText").textContent = "Grade: —";
  }

  computeAndShow();
}

function currentCalc() {
  var selId = $("#employeeSelect").value;
  var emp = EMP.find((x) => x.id === selId);
  var pct = emp ? GRADE_PCT[emp.grade] || 0 : 0;
  var base = Number($("#serviceAmount").value || 0);
  var total = Math.round(base * pct);

  return {
    pct: pct,
    base: base,
    total: total,
    type: $("#serviceType").value,
    emp: emp
  };
}

function computeAndShow() {
  var c = currentCalc();
  $("#totalToPayInput").value = money(c.total);
}

function getFiltered(wk) {
  var q = ($("#searchInput")?.value || "").toLowerCase().trim();

  return entries.filter(function (r) {
    if (weekKey(r.date) !== wk) return false;
    if (!q) return true;

    var hay = (r.empNom + " " + r.grade + " " + r.type).toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

function updateWeekPanel(wk, list) {
  var r = weekRange($("#dateInput").value || isoToday());
  $("#weekKeyText").textContent = wk;
  $("#weekRangeText").textContent = r.start + " → " + r.end;

  var totalBase = 0;
  var totalPay  = 0;
  var rep       = 0;
  var cus       = 0;

  list.forEach(function (row) {
    totalBase += Number(row.base)  || 0;
    totalPay  += Number(row.total) || 0;
    if (row.type === "rep") rep++;
    if (row.type === "cus") cus++;
  });

  var elTotal = $("#weekTotalAmount");
  if (elTotal) elTotal.textContent = money(totalPay);

  var elActions = $("#weekActionsCount");
  if (elActions) elActions.textContent = list.length;

  var elRep = $("#weekRepairsCount");
  if (elRep) elRep.textContent = rep;

  var elCus = $("#weekCustomsCount");
  if (elCus) elCus.textContent = cus;
}

function render() {
  var dateIso = $("#dateInput").value || isoToday();
  var wk = weekKey(dateIso);
  var all = getFiltered(wk);

  var psSelect = $("#pageSizeSelect");
  if (psSelect) {
    var v = parseInt(psSelect.value, 10);
    pageSize = isNaN(v) ? 20 : v;
  }

  var totalPages = all.length === 0 ? 1 : Math.ceil(all.length / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  var start = (currentPage - 1) * pageSize;
  var end = start + pageSize;
  var pageItems = all.slice(start, end);

  updateWeekPanel(wk, all);

  var html = "";

  if (all.length === 0) {
    html =
      `<tr><td colspan="8" class="empty-row">Aucune entrée pour la semaine ${wk}.</td></tr>`;
  } else {
    pageItems.forEach(function (r) {
      html += `
        <tr>
          <td>${r.date}</td>
          <td>${r.empNom}</td>
          <td>${r.grade}</td>
          <td>${r.type === "rep" ? "Réparation" : "Custom"}</td>
          <td>${money(r.base)}</td>
          <td>${Math.round(r.pct * 100)}%</td>
          <td>${money(r.total)}</td>
          <td>
            <button type="button"
              class="btn btn-danger btn-sm btn-del"
              data-id="${r.id}">
              Supprimer
            </button>
          </td>
        </tr>
      `;
    });
  }

  $("#actionsTableBody").innerHTML = html;

  document.querySelectorAll(".btn-del").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      var id = ev.currentTarget.getAttribute("data-id");
      removeRow(id);
    });
  });

  $("#pageInfoText").textContent =
    "Page " + (all.length ? currentPage : 0) + "/" + totalPages;
}

function buildDiscordText(list, wk, name) {
  var totalBase = 0;
  var totalPay = 0;
  var rep = 0;
  var cus = 0;

  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    totalBase += Number(r.base) || 0;
    totalPay += Number(r.total) || 0;
    if (r.type === "rep") rep++;
    if (r.type === "cus") cus++;
  }

  var lines = list
    .map(function (r) {
      return (
        `${r.date} | ${r.empNom} | ${r.grade} | ` +
        `${r.type === "rep" ? "Réparation" : "Custom"} | ` +
        `base ${money(r.base)} | ${Math.round(r.pct * 100)}% => ${money(
          r.total
        )}`
      );
    })
    .join("\n");

  return (
    `**FICHE DE PAIE (${name}) — Semaine ${wk}**\n` +
    `Montant à payer: ${money(totalPay)} | Chiffre d'affaire: ${money(
      totalBase
    )} | Réparations: ${rep} | Customisations: ${cus}\n` +
    "```" +
    "\n" +
    (lines || "Aucune entrée") +
    "\n```"
  );
}

function sendDiscord(text, target) {
  var url = null;
  if (target === "fiche") url = DISCORD_WEBHOOK_FICHE;
  if (target === "entree") url = DISCORD_WEBHOOK_ENTREE;

  if (!url) {
    console.warn("Webhook missing for", target);
    return Promise.resolve();
  }

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text })
  });
}

function exportCurrentWeekToDiscord() {
  var wk = weekKey($("#dateInput").value || isoToday());
  var list = getFiltered(wk);

  var selId = $("#employeeSelect").value;
  var emp = EMP.find((e) => e.id === selId);
  var name = emp ? emp.nom : "Tous les employés";

  var text = buildDiscordText(list, wk, name);

  sendDiscord(text, "fiche")
    .then(function () {
      alert("Export envoyé sur Discord.");
    })
    .catch(function () {
      alert("Erreur d'envoi Discord.");
    });
}

function add() {
  var c = currentCalc();
  if (!c.emp) {
    alert("Veuillez choisir un employé.");
    return;
  }

  var rec = {
    id: String(Date.now()) + Math.floor(Math.random() * 10000),
    date: $("#dateInput").value || isoToday(),
    empId: c.emp.id,
    empNom: c.emp.nom,
    grade: c.emp.grade,
    type: c.type, 
    base: c.base,
    pct: c.pct,
    total: c.total
  };

  entries.push(rec);
  save(entries);

  currentPage = 99999;
  render();

  if (ENABLE_DISCORD_LOG_ON_ADD) {
    var wk = weekKey(rec.date);
    var t =
      "**NOUVELLE ENTRÉE (" +
      rec.empNom +
      ") — Semaine " +
      wk +
      "**\n" +
      "```\n" +
      rec.date +
      " | " +
      rec.empNom +
      " | " +
      rec.grade +
      " | " +
      (rec.type === "rep" ? "Réparation" : "Custom") +
      " | base " +
      money(rec.base) +
      " | " +
      Math.round(rec.pct * 100) +
      "% => " +
      money(rec.total) +
      "\n```";

    sendDiscord(t, "entree");
  }
}

function removeRow(id) {
  entries = entries.filter(function (r) {
    return r.id !== id;
  });
  save(entries);
  render();
}

function resetWeek() {
  var wk = weekKey($("#dateInput").value || isoToday());
  if (
    !confirm(
      "Confirmer la suppression de toutes les entrées de la semaine " + wk + " ?"
    )
  )
    return;

  var list = getFiltered(wk);
  if (list.length === 0) {
    alert("Aucune entrée à supprimer.");
    return;
  }

  var ids = {};
  list.forEach(function (r) {
    ids[r.id] = true;
  });

  entries = entries.filter(function (r) {
    return !ids[r.id];
  });

  save(entries);
  render();
  alert("Semaine vidée.");
}

$("#employeeSelect").addEventListener("change", updateGradeHint);
$("#dateInput").addEventListener("change", function () {
  currentPage = 1;
  render();
});
$("#serviceType").addEventListener("change", computeAndShow);
$("#serviceAmount").addEventListener("input", computeAndShow);
$("#searchInput").addEventListener("input", function () {
  currentPage = 1;
  render();
});

$("#addToWeekButton").addEventListener("click", add);
$("#clearWeekButton").addEventListener("click", resetWeek);

$("#prevPageBtn").addEventListener("click", function () {
  currentPage--;
  render();
});
$("#nextPageBtn").addEventListener("click", function () {
  currentPage++;
  render();
});
$("#pageSizeSelect").addEventListener("change", function () {
  currentPage = 1;
  render();
});
$("#exportDiscordButton").addEventListener("click", exportCurrentWeekToDiscord);

initSelectors();

