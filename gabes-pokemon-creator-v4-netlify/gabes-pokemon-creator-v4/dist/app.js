const API='/api';
const games={
  platinum:{name:'Pokémon Platinum',gen:4,format:'.pk4',maxDex:493},
  diamond:{name:'Pokémon Diamond',gen:4,format:'.pk4',maxDex:493},
  pearl:{name:'Pokémon Pearl',gen:4,format:'.pk4',maxDex:493},
  heartgold:{name:'Pokémon HeartGold',gen:4,format:'.pk4',maxDex:493},
  soulsilver:{name:'Pokémon SoulSilver',gen:4,format:'.pk4',maxDex:493},
  black:{name:'Pokémon Black',gen:5,format:'.pk5',maxDex:649},
  white:{name:'Pokémon White',gen:5,format:'.pk5',maxDex:649},
  black2:{name:'Pokémon Black 2',gen:5,format:'.pk5',maxDex:649},
  white2:{name:'Pokémon White 2',gen:5,format:'.pk5',maxDex:649}
};
const natures=['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'];
const balls=['Poké Ball','Great Ball','Ultra Ball','Master Ball','Safari Ball','Net Ball','Dive Ball','Nest Ball','Repeat Ball','Timer Ball','Luxury Ball','Premier Ball','Dusk Ball','Heal Ball','Quick Ball','Cherish Ball','Fast Ball','Level Ball','Lure Ball','Heavy Ball','Love Ball','Friend Ball','Moon Ball','Sport Ball'];
const hpTypes=['Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel','Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark'];
const fallbackSpecies=['Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise','Pikachu','Raichu','Eevee','Mewtwo','Mew','Chikorita','Cyndaquil','Totodile','Lugia','Ho-Oh','Celebi','Treecko','Torchic','Mudkip','Rayquaza','Turtwig','Chimchar','Piplup','Lucario','Garchomp','Rotom','Dialga','Palkia','Giratina','Arceus','Snivy','Tepig','Oshawott','Zoroark','Reshiram','Zekrom','Kyurem','Genesect'];
const fallbackMoves=['Tackle','Growl','Thunderbolt','Quick Attack','Protect','Return','Earthquake','Ice Beam','Flamethrower','Surf','Psychic','Shadow Ball','Dragon Claw','Stone Edge','Close Combat','Swords Dance','Calm Mind'];
const fallbackAbilities=['Overgrow','Blaze','Torrent','Static','Lightning Rod','Run Away','Adaptability','Pressure','Inner Focus','Intimidate','Levitate'];
const fallbackItems=['None','Leftovers','Choice Band','Choice Specs','Choice Scarf','Life Orb','Focus Sash','Light Ball','Expert Belt','Lum Berry'];
const statNames=['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'];
const $=id=>document.getElementById(id);
let data={species:[],moves:[],abilities:[],items:[]};
let backendOnline=false;

async function init(){
  Object.entries(games).forEach(([key,g])=>$('game').add(new Option(`${g.name} — Gen ${g.gen}`,key)));
  $('game').value='platinum';
  natures.forEach(x=>$('nature').add(new Option(x,x))); $('nature').value='Jolly';
  balls.forEach(x=>$('ball').add(new Option(x,x)));
  hpTypes.forEach(x=>$('hiddenPower').add(new Option(x,x)));
  statNames.forEach((s,i)=>$('statsTable').insertAdjacentHTML('beforeend',`${i===0?'<div class="head">Stat</div><div class="head">IV (0–31)</div><div class="head">EV (0–255)</div>':''}<div class="stat-name">${s}</div><input class="iv" data-stat="${s}" type="number" min="0" max="31" value="31"><input class="ev" data-stat="${s}" type="number" min="0" max="255" value="0">`));
  for(let i=1;i<=4;i++) $('moveFields').insertAdjacentHTML('beforeend',`<label>Move ${i}<select id="move${i}"></select></label>`);
  wireEvents();
  await loadReferenceData();
  setDefaults();
  refresh();
}
function wireEvents(){
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refresh));
  $('game').addEventListener('change',()=>{populateSpecies();populateMoves();refresh()});
  $('species').addEventListener('change',()=>{updateSprite();loadSpeciesAbilities()});
  $('validate').onclick=validate;
  $('copyShowdown').onclick=copyShowdown;
  $('downloadJson').onclick=downloadJson;
  $('savePreset').onclick=()=>{localStorage.setItem('gabePokemonPresetV3',JSON.stringify(readModel()));flash('Preset saved in this browser.','good')};
  $('loadPreset').onclick=loadPreset;
  $('generatePkm').onclick=generatePkm;
  $('findEncounters').onclick=findEncounters;
  $('autoLegalize').onclick=autoLegalize;
  $('queueGts').onclick=queueForGts;
  $('smartRandomize').onclick=smartRandomize;
}
async function loadReferenceData(){
  try{
    const r=await fetch(`${API}/data/reference`);
    if(!r.ok) throw new Error();
    data=await r.json(); backendOnline=true;
  }catch{
    data={species:fallbackSpecies.map((name,i)=>({id:i+1,name})),moves:fallbackMoves.map((name,i)=>({id:i+1,name})),abilities:fallbackAbilities.map((name,i)=>({id:i+1,name})),items:fallbackItems.map((name,i)=>({id:i,name}))};
  }
  $('backendBadge').textContent=backendOnline?'PKHeX backend online':'Backend offline • preview mode';
  $('backendBadge').className=`backend-pill ${backendOnline?'online':'offline'}`;
  populateSpecies(); populateMoves(); populateList($('ability'),data.abilities,true); populateList($('item'),data.items,true);
}
function populateList(el,list,allowNone=false){
  const old=el.value; el.innerHTML=''; if(allowNone)el.add(new Option('None','0'));
  list.filter(x=>x&&x.name&&x.id!==0).forEach(x=>el.add(new Option(x.name,String(x.id))));
  if([...el.options].some(o=>o.value===old))el.value=old;
}
function populateSpecies(){
  const max=game().maxDex, old=$('species').value; $('species').innerHTML='';
  data.species.filter(x=>x.id>0&&x.id<=max&&x.name).forEach(x=>$('species').add(new Option(`#${String(x.id).padStart(3,'0')} ${x.name}`,String(x.id))));
  $('species').value=[...$('species').options].some(o=>o.value===old)?old:'25';
  updateSprite(); loadSpeciesAbilities();
}
function populateMoves(){
  const maxId=game().gen===4?467:559, old=[1,2,3,4].map(i=>$(`move${i}`)?.value);
  for(let i=1;i<=4;i++){const el=$(`move${i}`);if(!el)continue;el.innerHTML='';el.add(new Option('— None —','0'));data.moves.filter(x=>x.id>0&&x.id<=maxId&&x.name).forEach(x=>el.add(new Option(x.name,String(x.id))));if([...el.options].some(o=>o.value===old[i-1]))el.value=old[i-1]}
}
function setDefaults(){
  $('species').value='25'; selectByText($('ability'),'Static'); selectByText($('item'),'None'); selectByText($('ball'),'Poké Ball'); selectByText($('move1'),'Thunderbolt');
}
function selectByText(el,text){const o=[...el.options].find(x=>x.textContent===text);if(o)el.value=o.value}
function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name))}
function game(){return games[$('game').value]}
function selectedText(id){const e=$(id);return e.options[e.selectedIndex]?.textContent||''}
function selectedSpecies(){const id=+$('species').value;return data.species.find(x=>x.id===id)||{id,name:'Pokémon'}}
function refresh(){
  const g=game(), s=selectedSpecies();
  $('previewName').textContent=s.name; $('monAvatar').textContent=s.name?.[0]?.toUpperCase()||'?';
  $('previewGame').textContent=`${g.name} • Gen ${g.gen}`; $('previewLevel').textContent=$('level').value;
  $('previewNature').textContent=$('nature').value; $('previewAbility').textContent=selectedText('ability').replace(/^None$/,'—'); $('previewFormat').textContent=g.format;
  $('dexLine').textContent=`National Dex #${String(s.id||0).padStart(3,'0')}`;
  document.querySelectorAll('.gen4').forEach(x=>x.style.display=g.gen===4?'':'none');
  document.querySelectorAll('.gen5').forEach(x=>x.style.display=g.gen===5?'':'none');
  $('ot').maxLength=g.gen===4?7:7;
  $('legalityBadge').className='badge warning'; $('legalityBadge').textContent='Needs review';
  updateSprite();
}
function updateSprite(){
  const id=+$('species').value;if(!id)return;
  const img=$('sprite'),avatar=$('monAvatar');
  img.src=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
  img.onerror=()=>{img.onerror=null;img.src=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`};
  img.onload=()=>{img.style.display='block';avatar.style.display='none'};
}
async function loadSpeciesAbilities(){
  if(!backendOnline)return;
  const species=+$('species').value;if(!species)return;
  try{const r=await fetch(`${API}/data/species/${species}?game=${$('game').value}`);if(!r.ok)return;const info=await r.json();populateList($('ability'),info.abilities,true);if(info.abilities?.length)$('ability').value=String(info.abilities[0].id)}catch{}
}
function readModel(){
  const ivs={},evs={};document.querySelectorAll('.iv').forEach(x=>ivs[x.dataset.stat]=+x.value);document.querySelectorAll('.ev').forEach(x=>evs[x.dataset.stat]=+x.value);
  const s=selectedSpecies();
  return {game:$('game').value,speciesId:s.id,species:s.name,level:+$('level').value,nature:$('nature').value,abilityId:+$('ability').value,ability:selectedText('ability'),gender:+$('gender').value,itemId:+$('item').value,item:selectedText('item'),ball:$('ball').value,shiny:$('shiny').checked,hiddenAbility:$('hiddenAbility').checked,pokerus:+$('pokerus').value,ivs,evs,moves:[1,2,3,4].map(i=>({id:+$(`move${i}`).value,name:selectedText(`move${i}`)})),hiddenPower:$('hiddenPower').value,metLevel:+$('metLevel').value,metLocation:+$('metLocation').value,encounterType:$('encounterType').value,metDate:$('metDate').value,fateful:$('fateful').checked,dreamWorld:$('dreamWorld').value,ot:$('ot').value.trim(),tid:+$('tid').value,sid:+$('sid').value,language:+$('language').value,otGender:+$('otGender').value,friendship:+$('friendship').value};
}
function basicChecks(m){const errors=[],warnings=[];if(!m.speciesId)errors.push('Species is required.');if(m.level<1||m.level>100)errors.push('Level must be 1–100.');if(m.metLevel>m.level)warnings.push('Met level is higher than current level.');const evTotal=Object.values(m.evs).reduce((a,b)=>a+b,0);if(evTotal>510)errors.push(`EV total is ${evTotal}; maximum is 510.`);if(Object.values(m.ivs).some(v=>v<0||v>31))errors.push('IVs must be 0–31.');if(Object.values(m.evs).some(v=>v<0||v>255))errors.push('DS-era EVs must be 0–255 per stat.');if(game().gen===4&&m.hiddenAbility)errors.push('Hidden Abilities did not exist in Generation IV.');return {errors,warnings}}
async function validate(){
  const m=readModel(),checks=basicChecks(m),badge=$('legalityBadge');
  if(checks.errors.length){badge.className='badge bad';badge.textContent='Invalid setup';flash(`Errors:\n• ${checks.errors.join('\n• ')}`,'bad');return false}
  if(!backendOnline){badge.className='badge warning';badge.textContent='Backend offline';flash('Basic browser checks passed. Start the included .NET backend to run PKHeX legality analysis.','bad');return false}
  try{const r=await fetch(`${API}/pokemon/validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)});const result=await r.json();badge.className=`badge ${result.valid?'good':'bad'}`;badge.textContent=result.valid?'PKHeX: Legal':'PKHeX: Issues';flash(result.report||'PKHeX check complete.',result.valid?'good':'bad');return result.valid}catch(e){flash(`Validation failed: ${e.message}`,'bad');return false}
}
function showdown(){const m=readModel(),moves=m.moves.filter(x=>x.id);return `${m.species}${m.itemId?` @ ${m.item}`:''}\nAbility: ${m.abilityId?m.ability:'Unknown'}\nLevel: ${m.level}${m.shiny?'\nShiny: Yes':''}\n${Object.entries(m.evs).filter(([,v])=>v).length?'EVs: '+Object.entries(m.evs).filter(([,v])=>v).map(([k,v])=>`${v} ${k}`).join(' / ')+'\n':''}${m.nature} Nature\n${Object.entries(m.ivs).some(([,v])=>v!==31)?'IVs: '+Object.entries(m.ivs).filter(([,v])=>v!==31).map(([k,v])=>`${v} ${k}`).join(' / ')+'\n':''}${moves.map(x=>'- '+x.name).join('\n')}`}
async function copyShowdown(){await navigator.clipboard.writeText(showdown());flash('Showdown text copied to clipboard.','good')}
function downloadJson(){download(`${safeName(selectedSpecies().name)}-${$('game').value}.json`,JSON.stringify(readModel(),null,2),'application/json')}
async function generatePkm(){
  const m=readModel(),checks=basicChecks(m);if(checks.errors.length){flash(`Fix these first:\n• ${checks.errors.join('\n• ')}`,'bad');return}
  if(!backendOnline){flash('Start the included .NET backend first. The browser-only preview cannot create PK4/PK5 binary files.','bad');return}
  try{const r=await fetch(`${API}/pokemon/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)});if(!r.ok)throw new Error(await r.text());const blob=await r.blob(),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${safeName(m.species)}${game().format}`;a.click();URL.revokeObjectURL(u);flash(`Generated ${m.species}${game().format}. Open it in PKHeX for a final review before using it in a save.`,`good`)}catch(e){flash(`Generation failed: ${e.message}`,'bad')}
}

async function findEncounters(){
  const m=readModel(),checks=basicChecks(m),box=$('encounterBox');
  if(checks.errors.length){flash(`Fix these first:\n• ${checks.errors.join('\n• ')}`,'bad');return}
  if(!backendOnline){flash('Start the .NET backend to search PKHeX encounter data.','bad');return}
  box.innerHTML='<div class="encounter-loading">Searching PKHeX encounter data…</div>';box.classList.add('show');
  try{
    const r=await fetch(`${API}/pokemon/encounters`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)});
    const result=await r.json();
    if(!r.ok)throw new Error(result.error||'Encounter search failed.');
    if(!result.length){box.innerHTML='<div class="encounter-empty">No matching encounters found. Try another game, level, or moveset.</div>';return}
    box.innerHTML=result.slice(0,12).map((e,i)=>`<div class="encounter-row"><strong>${e.type.replace(/^Encounter/,'')}</strong><span>${e.version} • Lv ${e.levelMin}${e.levelMax!==e.levelMin?`–${e.levelMax}`:''}</span><span>#${String(e.species).padStart(3,'0')}${e.form?` • Form ${e.form}`:''}</span></div>`).join('');
    flash(`Found ${result.length} compatible encounter${result.length===1?'':'s'} for this build.`,'good');
  }catch(e){box.innerHTML='';box.classList.remove('show');flash(`Encounter search failed: ${e.message}`,'bad')}
}

async function autoLegalize(){
  const m=readModel(),checks=basicChecks(m),badge=$('legalityBadge');
  if(checks.errors.length){flash(`Fix these first:\n• ${checks.errors.join('\n• ')}`,'bad');return}
  if(!backendOnline){flash('Start the included .NET backend first. Auto-legality runs through PKHeX.Core.','bad');return}
  badge.className='badge warning';badge.textContent='Searching…';
  flash('Searching legal encounters and testing your requested build…','good');
  try{
    const r=await fetch(`${API}/pokemon/legalize`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)});
    const result=await r.json();
    if(!r.ok||!result.success)throw new Error(result.report||'No legal encounter could be generated.');
    const bytes=Uint8Array.from(atob(result.dataBase64),c=>c.charCodeAt(0));
    const blob=new Blob([bytes],{type:'application/octet-stream'}),u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download=result.fileName||`${safeName(m.species)}${game().format}`;a.click();URL.revokeObjectURL(u);
    badge.className='badge good';badge.textContent='PKHeX: Legal';
    const enc=result.encounter?`${result.encounter.type.replace(/^Encounter/,'')} • ${result.encounter.version} • Lv ${result.encounter.levelMin}${result.encounter.levelMax!==result.encounter.levelMin?`–${result.encounter.levelMax}`:''}`:'PKHeX encounter';
    const adjustments=result.adjustments?.length?`\n\nAuto-adjustments:\n• ${result.adjustments.join('\n• ')}`:'\n\nNo requested fields needed fallback.';
    flash(`Legal ${m.species} generated.\nOrigin: ${enc}${adjustments}`,'good');
  }catch(e){badge.className='badge bad';badge.textContent='No legal match';flash(`Auto-legality could not complete this build:\n${e.message}`,'bad')}
}

async function queueForGts(){
  const m=readModel(),checks=basicChecks(m),box=$('gtsBox'),badge=$('legalityBadge');
  if(checks.errors.length){flash(`Fix these first:\n• ${checks.errors.join('\n• ')}`,'bad');return}
  if(!backendOnline){flash('The PKHeX backend must be online before a GTS delivery can be queued.','bad');return}
  box.className='gts-box show';
  box.innerHTML='<div class="encounter-loading">Auto-legalizing and creating a 30-minute delivery slot…</div>';
  try{
    const r=await fetch(`${API}/gts/queue`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)});
    const result=await r.json();
    if(!r.ok)throw new Error(result.report||result.error||'Could not create the GTS delivery.');
    badge.className='badge good';badge.textContent='PKHeX: Legal';
    const expires=new Date(result.expiresAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
    box.innerHTML=`<div class="delivery-code"><span>Delivery code</span><strong>${result.code}</strong></div>
      <div class="delivery-details"><b>${result.species}</b> • ${result.game} • ${result.fileName}<br>Waiting for bridge • Expires ${expires}</div>
      <div class="delivery-help">On your Windows PC, run <b>tools/start-custom-dns-gts.bat</b> as Administrator, enter this code, then use the Primary DNS address the bridge displays on your DS.</div>`;
    localStorage.setItem('gabeLastGtsCode',result.code);
    flash(`${m.species} is queued for GTS delivery. Code: ${result.code}`,'good');
  }catch(e){box.innerHTML='';box.classList.remove('show');flash(`GTS queue failed:\n${e.message}`,'bad')}
}


const pokeVersionGroup={diamond:'diamond-pearl',pearl:'diamond-pearl',platinum:'platinum',heartgold:'heartgold-soulsilver',soulsilver:'heartgold-soulsilver',black:'black-white',white:'black-white',black2:'black-2-white-2',white2:'black-2-white-2'};
const natureProfiles={
  physical:['Adamant','Jolly','Impish','Careful','Brave'],
  special:['Modest','Timid','Bold','Calm','Quiet'],
  mixed:['Naive','Hasty','Rash','Mild','Lonely','Naughty'],
  bulky:['Bold','Calm','Impish','Careful','Relaxed','Sassy']
};
const itemPools={
  physical:['Choice Band','Life Orb','Expert Belt','Lum Berry','Leftovers'],
  special:['Choice Specs','Life Orb','Expert Belt','Lum Berry','Leftovers'],
  fast:['Choice Scarf','Life Orb','Focus Sash','Expert Belt'],
  bulky:['Leftovers','Lum Berry'],
  wild:['None'],
  npc:['None','Lum Berry','Leftovers']
};
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function normLabel(x){return String(x).toLowerCase().replace(/[^a-z0-9]/g,'')}
function optionByText(el,text){const n=normLabel(text);return [...el.options].find(o=>normLabel(o.textContent)===n)}
function setSelectText(id,text){const o=optionByText($(id),text);if(o){$(id).value=o.value;return true}return false}
function statMap(p){return Object.fromEntries((p.stats||[]).map(x=>[x.stat.name,x.base_stat]))}
function damageBias(stats){const a=stats.attack||0,s=stats['special-attack']||0;if(a>s+15)return'physical';if(s>a+15)return'special';return'mixed'}
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function setEvs(mode,stats,bias){
  const els=Object.fromEntries([...document.querySelectorAll('.ev')].map(x=>[x.dataset.stat,x]));
  Object.values(els).forEach(x=>x.value=0);
  if(mode==='wild'){Object.values(els).forEach(x=>x.value=randomInt(0,32));return}
  if(mode==='npc'){
    // Give trainer-style builds a modest amount of believable training rather than
    // six untouched zero EVs, which PKHeX correctly flags as suspicious after leveling.
    const ordered=['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'];
    const preferred=bias==='special'?['Sp. Atk','Speed','HP']:bias==='physical'?['Attack','Speed','HP']:['HP','Speed',stats.attack>=stats['special-attack']?'Attack':'Sp. Atk'];
    const used=new Set();
    for(const stat of preferred){if(!els[stat]||used.has(stat))continue;els[stat].value=randomInt(12,48);used.add(stat)}
    const extra=pick(ordered.filter(x=>!used.has(x)));if(extra&&els[extra])els[extra].value=randomInt(4,24);
    return
  }
  const speed=stats.speed||0,hp=stats.hp||0,def=stats.defense||0,spd=stats['special-defense']||0;
  let main=bias==='special'?'Sp. Atk':'Attack';
  let second=speed>=80?'Speed':(hp>=Math.max(def,spd)?'HP':(def>=spd?'Defense':'Sp. Def'));
  if(bias==='mixed') main=(stats.attack||0)>=(stats['special-attack']||0)?'Attack':'Sp. Atk';
  els[main].value=252;els[second].value=252;
  const leftover=['HP','Defense','Sp. Def','Speed','Attack','Sp. Atk'].find(x=>x!==main&&x!==second);if(leftover)els[leftover].value=4;
}
function setIvs(mode,bias){
  document.querySelectorAll('.iv').forEach(x=>x.value=mode==='wild'?randomInt(8,31):31);
  if(mode==='competitive'&&bias==='special'){
    const atk=[...document.querySelectorAll('.iv')].find(x=>x.dataset.stat==='Attack');if(atk)atk.value=Math.random()<.6?0:31;
  }
}
async function moveDetails(url){const r=await fetch(url);if(!r.ok)throw new Error('Move lookup failed');return r.json()}
function legalMoveEntries(p,level){
  const vg=pokeVersionGroup[$('game').value];
  return (p.moves||[]).map(m=>{
    const ds=(m.version_group_details||[]).filter(v=>v.version_group?.name===vg);
    const usable=ds.some(v=>v.move_learn_method?.name==='machine'||v.move_learn_method?.name==='tutor'||(v.move_learn_method?.name==='level-up'&&v.level_learned_at<=level));
    return usable?m:null;
  }).filter(Boolean);
}
function scoreMove(m,types,bias,mode){
  let score=0; const cls=m.damage_class?.name||'status',type=m.type?.name||''; const power=m.power||0;
  if(types.includes(type))score+=34;
  if(cls===bias)score+=28;
  if(bias==='mixed'&&cls!=='status')score+=15;
  if(cls==='status')score+=(mode==='competitive'?12:mode==='npc'?7:4);
  else score+=Math.min(35,power/4);
  if((m.accuracy??100)>=90)score+=6;
  if(m.priority>0)score+=7;
  if(['protect','swords-dance','calm-mind','dragon-dance','recover','roost','toxic','will-o-wisp','thunder-wave','substitute','stealth-rock','spikes','leech-seed'].includes(m.name))score+=18;
  if(mode==='wild'&&cls==='status')score-=8;
  score+=Math.random()*16;
  return score;
}
async function chooseMoves(p,stats,bias,mode){
  const entries=legalMoveEntries(p,+$('level').value);
  if(!entries.length)throw new Error('No game-compatible moves were found for this Pokémon at this level.');
  const shuffled=[...entries].sort(()=>Math.random()-.5).slice(0,Math.min(entries.length,34));
  const details=await Promise.all(shuffled.map(x=>moveDetails(x.move.url).catch(()=>null)));
  const types=(p.types||[]).map(x=>x.type.name);
  const ranked=details.filter(Boolean).map(m=>({m,score:scoreMove(m,types,bias,mode)})).sort((a,b)=>b.score-a.score);
  const out=[];const seenTypes=new Set();
  for(const x of ranked){
    if(out.length>=4)break;
    const cls=x.m.damage_class?.name;
    const key=cls==='status'?x.m.name:x.m.type?.name;
    if(out.length<3&&seenTypes.has(key)&&Math.random()<.75)continue;
    out.push(x.m);seenTypes.add(key);
  }
  return out.slice(0,4);
}
async function smartRandomize(){
  const btn=$('smartRandomize'),box=$('randomBox'),mode=$('randomMode').value,id=+$('species').value;
  btn.disabled=true;btn.textContent='Building…';box.classList.add('show');box.innerHTML='<div class="encounter-loading">Reading this Pokémon’s stats, typing and DS-era movepool…</div>';
  try{
    const r=await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);if(!r.ok)throw new Error('Could not load Pokémon data from PokéAPI.');
    const p=await r.json(),stats=statMap(p),bias=damageBias(stats);
    if(mode==='wild')$('level').value=randomInt(5,Math.min(70,+$('level').max||100));
    else if(mode==='npc')$('level').value=randomInt(20,70);
    else $('level').value=randomInt(45,100);
    const speed=stats.speed||0,bulk=(stats.hp||0)+(stats.defense||0)+(stats['special-defense']||0);
    let profile=bias;
    if(bulk>300&&speed<80&&mode!=='chaos')profile='bulky';
    const naturePool=mode==='chaos'?natures:(natureProfiles[profile]||natureProfiles.mixed);$('nature').value=pick(naturePool);
    setIvs(mode,bias);setEvs(mode,stats,bias);
    const abilities=(p.abilities||[]).filter(a=>game().gen===5||!a.is_hidden);
    if(abilities.length){const a=pick(abilities);setSelectText('ability',a.ability.name.replace(/-/g,' '));$('hiddenAbility').checked=game().gen===5&&!!a.is_hidden}
    const itemKey=mode==='wild'?'wild':mode==='npc'?'npc':profile==='bulky'?'bulky':speed>=105?'fast':bias;
    const item=pick(itemPools[itemKey]||itemPools.npc);setSelectText('item',item);
    if(mode==='competitive')$('shiny').checked=Math.random()<.10;else if(mode==='chaos')$('shiny').checked=Math.random()<.25;else $('shiny').checked=Math.random()<.025;
    $('pokerus').value=mode==='competitive'&&Math.random()<.15?'2':'0';
    $('friendship').value=mode==='wild'?randomInt(35,100):mode==='npc'?70:randomInt(120,255);
    const chosen=await chooseMoves(p,stats,bias,mode);
    for(let i=1;i<=4;i++){const m=chosen[i-1];if(!m){$(`move${i}`).value='0';continue}const text=m.name.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');if(!setSelectText(`move${i}`,text))$(`move${i}`).value='0'}
    refresh();
    const summary=chosen.map(m=>m.name.replace(/-/g,' ')).join(' • ');
    box.innerHTML=`<b>${selectedSpecies().name}</b> built as a <b>${profile}</b> ${mode} set.<br><span>${summary}</span><br><small>Run Auto Legalize before downloading or sending through GTS so PKHeX can reconcile encounter-specific details.</small>`;
    flash(`Smart Randomizer built a ${mode} ${selectedSpecies().name}. Review it or Auto Legalize it next.`,'good');
  }catch(e){box.innerHTML=`<div class="encounter-empty">${e.message}</div>`;flash(`Randomizer failed:\n${e.message}`,'bad')}
  finally{btn.disabled=false;btn.textContent='Smart Randomize'}
}

function loadPreset(){const raw=localStorage.getItem('gabePokemonPresetV3')||localStorage.getItem('gabePokemonPresetV2')||localStorage.getItem('gabePokemonPreset');if(!raw)return flash('No saved preset found.','bad');const m=JSON.parse(raw);$('game').value=m.game||'platinum';populateSpecies();populateMoves();$('species').value=String(m.speciesId||25);$('level').value=m.level||50;$('nature').value=m.nature||'Jolly';$('gender').value=String(m.gender??0);$('shiny').checked=!!m.shiny;$('hiddenAbility').checked=!!m.hiddenAbility;$('pokerus').value=String(m.pokerus??0);Object.entries(m.ivs||{}).forEach(([s,v])=>{const x=[...document.querySelectorAll('.iv')].find(e=>e.dataset.stat===s);if(x)x.value=v});Object.entries(m.evs||{}).forEach(([s,v])=>{const x=[...document.querySelectorAll('.ev')].find(e=>e.dataset.stat===s);if(x)x.value=v});(m.moves||[]).forEach((v,i)=>{if(i<4)$(`move${i+1}`).value=String(typeof v==='object'?v.id:0)});$('metLevel').value=m.metLevel??5;$('metLocation').value=m.metLocation??0;$('encounterType').value=m.encounterType||'Wild encounter';$('metDate').value=m.metDate||'';$('fateful').checked=!!m.fateful;$('ot').value=m.ot||'Gabe';$('tid').value=m.tid??12345;$('sid').value=m.sid??54321;$('language').value=String(m.language??2);$('otGender').value=String(m.otGender??0);$('friendship').value=m.friendship??70;refresh();flash('Preset loaded.','good')}
function flash(text,type){const x=$('statusBox');x.textContent=text;x.className='status-box show';x.style.borderColor=type==='bad'?'#7d2c42':'#315f55'}
function safeName(s){return (s||'pokemon').replace(/[^a-z0-9_-]/gi,'_')}
function download(name,text,type){const a=document.createElement('a');const u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
init();
