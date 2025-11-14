var GRADE_PCT = {
  "Apprenti": 0.15,
  "Expert": 0.25,
  "Chef d’équipe": 0.30,
  "Responsable": 0.40,
  "Propriétaire": 0.40
};

var EMP = [
  {id:'arthur', nom:'Arthur Blackwood', grade:'Propriétaire'},
  {id:'rico',   nom:'Rico Blackwood',   grade:'Responsable'},
  {id:'olsh',   nom:'Jack Blackwood',   grade:'Chef d’équipe'},
  {id:'tot',    nom:'Serge Blackwood',  grade:'Chef d’équipe'}
];

var LS_KEY = 'fiche_paie_entries_v6';

var DISCORD_WEBHOOK_FICHE  = "https://discordapp.com/api/webhooks/1438918928951672882/3tufNFwGiXhDwFi4nDF8YmIGaz1I1ymGWIpLNoCA3Venv1uIOQkeuod6Zc4mdwBOqtaQ";
var DISCORD_WEBHOOK_ENTREE = "https://discordapp.com/api/webhooks/1438915757898469386/dZ7HjeO-pU4O9y_NL_-KTb7eb8Jjt0ohG-aiZsfb2cCnKG0EruTKq4_buCvYp_3dFkRk";

var ENABLE_DISCORD_LOG_ON_ADD = true;

function $(sel){ return document.querySelector(sel); }
function money(n){ var v=Number(n)||0; return v.toLocaleString('fr-CA',{style:'currency',currency:'CAD'}); }
function isoToday(){ var d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }

function weekKey(iso){
  var d=new Date(iso);
  var target=new Date(d.valueOf());
  var dayNr=(d.getDay()+6)%7;
  target.setDate(target.getDate()-dayNr+3);
  var firstThu=new Date(target.getFullYear(),0,4);
  var week=1+Math.round(((target-firstThu)/86400000 - 3 + ((firstThu.getDay()+6)%7))/7);
  return target.getFullYear() + '-S' + String(week).padStart(2,'0');
}

function weekRange(iso){
  var d=new Date(iso||isoToday());
  var day=(d.getDay()+6)%7;
  var mon=new Date(d); mon.setDate(d.getDate()-day);
  var sun=new Date(mon); sun.setDate(mon.getDate()+6);
  var f=(x)=>x.toLocaleDateString('fr-CA');
  return {start:f(mon), end:f(sun)};
}

function save(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ return []; } }

var entries = load();
var currentPage = 1;
var pageSize = 20;

function initSelectors(){
  var empSel = $('#employeeSelect');
  empSel.innerHTML = EMP.map(e => `<option value="${e.id}">${e.nom}</option>`).join('');
  empSel.selectedIndex = 0;

  $('#dateInput').value = isoToday();
  updateGradeHint();
  computeAndShow();
  render();
}

function updateGradeHint(){
  var sel = $('#employeeSelect').value;
  var e = EMP.find(x => x.id===sel);
  var pct = e ? (GRADE_PCT[e.grade] || 0) : 0;
  $('#employeeGradeText').textContent = 'Grade: ' + e.grade + ' (' + Math.round(pct*100) + '%)';
  computeAndShow();
}

function currentCalc(){
  var e = EMP.find(x => x.id===$('#employeeSelect').value);
  var pct = e ? (GRADE_PCT[e.grade] || 0) : 0;
  var base = Number($('#serviceAmount').value || 0);
  var total = Math.round(base * pct);
  return {pct, base, total, type:$('#serviceType').value, emp:e};
}

function computeAndShow(){ $('#totalToPayInput').value = money(currentCalc().total); }

function getFiltered(wk){
  var q = ($('#searchInput')?.value || '').toLowerCase().trim();
  return entries.filter(r => {
    if(weekKey(r.date)!==wk) return false;
    if(!q) return true;
    var hay = (r.empNom + ' ' + r.grade + ' ' + r.type).toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

function updateWeekPanel(wk, list){
  var r = weekRange($('#dateInput').value || isoToday());
  $('#weekKeyText').textContent   = wk;
  $('#weekRangeText').textContent = r.start + ' → ' + r.end;

  var total=0, rep=0, cus=0;
  for(var i=0;i<list.length;i++){
    total += Number(list[i].total) || 0;
    if(list[i].type==='rep') rep++;
    if(list[i].type==='cus') cus++;
  }
  $('#weekTotalAmount').textContent = money(total);
  $('#weekActionsCount').textContent = String(list.length);
  $('#weekRepairsCount').textContent   = String(rep);
  $('#weekCustomsCount').textContent   = String(cus);

  var q = ($('#searchInput')?.value || '').trim();
  $('#weekFilterText').textContent = q ? 'Filtre : « ' + q + ' »' : 'Aucun filtre';
}

function render(){
  var wk = weekKey($('#dateInput').value || isoToday());
  var all = getFiltered(wk);
  updateWeekPanel(wk, all);

  pageSize = Number($('#pageSizeSelect').value || 20);
  var totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  if(currentPage > totalPages) currentPage = totalPages;
  if(currentPage < 1) currentPage = 1;

  var start = (currentPage - 1) * pageSize;
  var end = start + pageSize;

  var html='';
  if(all.length===0){
    html = `<tr><td colspan="8" style="color:#9fb0c3">Aucune entrée pour la semaine ${wk}.</td></tr>`;
  }else{
    for(var i=start;i<all.length && i<end;i++){
      var r=all[i];
      html += '<tr>'
        + '<td>'+r.date+'</td>'
        + '<td>'+r.empNom+'</td>'
        + '<td><span class="pill">'+r.grade+'</span></td>'
        + '<td>'+(r.type==='rep'?'Réparation':'Custom')+'</td>'
        + '<td>'+money(r.base)+'</td>'
        + '<td>'+Math.round(r.pct*100)+'%</td>'
        + '<td><strong>'+money(r.total)+'</strong></td>'
        + '<td><button class="btn-ghost btn-del" data-id="'+r.id+'">Supprimer</button></td>'
        + '</tr>';
    }
  }
  $('#actionsTableBody').innerHTML = html;

  document.querySelectorAll('.btn-del').forEach(btn=>{
    btn.addEventListener('click', ev => removeRow(ev.currentTarget.getAttribute('data-id')));
  });

  $('#pageInfoText').textContent = 'Page ' + (all.length ? currentPage : 0) + '/' + totalPages;
}

function buildDiscordText(list, wk, name){
  var totalBase = 0;
  var totalPay  = 0;
  var rep = 0, cus = 0;

  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    totalBase += Number(r.base)  || 0;
    totalPay  += Number(r.total) || 0;
    if (r.type === 'rep') rep++;
    if (r.type === 'cus') cus++;
  }

  var lines = list.map(r =>
    `${r.date} | ${r.empNom} | ${r.grade} | ${(r.type==='rep'?'Réparation':'Custom')} | base ${money(r.base)} | ${Math.round(r.pct*100)}% => ${money(r.total)}`
  ).join('\n');

  return `**FICHE DE PAIE (${name}) — Semaine ${wk}**\n` +
         `Montant à payer: ${money(totalPay)} | Chiffre d'affaire: ${money(totalBase)} | Réparations: ${rep} | Customisations: ${cus}\n` +
         `\`\`\`\n${lines || 'Aucune entrée'}\n\`\`\``;
}

function sendDiscord(text, target){
  var url = null;

  if (target === 'fiche') url = DISCORD_WEBHOOK_FICHE;
  if (target === 'entree') url = DISCORD_WEBHOOK_ENTREE;

  if (!url) {
    console.warn("Webhook missing for", target);
    return Promise.resolve();
  }

  return fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({content:text})
  });
}

function exportCurrentWeekToDiscord(){
  var wk = weekKey($('#dateInput').value || isoToday());
  var list = getFiltered(wk);
  var selId = $('#employeeSelect').value;
  var emp   = EMP.find(e => e.id === selId);
  var name  = emp ? emp.nom : 'Tous les employés';
  var text = buildDiscordText(list, wk, name);

  sendDiscord(text, 'fiche')
    .then(()=> alert('Export envoyé sur Discord.'))
    .catch(()=> alert('Erreur d\'envoi Discord.'));
}

function add(){
  var c = currentCalc();
  var rec = {
    id: String(Date.now()) + Math.floor(Math.random()*10000),
    date: $('#dateInput').value || isoToday(),
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

  if(ENABLE_DISCORD_LOG_ON_ADD){
    var wk = weekKey(rec.date);
    var t = '**NOUVELLE ENTRÉE (' + rec.empNom + ') — Semaine ' + wk + '**\n'
          + '```\n' + rec.date + ' | ' + rec.empNom + ' | ' + rec.grade + ' | '
          + (rec.type==='rep'?'Réparation':'Custom') + ' | base ' + money(rec.base)
          + ' | ' + Math.round(rec.pct*100) + '% => ' + money(rec.total) + '\n```';

    sendDiscord(t, 'entree');
  }
}

function removeRow(id){
  entries = entries.filter(r => r.id !== id);
  save(entries);
  render();
}

function resetWeek(){
  var wk = weekKey($('#dateInput').value || isoToday());

  if(!confirm('Confirmer la suppression de toutes les entrées de la semaine '+wk+' ?')) return;

  var list = getFiltered(wk);
  if(list.length === 0){ alert('Aucune entrée à supprimer.'); return; }

  var ids = {}; list.forEach(r => ids[r.id]=true);
  entries = entries.filter(r => !ids[r.id]);
  save(entries);
  render();
  alert('Semaine vidée.');
}

$('#employeeSelect').addEventListener('change', updateGradeHint);
$('#dateInput').addEventListener('change', function(){ currentPage=1; render(); });
$('#serviceType').addEventListener('change', computeAndShow);
$('#serviceAmount').addEventListener('input', computeAndShow);
$('#searchInput').addEventListener('input', function(){ currentPage=1; render(); });
$('#addToWeekButton').addEventListener('click', add);
$('#clearWeekButton').addEventListener('click', resetWeek);
$('#prevPageBtn').addEventListener('click', function(){ currentPage--; render(); });
$('#nextPageBtn').addEventListener('click', function(){ currentPage++; render(); });
$('#pageSizeSelect').addEventListener('change', function(){ currentPage=1; render(); });
$('#exportDiscordButton').addEventListener('click', exportCurrentWeekToDiscord);

initSelectors();
