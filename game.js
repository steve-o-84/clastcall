'use strict';

const VERSION = '2.0.0';
const SAVE_KEY = 'neon-last-call-v2';
const LEGACY_KEY = 'neon-last-call-flat';
const DEFAULT_STATE = {money:120,rep:0,night:1,served:0,guestIndex:0,relations:{},upgrades:{steady:false,ice:false,scanner:false}};

const INGREDIENTS = {
  vodka:{name:'Vodka',color:'#d9f5ff',abv:40}, gin:{name:'Gin',color:'#b9f1e8',abv:40}, rum:{name:'Dark Rum',color:'#a95131',abv:40}, tequila:{name:'Tequila',color:'#ffd16b',abv:38},
  blue:{name:'Blue Curaçao',color:'#1d8dff',abv:20}, grenadine:{name:'Grenadine',color:'#d51f58',abv:0}, lime:{name:'Limettensaft',color:'#93df52',abv:0}, lemon:{name:'Zitronensaft',color:'#ffe45b',abv:0},
  tonic:{name:'Tonic',color:'#c9f8ff',abv:0}, soda:{name:'Soda',color:'#e8fbff',abv:0}, synth:{name:'Synth-Berry',color:'#a539f2',abv:0}, coffee:{name:'Cold Brew',color:'#4a241c',abv:0}
};

const RECIPES = {
  mirage:{name:'Neon Mirage',glass:'Highball',ice:'cubes',method:'stir',basePay:32,ingredients:{vodka:40,blue:20,lime:15,tonic:75}},
  eclipse:{name:'Solar Eclipse',glass:'Rocks',ice:'cubes',method:'shake',basePay:38,ingredients:{tequila:45,grenadine:15,lemon:20,soda:40}},
  ghost:{name:'Ghost Protocol',glass:'Coupe',ice:'none',method:'shake',basePay:44,ingredients:{gin:45,synth:25,lemon:20}},
  blackout:{name:'Blackout Old Fashioned',glass:'Rocks',ice:'cubes',method:'stir',basePay:48,ingredients:{rum:55,coffee:20,grenadine:10}}
};

const GUESTS = [
 {id:'nyx',name:'Nyx Vale',short:'Nyx',role:'Netzläuferin',img:'guest_nyx.svg',recipe:'mirage',trust:10,chem:8,mood:'neugierig',intro:'Du bist also der neue Barkeeper. Zeig mir, ob deine Hände ruhiger sind als die Kameras draußen.',choices:[
  ['Die Kameras beobachten dich. Ich lieber deine Augen.',-1,5,'flirt'],['Ruhige Hände sind Teil des Jobs.',3,0,''],['Was hast du angestellt, dass du Kameras erwähnst?',4,-1,''] ]},
 {id:'aria',name:'Aria Kade',short:'Aria',role:'Konzernkurierin',img:'guest_aria.svg',recipe:'ghost',trust:6,chem:3,mood:'angespannt',intro:'Ich brauche etwas Klares. Und eine Bar, in der niemand Fragen stellt.',choices:[
  ['Dann bekommst du beides. In dieser Reihenfolge.',4,1,''],['Bei dir würde ich sogar die Regeln vergessen.',-1,5,'flirt'],['Keine Fragen kostet normalerweise extra.',2,-1,''] ]},
 {id:'vex',name:'Vex Rainer',short:'Vex',role:'Straßenrennfahrerin',img:'guest_vex.svg',recipe:'eclipse',trust:8,chem:7,mood:'aufgedreht',intro:'Mein Motor glüht, meine Crew schuldet mir Geld und ich will etwas, das genauso brennt.',choices:[
  ['Dann mixe ich dir einen Sonnenuntergang mit Zündfunken.',3,2,''],['Du bist gefährlicher als jeder Drink hier.',0,5,'flirt'],['Erst trinken, dann Schulden eintreiben.',4,0,''] ]}
];

let state = loadStoredState() || structuredClone(DEFAULT_STATE);
let currentGuest, currentRecipe, mix;
let pourTimer=null;
let activeBottle=null;
let audioEnabled=true;
const $=id=>document.getElementById(id);

function loadStoredState(){
  try{return JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null')}catch{return null}
}
function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(state));refreshMenu();}
function hasSave(){return !!(localStorage.getItem(SAVE_KEY)||localStorage.getItem(LEGACY_KEY))}
function toast(text){const box=$('toast');box.textContent=text;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),1800)}
function refreshMenu(){
 const saved=loadStoredState(),exists=!!saved;
 $('versionLabel').textContent=`Version ${VERSION}`;
 $('continueBtn').disabled=!exists;$('deleteSaveBtn').disabled=!exists;
 $('saveSummary').textContent=exists?`Nacht ${saved.night||1} · ${saved.money||0} Credits · Ruf ${saved.rep||0}`:'Kein Spielstand vorhanden';
}
function openMenu(){
 stopPour();$('scene').classList.add('hidden');$('mainMenu').classList.remove('hidden');refreshMenu();
}
function enterGame(useSave=true){
 if(useSave)state=loadStoredState()||structuredClone(DEFAULT_STATE);
 $('mainMenu').classList.add('hidden');$('scene').classList.remove('hidden');showGuest();
}
function newGame(){
 if(hasSave()&&!confirm('Ein neues Spiel überschreibt deinen bisherigen Fortschritt. Fortfahren?'))return;
 state=structuredClone(DEFAULT_STATE);save();enterGame(false);toast('Neue Schicht gestartet');
}
function deleteSave(){
 if(!hasSave()||!confirm('Spielstand wirklich endgültig löschen?'))return;
 localStorage.removeItem(SAVE_KEY);localStorage.removeItem(LEGACY_KEY);state=structuredClone(DEFAULT_STATE);refreshMenu();toast('Spielstand gelöscht');
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function mixHex(colors,weights){
 const total=weights.reduce((a,b)=>a+b,0)||1; let r=0,g=0,b=0;
 colors.forEach((hex,i)=>{const n=parseInt(hex.slice(1),16);r+=((n>>16)&255)*weights[i];g+=((n>>8)&255)*weights[i];b+=(n&255)*weights[i];});
 return '#'+[r,g,b].map(x=>Math.round(x/total).toString(16).padStart(2,'0')).join('');
}
function beep(freq=440,dur=.05){if(!audioEnabled)return;const C=window.AudioContext||window.webkitAudioContext;beep.ctx=beep.ctx||new C();const o=beep.ctx.createOscillator(),g=beep.ctx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.035,beep.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,beep.ctx.currentTime+dur);o.connect(g);g.connect(beep.ctx.destination);o.start();o.stop(beep.ctx.currentTime+dur);}

function updateHUD(){ $('money').textContent=state.money; $('rep').textContent=state.rep; $('night').textContent=state.night; $('served').textContent=state.served; }
function setRelation(g){const r=state.relations[g.id]||(state.relations[g.id]={trust:g.trust,chem:g.chem});$('trustValue').textContent=r.trust;$('chemValue').textContent=r.chem;$('trustBar').style.width=clamp(r.trust,0,100)+'%';$('chemBar').style.width=clamp(r.chem,0,100)+'%';}

function showGuest(){
 currentGuest=GUESTS[state.guestIndex%GUESTS.length];currentRecipe=RECIPES[currentGuest.recipe];
 $('guestImage').src=currentGuest.img;$('guestName').textContent=currentGuest.name;$('guestRole').textContent=currentGuest.role;$('speakerName').textContent=currentGuest.short;$('mood').textContent=currentGuest.mood;$('dialogueText').textContent=currentGuest.intro;setRelation(currentGuest);
 $('dialoguePanel').classList.remove('hidden');$('mixPanel').classList.add('hidden');$('resultPanel').classList.add('hidden');$('guestArea').classList.remove('hidden');
 renderChoices(); updateHUD();animateGuest('talking');
}
function animateGuest(type='react'){const a=$('guestArea');a.classList.remove('talking','react');void a.offsetWidth;a.classList.add(type);setTimeout(()=>a.classList.remove(type),1500)}
function renderChoices(){const box=$('choices');box.innerHTML='';currentGuest.choices.forEach(([text,trust,chem,cls])=>{const b=document.createElement('button');b.textContent=text;if(cls)b.className=cls;b.onclick=()=>choose(text,trust,chem);box.appendChild(b);});}
function choose(text,trust,chem){const r=state.relations[currentGuest.id];r.trust=clamp(r.trust+trust,0,100);r.chem=clamp(r.chem+chem,0,100);setRelation(currentGuest);animateGuest('react');beep(620,.06);$('dialogueText').textContent=chem>=4?'Ein kurzes Lächeln. „Mutig. Mal sehen, ob dein Drink genauso gut ist.“':trust>=3?'Der Blick wird weicher. „Okay. Dann zeig, was du kannst.“':'Sie mustert dich schweigend. „Mach einfach den Drink.“';$('choices').innerHTML='';const b=document.createElement('button');b.className='primary';b.textContent=`Bestellung annehmen: ${currentRecipe.name}`;b.onclick=startMix;b.style.textAlign='center';$('choices').appendChild(b);save();}

function startMix(){mix={ingredients:{},ice:'none',method:'none',shaken:false,stirred:false};$('dialoguePanel').classList.add('hidden');$('mixPanel').classList.remove('hidden');$('orderName').textContent=currentRecipe.name;$('orderHint').textContent=`${currentRecipe.glass} · ${iceLabel(currentRecipe.ice)} · ${methodLabel(currentRecipe.method)}`;renderBottles();resetVisual();}
function renderBottles(){const rack=$('bottleRack');rack.innerHTML='';Object.entries(INGREDIENTS).forEach(([key,it])=>{const card=document.createElement('div');card.className='bottle-card';card.dataset.key=key;card.style.setProperty('--bottle',it.color);card.innerHTML=`<div class="bottle-art"><div class="bottle-shape"></div></div><b>${it.name}</b><small>${it.abv?it.abv+'% Vol.':'alkoholfrei'}</small><button class="pour-btn">Halten & gießen</button>`;const btn=card.querySelector('button');const start=e=>{e.preventDefault();beginPour(key,card)};btn.addEventListener('pointerdown',start);btn.addEventListener('pointerup',stopPour);btn.addEventListener('pointerleave',stopPour);btn.addEventListener('pointercancel',stopPour);rack.appendChild(card);});}
function beginPour(key,card){stopPour();activeBottle=card;card.classList.add('active');const step=state.upgrades.steady?2:3;$('pourStream').style.setProperty('--stream',INGREDIENTS[key].color);$('pourStream').style.height='130px';addIngredient(key,step);pourTimer=setInterval(()=>addIngredient(key,step),90);if(navigator.vibrate)navigator.vibrate(18);beep(260,.08)}
function stopPour(){if(pourTimer){clearInterval(pourTimer);pourTimer=null}if(activeBottle){activeBottle.classList.remove('active');activeBottle=null}$('pourStream').style.height='0'}
function addIngredient(key,ml){const total=getTotal();if(total>=180){stopPour();return}mix.ingredients[key]=(mix.ingredients[key]||0)+ml;updateGlass();$('mixLog').textContent=`${INGREDIENTS[key].name}: ${mix.ingredients[key]} ml · Gesamt ${getTotal()} ml`;}
function getTotal(){return Object.values(mix.ingredients).reduce((a,b)=>a+b,0)}
function updateGlass(){const total=getTotal();$('totalMl').textContent=total;$('liquid').style.height=Math.min(92,total/180*92)+'%';const entries=Object.entries(mix.ingredients);$('liquid').style.backgroundColor=entries.length?mixHex(entries.map(([k])=>INGREDIENTS[k].color),entries.map(([,v])=>v)):'#54dfff';$('bubbles').innerHTML='';for(let i=0;i<Math.min(12,Math.floor(total/15));i++){const x=document.createElement('i');x.className='bubble';x.style.left=(12+Math.random()*76)+'%';x.style.animationDelay=(-Math.random()*2)+'s';$('bubbles').appendChild(x)}}
function iceLabel(v){return v==='cubes'?'Eiswürfel':v==='crushed'?'Crushed Ice':'ohne Eis'}function methodLabel(v){return v==='shake'?'geschüttelt':'gerührt'}
function addIce(type){mix.ice=type;$('iceLayer').innerHTML='';const count=type==='crushed'?22:(state.upgrades.ice?7:5);for(let i=0;i<count;i++){const e=document.createElement('i');e.className='ice '+(type==='crushed'?'crushed':'');e.style.left=(8+Math.random()*72)+'%';e.style.bottom=(8+Math.random()*58)+'%';e.style.transform=`rotate(${Math.random()*90}deg)`;e.style.animationDelay=(Math.random()*.25)+'s';$('iceLayer').appendChild(e)}$('mixLog').textContent=iceLabel(type)+' hinzugefügt.';beep(780,.04)}
function animateMethod(method){mix.method=method;const glass=$('glass');glass.classList.toggle('shake',method==='shake');glass.parentElement.classList.toggle('stirring',method==='stir');$('mixLog').textContent=method==='shake'?'Shaker läuft …':'Drink wird sichtbar gerührt …';if(navigator.vibrate)navigator.vibrate(method==='shake'?[35,25,35]:25);beep(method==='shake'?180:420,.12);setTimeout(()=>{glass.classList.remove('shake');glass.parentElement.classList.remove('stirring');if(method==='shake')mix.shaken=true;else mix.stirred=true;$('mixLog').textContent=method==='shake'?'Kräftig geschüttelt.':'Sauber gerührt.';},1250)}
function resetMix(){mix={ingredients:{},ice:'none',method:'none'};resetVisual();$('mixLog').textContent='Glas geleert.';}
function resetVisual(){$('liquid').style.height='0';$('totalMl').textContent='0';$('iceLayer').innerHTML='';$('bubbles').innerHTML='';}
function scoreMix(){let diff=0,targetTotal=0;for(const [k,v] of Object.entries(currentRecipe.ingredients)){targetTotal+=v;diff+=Math.abs((mix.ingredients[k]||0)-v)}for(const [k,v] of Object.entries(mix.ingredients))if(!currentRecipe.ingredients[k])diff+=v*1.2;let ingredientScore=clamp(100-diff/(targetTotal||1)*90,0,100);let iceScore=mix.ice===currentRecipe.ice?100:currentRecipe.ice==='none'&&mix.ice==='none'?100:35;let methodScore=mix.method===currentRecipe.method?100:45;let score=Math.round(ingredientScore*.72+iceScore*.14+methodScore*.14);if(state.upgrades.scanner)score=Math.min(100,score+4);return score;}
function serve(){stopPour();if(getTotal()<20){$('mixLog').textContent='Das Glas ist fast leer.';beep(120,.1);return}const score=scoreMix();const rel=state.relations[currentGuest.id];const tipRate=(score/100)*(.12+rel.trust/400+rel.chem/500);const pay=Math.round(currentRecipe.basePay*(.5+score/200));const tip=Math.round(pay*tipRate);const reward=pay+tip;state.money+=reward;state.rep+=Math.max(0,Math.round((score-55)/9));state.served++;save();$('mixPanel').classList.add('hidden');$('resultPanel').classList.remove('hidden');$('scoreValue').textContent=score;$('scoreRing').style.setProperty('--score',score+'%');$('resultTitle').textContent=score>=94?'Legendärer Mix':score>=80?'Sehr sauber':score>=65?'Solider Drink':'Ausbaufähig';$('resultText').textContent=score>=90?`${currentGuest.short} nimmt einen Schluck und lächelt. „Genau deshalb komme ich wieder.“`:score>=70?`${currentGuest.short} nickt anerkennend. Der Drink trifft fast genau die Bestellung.`:`${currentGuest.short} verzieht kurz das Gesicht. Trinkbar – aber die Balance stimmt noch nicht.`;$('rewardValue').textContent=`${reward} € (${tip} € Trinkgeld)`;beep(score>=80?760:220,.18);updateHUD();}
function nextGuest(){state.guestIndex++;if(state.served>=5){state.night++;state.served=0;state.money+=50;state.rep+=5;}$('resultPanel').classList.add('hidden');showGuest();save();}

function showRecipe(){$('tabletTitle').textContent=currentRecipe.name;const list=$('recipeList');list.innerHTML='';Object.entries(currentRecipe.ingredients).forEach(([k,v])=>{const row=document.createElement('div');row.className='recipe-row';row.innerHTML=`<span>${INGREDIENTS[k].name}</span><b>${v} ml</b>`;list.appendChild(row)});$('recipeGlass').textContent=currentRecipe.glass;$('recipeIce').textContent=iceLabel(currentRecipe.ice);$('recipeMethod').textContent=methodLabel(currentRecipe.method);$('tablet').classList.remove('hidden')}
function openModal(type){$('modal').classList.remove('hidden');if(type==='contacts'){ $('modalTitle').textContent='Kontakte';$('modalContent').innerHTML='<div class="contact-grid">'+GUESTS.map(g=>{const r=state.relations[g.id]||{trust:g.trust,chem:g.chem};return `<div class="contact"><b>${g.name}</b><small>${g.role}</small><p>Vertrauen ${r.trust} · Chemie ${r.chem}</p></div>`}).join('')+'</div>';}else{$('modalTitle').textContent='Schwarzmarkt';const items=[['steady','Präzisionsausgießer','Langsameres, genaueres Einschenken',90],['ice','Kryo-Eisfach','Mehr und klarere Eiswürfel',75],['scanner','Geschmacksscanner','+4 Punkte auf jede Wertung',140]];$('modalContent').innerHTML='<div class="shop-grid">'+items.map(([id,n,d,p])=>`<div class="shop-item"><b>${n}</b><small>${d}</small><p>${state.upgrades[id]?'Installiert':p+' €'}</p><button ${state.upgrades[id]?'disabled':''} data-buy="${id}" data-price="${p}">${state.upgrades[id]?'Installiert':'Kaufen'}</button></div>`).join('')+'</div>';document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy,+b.dataset.price));}}
function buy(id,price){if(state.money<price){beep(120,.1);return}state.money-=price;state.upgrades[id]=true;save();updateHUD();openModal('shop');beep(700,.08)}

$('recipeBtn').onclick=showRecipe;$('closeTablet').onclick=()=> $('tablet').classList.add('hidden');$('resetBtn').onclick=resetMix;$('serveBtn').onclick=serve;$('nextGuestBtn').onclick=nextGuest;$('shakeBtn').onclick=()=>animateMethod('shake');$('stirBtn').onclick=()=>animateMethod('stir');document.querySelectorAll('[data-ice]').forEach(b=>b.onclick=()=>addIce(b.dataset.ice));$('contactsBtn').onclick=()=>openModal('contacts');$('shopBtn').onclick=()=>openModal('shop');$('closeModal').onclick=()=> $('modal').classList.add('hidden');$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.add('hidden')};$('soundBtn').onclick=()=>{audioEnabled=!audioEnabled;$('soundBtn').textContent=audioEnabled?'♪':'×';};$('menuBtn').onclick=openMenu;$('continueBtn').onclick=()=>enterGame(true);$('newGameBtn').onclick=newGame;$('deleteSaveBtn').onclick=deleteSave;window.addEventListener('pointerup',stopPour);window.addEventListener('blur',stopPour);window.addEventListener('contextmenu',e=>{if(e.target.closest('.pour-btn'))e.preventDefault()});

refreshMenu();
