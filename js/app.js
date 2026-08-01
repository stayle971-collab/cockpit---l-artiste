import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
  import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
  import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, getDoc, serverTimestamp, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
  import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

  const firebaseConfig = {
    apiKey: "AIzaSyAlGSrxMeCcmL5hoHpgOTwMl21nr69XW4Q",
    authDomain: "cockpit-l-artiste.firebaseapp.com",
    projectId: "cockpit-l-artiste",
    storageBucket: "cockpit-l-artiste.firebasestorage.app",
    messagingSenderId: "292481737288",
    appId: "1:292481737288:web:1382bf39dfd431802aee7d"
  };
  const CLOUDINARY_CLOUD_NAME = "pdj1sft5";
  const CLOUDINARY_UPLOAD_PRESET = "photos d'artistes de cockpit";
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  let currentRole = null;
  const isAdmin = () => currentRole === 'admin';
  const fmt = new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('today').textContent = fmt.format(new Date()).replace(/^./, c=>c.toUpperCase());

  document.querySelectorAll('#checklist input[type=checkbox]').forEach(cb=>{
    cb.checked = localStorage.getItem('check_'+cb.dataset.key)==='1';
    cb.addEventListener('change',()=>localStorage.setItem('check_'+cb.dataset.key,cb.checked?'1':'0'));
  });
  document.getElementById('resetChecklist').addEventListener('click',()=>{
    document.querySelectorAll('#checklist input[type=checkbox]').forEach(cb=>{
      cb.checked=false; localStorage.removeItem('check_'+cb.dataset.key);
    });
  });

  const listEl = document.getElementById('customLinks');
  const getLinks = () => JSON.parse(localStorage.getItem('customLinks') || '[]');
  const saveLinks = links => localStorage.setItem('customLinks', JSON.stringify(links));
  function renderLinks(){
    const links=getLinks(); listEl.innerHTML='';
    links.forEach((item,i)=>{
      const row=document.createElement('div'); row.className='custom-link';
      const a=document.createElement('a'); a.href=item.url; a.target='_blank'; a.rel='noopener'; a.textContent='🔗 '+item.name;
      const del=document.createElement('button'); del.className='delete'; del.textContent='Supprimer';
      del.onclick=()=>{links.splice(i,1);saveLinks(links);renderLinks()};
      row.append(a,del); listEl.append(row);
    });
  }
  document.getElementById('addLink').addEventListener('click',()=>{
    const name=document.getElementById('linkName').value.trim();
    let url=document.getElementById('linkUrl').value.trim();
    if(!name || !url){alert('Indique un nom et un lien.');return}
    if(!/^https?:\/\//i.test(url)) url='https://'+url;
    try{ new URL(url); }catch(e){ alert('Le lien semble incorrect.'); return; }
    const links=getLinks(); links.push({name,url}); saveLinks(links);
    document.getElementById('linkName').value=''; document.getElementById('linkUrl').value='';
    renderLinks();
  });
  renderLinks();

  const qrDialog = document.getElementById('qrDialog');
  document.querySelectorAll('[data-qr]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.getElementById('qrTitle').textContent = btn.dataset.title;
      document.getElementById('qrText').textContent = btn.dataset.text;
      document.getElementById('qrImage').src = btn.dataset.qr;
      qrDialog.showModal();
    });
  });
  document.getElementById('closeQr').addEventListener('click',()=>qrDialog.close());
  qrDialog.addEventListener('click',e=>{ if(e.target===qrDialog) qrDialog.close(); });

  const TRIP_DURATION_MS = 4 * 60 * 60 * 1000;
  const ACTIVE_TRIP_KEY = 'lartisteActiveTripV1';
  const paymentDialog = document.getElementById('paymentDialog');
  const tripStatus = document.getElementById('tripStatus');
  const tripStatusText = document.getElementById('tripStatusText');
  const tripPaymentStatus = document.getElementById('tripPaymentStatus');

  function getActiveTrip(){
    try{ return JSON.parse(localStorage.getItem(ACTIVE_TRIP_KEY) || 'null'); }catch(e){ return null; }
  }
  function saveActiveTrip(trip){ localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip)); }
  function localDateIso(date=new Date()){
    const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function formatTime(timestamp){ return new Date(timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

  function renderActiveTrip(){
    const trip=getActiveTrip();
    if(!trip || trip.processed){ tripStatus.classList.remove('visible'); return; }
    tripStatus.classList.add('visible');
    const due = Date.now() >= trip.expectedEndAt;
    tripStatusText.textContent = due
      ? `Sortie commencée à ${formatTime(trip.startedAt)} · paiement à confirmer maintenant.`
      : `Sortie commencée à ${formatTime(trip.startedAt)} · question de paiement prévue vers ${formatTime(trip.expectedEndAt)}.`;
  }

  function startTripFromRegistry(){
    const existing=getActiveTrip();
    if(existing && !existing.processed){
      renderActiveTrip();
      return;
    }
    const now=Date.now();
    saveActiveTrip({id:`trip-${now}`,startedAt:now,expectedEndAt:now+TRIP_DURATION_MS,processed:false});
    renderActiveTrip();
  }

  function askTripPayment(force=false){
    const trip=getActiveTrip();
    if(!trip || trip.processed) return;
    if(!force && Date.now() < trip.expectedEndAt) return;
    document.getElementById('paymentQuestion').textContent = `As-tu été payé 100 € pour l’excursion commencée à ${formatTime(trip.startedAt)} ?`;
    tripPaymentStatus.textContent='';
    if(!paymentDialog.open) paymentDialog.showModal();
  }

  document.getElementById('registryQrButton').addEventListener('click', startTripFromRegistry);
  document.getElementById('finishTripNow').addEventListener('click',()=>askTripPayment(true));
  document.getElementById('cancelActiveTrip').addEventListener('click',()=>{
    const trip=getActiveTrip();
    if(!trip) return;
    if(!confirm('Annuler cette sortie ? Aucun paiement ne sera ajouté au carnet.')) return;
    localStorage.removeItem(ACTIVE_TRIP_KEY);
    if(paymentDialog.open) paymentDialog.close();
    renderActiveTrip();
    alert('Sortie annulée. Aucun montant n’a été enregistré.');
  });
  document.getElementById('closePaymentLater').addEventListener('click',()=>paymentDialog.close());

  async function recordTripPayment(wasPaid){
    const user=auth.currentUser;
    const trip=getActiveTrip();
    if(!trip || trip.processed){ paymentDialog.close(); return; }
    if(!user || !isAdmin()){
      tripPaymentStatus.textContent='Seul l’administrateur peut enregistrer un paiement. Connecte-toi à l’espace capitaine pour enregistrer la réponse.';
      return;
    }
    const type=wasPaid ? 'payment' : 'remaining';
    const date=localDateIso(new Date());
    tripPaymentStatus.textContent='Enregistrement…';
    try{
      await addDoc(collection(db,'carnet_bord'),{
        date, type, amount:100,
        title:wasPaid ? 'Excursion payée' : 'Excursion non payée',
        details:`Excursion commencée le ${new Date(trip.startedAt).toLocaleString('fr-FR')} · montant automatique de 100 €`,
        excursionId:trip.id, source:'qr_registre', authorEmail:user.email, authorUid:user.uid, createdAt:serverTimestamp()
      });
      trip.processed=true; trip.paymentStatus=wasPaid?'paid':'unpaid'; trip.completedAt=Date.now(); saveActiveTrip(trip);
      paymentDialog.close();
      renderActiveTrip();
      await loadLogbook();
      alert(wasPaid ? '100 € ajoutés dans « Paiements reçus ».' : '100 € ajoutés dans « Reste à payer ».');
    }catch(error){
      console.error(error);
      tripPaymentStatus.textContent='Impossible d’enregistrer. Vérifie la connexion et les règles Firebase.';
    }
  }
  document.getElementById('tripPaidYes').addEventListener('click',()=>recordTripPayment(true));
  document.getElementById('tripPaidNo').addEventListener('click',()=>recordTripPayment(false));
  setInterval(()=>{ renderActiveTrip(); askTripPayment(false); },60000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ renderActiveTrip(); askTripPayment(false); } });
  window.addEventListener('focus',()=>{ renderActiveTrip(); askTripPayment(false); });
  renderActiveTrip();
  setTimeout(()=>askTripPayment(false),800);

  document.getElementById('shareBusiness').addEventListener('click', async ()=>{
    const data = {
      title: "L’Artiste – Excursions en bateau",
      text: "Découvrez L’Artiste, excursions dans le Grand Cul-de-Sac Marin au départ de Sainte-Rose.",
      url: "https://www.instagram.com/lartiste.boat"
    };
    try{
      if(navigator.share){ await navigator.share(data); }
      else{
        await navigator.clipboard.writeText(data.url);
        alert('Lien Instagram copié. Vous pouvez maintenant le partager.');
      }
    }catch(e){ if(e.name !== 'AbortError') alert('Le partage n’a pas pu être ouvert.'); }
  });



  const defaultSettings = {
    boatName: "L’ARTISTE",
    departure: "Sainte-Rose",
    maxPassengers: "11",
    colleagueEmail: "Gaceponchristiane@gmail.com",
    whatsapp: "https://wa.me/590690188810",
    instagram: "https://www.instagram.com/lartiste.boat?igsh=MXJ1a28xcTU3d3Z1dw==",
    facebook: "https://www.facebook.com/share/18yojth8gK/",
    tripadvisor: "https://www.tripadvisor.com/UserReviewEdit-d34519311?m=68676",
    review: "https://g.page/r/CX5EuJUjGmYpEAE/review",
    weather: "https://meteofrance.gp/fr/marine/guadeloupe/cote/guadeloupe-grand-cul-de-sac"
  };

  function getSettings(){
    try{
      return {...defaultSettings, ...JSON.parse(localStorage.getItem('appSettings') || '{}')};
    }catch(e){ return {...defaultSettings}; }
  }

  function applySettings(settings){
    document.getElementById('boatSummary').textContent =
      `${settings.boatName} · ${settings.departure} · ${settings.maxPassengers} passagers maximum`;
    document.getElementById('colleagueEmailText').textContent = settings.colleagueEmail;
    document.getElementById('linkWhatsapp').href = settings.whatsapp;
    document.getElementById('linkInstagram').href = settings.instagram;
    document.getElementById('linkFacebook').href = settings.facebook;
    document.getElementById('linkTripadvisor').href = settings.tripadvisor;
    document.getElementById('linkReview').href = settings.review;
    document.getElementById('linkWeather').href = settings.weather;

    document.getElementById('settingBoatName').value = settings.boatName;
    document.getElementById('settingDeparture').value = settings.departure;
    document.getElementById('settingMaxPassengers').value = settings.maxPassengers;
    document.getElementById('settingColleagueEmail').value = settings.colleagueEmail;
    document.getElementById('settingWhatsapp').value = settings.whatsapp;
    document.getElementById('settingInstagram').value = settings.instagram;
    document.getElementById('settingFacebook').value = settings.facebook;
    document.getElementById('settingTripadvisor').value = settings.tripadvisor;
    document.getElementById('settingReview').value = settings.review;
    document.getElementById('settingWeather').value = settings.weather;
  }

  function readSettingsForm(){
    return {
      boatName: document.getElementById('settingBoatName').value.trim(),
      departure: document.getElementById('settingDeparture').value.trim(),
      maxPassengers: document.getElementById('settingMaxPassengers').value.trim(),
      colleagueEmail: document.getElementById('settingColleagueEmail').value.trim(),
      whatsapp: document.getElementById('settingWhatsapp').value.trim(),
      instagram: document.getElementById('settingInstagram').value.trim(),
      facebook: document.getElementById('settingFacebook').value.trim(),
      tripadvisor: document.getElementById('settingTripadvisor').value.trim(),
      review: document.getElementById('settingReview').value.trim(),
      weather: document.getElementById('settingWeather').value.trim()
    };
  }

  document.getElementById('saveSettings').addEventListener('click',()=>{
    const settings = readSettingsForm();
    localStorage.setItem('appSettings', JSON.stringify(settings));
    applySettings(settings);
    alert('Modifications enregistrées sur ce téléphone.');
  });

  document.getElementById('exportSettings').addEventListener('click',()=>{
    const data = JSON.stringify(getSettings(), null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sauvegarde-cockpit-lartiste.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importSettings').addEventListener('change', async (event)=>{
    const file = event.target.files[0];
    if(!file) return;
    try{
      const imported = JSON.parse(await file.text());
      const settings = {...defaultSettings, ...imported};
      localStorage.setItem('appSettings', JSON.stringify(settings));
      applySettings(settings);
      alert('Sauvegarde importée.');
    }catch(e){
      alert('Ce fichier de sauvegarde est invalide.');
    }
    event.target.value = '';
  });

  document.getElementById('resetSettings').addEventListener('click',()=>{
    if(confirm('Réinitialiser toutes les informations modifiables ?')){
      localStorage.removeItem('appSettings');
      applySettings(defaultSettings);
    }
  });

  applySettings(getSettings());


  const captainShell = document.getElementById('captainShell');
  const loginPanel = document.getElementById('loginPanel');
  const userBar = document.getElementById('userBar');
  const connectedUser = document.getElementById('connectedUser');
  const gallery = document.getElementById('mediaGallery');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = uploadProgress.querySelector('span');

  async function showAuthenticated(user){
    captainShell.classList.toggle('unlocked', Boolean(user));
    loginPanel.style.display = user ? 'none' : 'block';
    userBar.classList.toggle('visible', Boolean(user));
    connectedUser.textContent = user ? user.email : 'Non connecté';
    currentRole = null;
    if(user){
      try{
        const roleSnap = await getDoc(doc(db,'users',user.uid));
        currentRole = roleSnap.exists() ? roleSnap.data().role : null;
      }catch(error){ console.error('Lecture du rôle',error); }
      if(!['admin','captain','reader'].includes(currentRole)){
        document.getElementById('connectedRole').textContent='Accès non autorisé';
        captainShell.classList.remove('unlocked');
        alert('Ce compte n’a pas encore de rôle dans Firestore.');
        return;
      }
      document.getElementById('connectedRole').textContent = currentRole === 'admin' ? 'Administrateur' : currentRole === 'captain' ? 'Second capitaine' : 'Lecture seule';
      document.querySelectorAll('[data-admin-only]').forEach(el=>el.hidden=!isAdmin());
      loadGallery(); loadAvailability(); loadDocuments(); loadFuel(); loadCaptainLog();
      if(isAdmin()){ loadLogbook(); seedInitialLogbook(); }
    } else {
      document.querySelectorAll('[data-admin-only]').forEach(el=>el.hidden=true);
      document.getElementById('connectedRole').textContent='Déconnecté';
      document.getElementById('availabilityCalendar').innerHTML = '<div class="empty-state" style="grid-column:1/-1">Connecte-toi pour consulter le calendrier.</div>';
      document.getElementById('logbookHistory').innerHTML = '<div class="empty-state">Connecte-toi pour consulter le carnet.</div>';
      document.getElementById('documentList').innerHTML = '<div class="empty-state">Connecte-toi pour consulter les documents.</div>';
      gallery.innerHTML = '<div class="empty-state">Connecte-toi pour consulter les photos.</div>';
    }
  }

  document.getElementById('loginButton').addEventListener('click', async ()=>{
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if(!email || !password){ alert('Indique ton adresse e-mail et ton mot de passe.'); return; }
    try{
      await signInWithEmailAndPassword(auth, email, password);
      document.getElementById('loginPassword').value = '';
    }catch(error){
      console.error(error);
      alert('');alert('Erreur Firebase : ' + error.code + '\n' + error.message);
    }
  });

  document.getElementById('loginPassword').addEventListener('keydown', e=>{
    if(e.key === 'Enter') document.getElementById('loginButton').click();
  });
  document.getElementById('logoutButton').addEventListener('click', ()=>signOut(auth));
  onAuthStateChanged(auth, showAuthenticated);

  function escapeHtml(value=''){
    return value.replace(/[&<>'"]/g, char=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[char]));
  }


  const moneyFormatter = new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'});
  const logbookHistory = document.getElementById('logbookHistory');
  const logbookStatus = document.getElementById('logbookStatus');
  document.getElementById('logDate').value = new Date().toISOString().slice(0,10);

  const logTypeLabels = {
    payment:'Paiement reçu', remaining:'Reste à payer', expense:'Dépense',
    maintenance:'Entretien / réparation', operation:'Opération du bateau', note:'Note'
  };


  const availabilityLabels = {
    available:'Disponible', unavailable:'Indisponible', morning:'Matin indisponible', afternoon:'Après-midi indisponible'
  };
  let calendarCursor = new Date();
  calendarCursor.setDate(1);
  let availabilityData = {};

  function localDateKey(date){
    const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  async function loadAvailability(){
    if(!auth.currentUser) return;
    document.getElementById('availabilityStatusText').textContent = 'Chargement du calendrier…';
    try{
      const snap = await getDocs(query(collection(db,'disponibilites'), limit(500)));
      availabilityData = {};
      snap.forEach(ds=>availabilityData[ds.id]={id:ds.id,...ds.data()});
      renderAvailabilityCalendar();
      document.getElementById('availabilityStatusText').textContent = 'Calendrier synchronisé avec Firebase.';
    }catch(error){
      console.error(error);
      document.getElementById('availabilityStatusText').textContent = 'Impossible de charger le calendrier. Publie les nouvelles règles Firestore.';
    }
  }

  function renderAvailabilityCalendar(){
    const grid=document.getElementById('availabilityCalendar');
    const title=document.getElementById('calendarMonthTitle');
    title.textContent=calendarCursor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    grid.innerHTML='';
    const first=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
    const mondayIndex=(first.getDay()+6)%7;
    const start=new Date(first); start.setDate(first.getDate()-mondayIndex);
    const todayKey=localDateKey(new Date());
    for(let i=0;i<42;i++){
      const date=new Date(start); date.setDate(start.getDate()+i);
      const key=localDateKey(date); const item=availabilityData[key];
      const btn=document.createElement('button'); btn.type='button'; btn.className='calendar-day';
      if(date.getMonth()!==calendarCursor.getMonth()) btn.classList.add('outside');
      if(key===todayKey) btn.classList.add('today');
      if(item?.status) btn.classList.add(item.status);
      btn.innerHTML=`<span class="day-number">${date.getDate()}</span><span class="day-state">${item ? escapeHtml(availabilityLabels[item.status]||'') : ''}</span>`;
      btn.title=item?.note ? `${availabilityLabels[item.status]} — ${item.note}` : (item ? availabilityLabels[item.status] : 'Aucun statut');
      if(date.getMonth()===calendarCursor.getMonth()) btn.addEventListener('click',()=>selectAvailabilityDate(key));
      grid.append(btn);
    }
  }

  function selectAvailabilityDate(key){
    const item=availabilityData[key];
    document.getElementById('availabilityDate').value=key;
    document.getElementById('availabilityStatus').value=item?.status||'available';
    document.getElementById('availabilityNote').value=item?.note||'';
  }

  document.getElementById('previousMonth').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderAvailabilityCalendar();});
  document.getElementById('nextMonth').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderAvailabilityCalendar();});
  document.getElementById('availabilityDate').value=localDateKey(new Date());
  document.getElementById('availabilityDate').addEventListener('change',e=>{
    if(!e.target.value) return;
    const d=new Date(e.target.value+'T12:00:00'); calendarCursor=new Date(d.getFullYear(),d.getMonth(),1); selectAvailabilityDate(e.target.value); renderAvailabilityCalendar();
  });
  document.getElementById('saveAvailability').addEventListener('click',async()=>{
    const user=auth.currentUser; if(!user || !isAdmin()){alert('Action réservée à l’administrateur.');return;}
    const date=document.getElementById('availabilityDate').value;
    const status=document.getElementById('availabilityStatus').value;
    const note=document.getElementById('availabilityNote').value.trim();
    if(!date){alert('Choisis une date.');return;}
    const button=document.getElementById('saveAvailability'); button.disabled=true;
    document.getElementById('availabilityStatusText').textContent='Enregistrement…';
    try{
      await setDoc(doc(db,'disponibilites',date),{date,status,note,authorUid:user.uid,authorEmail:user.email,updatedAt:serverTimestamp()});
      availabilityData[date]={date,status,note}; renderAvailabilityCalendar();
      document.getElementById('availabilityStatusText').textContent='Disponibilité enregistrée.';
    }catch(error){console.error(error);document.getElementById('availabilityStatusText').textContent='Échec de l’enregistrement. Vérifie les règles Firestore.';}
    finally{button.disabled=false;}
  });
  document.getElementById('deleteAvailability').addEventListener('click',async()=>{
    const user=auth.currentUser; if(!user || !isAdmin()){alert('Action réservée à l’administrateur.');return;}
    const date=document.getElementById('availabilityDate').value; if(!date){alert('Choisis une date.');return;}
    if(!availabilityData[date]){document.getElementById('availabilityStatusText').textContent='Aucun statut enregistré pour cette date.';return;}
    if(!confirm('Effacer le statut de disponibilité de cette date ?')) return;
    try{
      await deleteDoc(doc(db,'disponibilites',date)); delete availabilityData[date]; renderAvailabilityCalendar();
      document.getElementById('availabilityNote').value=''; document.getElementById('availabilityStatusText').textContent='Statut effacé.';
    }catch(error){console.error(error);document.getElementById('availabilityStatusText').textContent='Suppression impossible.';}
  });

  async function seedInitialLogbook(){
    if(!auth.currentUser || localStorage.getItem('initialLogbookSeedV1') === 'done') return;
    try{
      const snap = await getDocs(query(collection(db, 'carnet_bord'), limit(1)));
      if(snap.empty){
        const initialEntries = [
          {date:'2026-07-21', type:'payment', amount:100, title:'Paiement reçu', details:'Paiement enregistré le 21 juillet 2026'},
          {date:'2026-07-23', type:'payment', amount:200, title:'Paiement reçu', details:'Paiement enregistré le 23 juillet 2026'},
          {date:'2026-07-23', type:'remaining', amount:270, title:'Reste à payer', details:'Solde restant à encaisser'}
        ];
        for(const entry of initialEntries){
          await addDoc(collection(db, 'carnet_bord'), {...entry, authorEmail:auth.currentUser.email, authorUid:auth.currentUser.uid, createdAt:serverTimestamp()});
        }
      }
      localStorage.setItem('initialLogbookSeedV1','done');
      await loadLogbook();
    }catch(error){ console.error('Initialisation carnet', error); }
  }

  async function loadLogbook(){
    logbookHistory.innerHTML = '<div class="empty-state">Chargement du carnet…</div>';
    try{
      const q = query(collection(db, 'carnet_bord'), orderBy('date','desc'), limit(100));
      const snap = await getDocs(q);
      let payments = 0, remaining = 0;
      const entries = [];
      snap.forEach(docSnap=>{
        const item = docSnap.data();
        entries.push({id:docSnap.id, ...item});
        if(item.type === 'payment') payments += Number(item.amount || 0);
        if(item.type === 'remaining') remaining += Number(item.amount || 0);
      });
      document.getElementById('paymentsTotal').textContent = moneyFormatter.format(payments);
      document.getElementById('remainingTotal').textContent = moneyFormatter.format(remaining);
      document.getElementById('grandTotal').textContent = moneyFormatter.format(payments + remaining);
      if(!entries.length){ logbookHistory.innerHTML = '<div class="empty-state">Aucune entrée pour le moment.</div>'; return; }
      logbookHistory.innerHTML = '';
      entries.forEach(item=>{
        const article = document.createElement('article');
        article.className = 'logbook-entry' + (item.type === 'remaining' ? ' remaining' : '');
        const displayDate = item.date ? new Date(item.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : 'Date non indiquée';
        const amount = Number(item.amount || 0);
        article.innerHTML = `<div><b>${escapeHtml(item.title || logTypeLabels[item.type] || 'Entrée')}</b><div>${escapeHtml(logTypeLabels[item.type] || item.type || 'Note')} · ${escapeHtml(displayDate)}</div>${item.details ? `<div class="media-meta" style="margin-top:5px">${escapeHtml(item.details)}</div>` : ''}</div><div class="amount">${amount ? escapeHtml(moneyFormatter.format(amount)) : '—'}${isAdmin() ? `<button class="delete-log-entry" type="button" data-id="${escapeHtml(item.id)}" style="display:block;margin-top:8px;background:#ffe9e9;color:#a51f1f;padding:7px 9px;font-size:12px">Supprimer</button>` : ''}</div>`;
        logbookHistory.append(article);
      });
      logbookHistory.querySelectorAll('.delete-log-entry').forEach(button=>{
        button.addEventListener('click', async ()=>{
          if(!auth.currentUser || !isAdmin()){ alert('Action réservée à l’administrateur.'); return; }
          if(!confirm('Supprimer définitivement cette entrée ? Les totaux seront recalculés.')) return;
          button.disabled=true;
          try{
            await deleteDoc(doc(db,'carnet_bord',button.dataset.id));
            await loadLogbook();
          }catch(error){
            console.error(error);
            button.disabled=false;
            alert('Suppression impossible. Vérifie que les nouvelles règles Firestore sont publiées.');
          }
        });
      });
      logbookStatus.textContent = 'Carnet synchronisé avec Firebase.';
    }catch(error){
      console.error(error);
      logbookHistory.innerHTML = '<div class="empty-state">Impossible de charger le carnet. Publie les nouvelles règles Firestore.</div>';
      logbookStatus.textContent = '';
    }
  }

  document.getElementById('refreshLogbook').addEventListener('click', loadLogbook);
  document.getElementById('addLogEntry').addEventListener('click', async ()=>{
    const user = auth.currentUser;
    if(!user || !isAdmin()){ alert('Action réservée à l’administrateur.'); return; }
    const date = document.getElementById('logDate').value;
    const type = document.getElementById('logType').value;
    const amount = Number(document.getElementById('logAmount').value || 0);
    const title = document.getElementById('logTitle').value.trim() || logTypeLabels[type];
    const details = document.getElementById('logDetails').value.trim();
    if(!date){ alert('Indique une date.'); return; }
    if(['payment','remaining','expense'].includes(type) && amount <= 0){ alert('Indique un montant supérieur à 0.'); return; }
    const button = document.getElementById('addLogEntry');
    button.disabled = true; logbookStatus.textContent = 'Enregistrement…';
    try{
      await addDoc(collection(db, 'carnet_bord'), {date,type,amount,title,details,authorEmail:user.email,authorUid:user.uid,createdAt:serverTimestamp()});
      document.getElementById('logAmount').value = '';
      document.getElementById('logTitle').value = '';
      document.getElementById('logDetails').value = '';
      logbookStatus.textContent = 'Entrée ajoutée avec succès.';
      await loadLogbook();
    }catch(error){ console.error(error); logbookStatus.textContent = 'Échec de l’enregistrement. Vérifie les règles Firestore.'; }
    finally{ button.disabled = false; }
  });

  async function loadGallery(){
    gallery.innerHTML = '<div class="empty-state">Chargement…</div>';
    try{
      const q = query(collection(db, 'photos_bord'), orderBy('createdAt','desc'), limit(60));
      const snap = await getDocs(q);
      if(snap.empty){ gallery.innerHTML = '<div class="empty-state">Aucune photo pour le moment.</div>'; return; }
      gallery.innerHTML = '';
      snap.forEach(docSnap=>{
        const item = docSnap.data();
        const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('fr-FR') : 'À l’instant';
        const article = document.createElement('article');
        article.className = 'media-item';
        article.innerHTML = `
          <a href="${escapeHtml(item.imageUrl || '')}" target="_blank" rel="noopener">
            <img src="${escapeHtml(item.imageUrl || '')}" alt="Photo du bord" loading="lazy">
          </a>
          <div class="media-body">
            ${item.type === 'incident' ? '<span class="incident-tag">🚨 INCIDENT</span>' : ''}
            <b>${item.type === 'incident' ? 'Signalement' : 'Photo du bord'}</b>
            <div>${escapeHtml(item.comment || 'Sans commentaire')}</div>
            <div class="media-meta" style="margin-top:7px">${escapeHtml(date)} · ${escapeHtml(item.authorEmail || '')}</div>
          </div>`;
        gallery.append(article);
      });
    }catch(error){
      console.error(error);
      gallery.innerHTML = '<div class="empty-state">Impossible de charger les photos. Vérifie les règles Firestore.</div>';
    }
  }
  document.getElementById('refreshGallery').addEventListener('click', loadGallery);

  document.getElementById('uploadMedia').addEventListener('click', async ()=>{
    const user = auth.currentUser;
    const file = document.getElementById('mediaFile').files[0];
    const comment = document.getElementById('mediaComment').value.trim();
    const type = document.getElementById('mediaType').value;
    if(!user || !isAdmin()){ alert('Action réservée à l’administrateur.'); return; }
    if(!file){ alert('Choisis ou prends une photo.'); return; }
    if(!file.type.startsWith('image/')){ alert('Le fichier doit être une image.'); return; }
    if(file.size > 12 * 1024 * 1024){ alert('La photo est trop lourde. Limite : 12 Mo.'); return; }

    const button = document.getElementById('uploadMedia');
    button.disabled = true;
    uploadProgress.style.display = 'block';
    progressBar.style.width = '20%';
    uploadStatus.textContent = 'Envoi de la photo vers Cloudinary…';
    try{
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      form.append('folder', 'cockpit-lartiste');
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {method:'POST', body:form});
      if(!response.ok) throw new Error('Cloudinary upload failed');
      progressBar.style.width = '70%';
      const uploaded = await response.json();
      uploadStatus.textContent = 'Enregistrement dans le journal partagé…';
      await addDoc(collection(db, 'photos_bord'), {
        type,
        comment,
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        authorEmail: user.email,
        authorUid: user.uid,
        createdAt: serverTimestamp()
      });
      progressBar.style.width = '100%';
      uploadStatus.textContent = 'Photo enregistrée avec succès.';
      document.getElementById('mediaFile').value = '';
      document.getElementById('mediaComment').value = '';
      await loadGallery();
      setTimeout(()=>{ uploadProgress.style.display='none'; progressBar.style.width='0'; },900);
    }catch(error){
      console.error(error);
      uploadStatus.textContent = 'Échec de l’envoi. Vérifie le préréglage Cloudinary et les règles Firestore.';
      uploadProgress.style.display = 'none';
      progressBar.style.width = '0';
    }finally{
      button.disabled = false;
    }
  });


  const documentList = document.getElementById('documentList');
  const documentStatus = document.getElementById('documentStatus');

  async function loadDocuments(){
    documentList.innerHTML='<div class="empty-state">Chargement des documents…</div>';
    try{
      const snap=await getDocs(query(collection(db,'documents'),orderBy('createdAt','desc'),limit(100)));
      const items=[];
      snap.forEach(d=>{ const item=d.data(); if(isAdmin() || item.visibility==='crew') items.push({id:d.id,...item}); });
      if(!items.length){ documentList.innerHTML='<div class="empty-state">Aucun document visible.</div>'; return; }
      documentList.innerHTML='';
      items.forEach(item=>{
        const row=document.createElement('article'); row.className='document-item';
        const expiry=item.expiry ? ` · Expire le ${new Date(item.expiry+'T12:00:00').toLocaleDateString('fr-FR')}` : '';
        row.innerHTML=`<div><b>${escapeHtml(item.name||'Document')}</b><div class="media-meta">${escapeHtml(item.category||'Autre')}${expiry} · ${item.visibility==='private'?'Privé':'Équipage'}</div></div><div class="document-actions"><a href="${escapeHtml(item.downloadUrl||'')}" target="_blank" rel="noopener">Ouvrir</a>${isAdmin()?`<button class="delete-document" data-id="${escapeHtml(item.id)}" data-path="${escapeHtml(item.storagePath||'')}">Supprimer</button>`:''}</div>`;
        documentList.append(row);
      });
      documentList.querySelectorAll('.delete-document').forEach(btn=>btn.addEventListener('click',async()=>{
        if(!isAdmin() || !confirm('Supprimer définitivement ce document ?')) return;
        btn.disabled=true;
        try{ if(btn.dataset.path) await deleteObject(ref(storage,btn.dataset.path)); await deleteDoc(doc(db,'documents',btn.dataset.id)); await loadDocuments(); }
        catch(error){ console.error(error); alert('Suppression impossible.'); btn.disabled=false; }
      }));
    }catch(error){ console.error(error); documentList.innerHTML='<div class="empty-state">Impossible de charger les documents.</div>'; }
  }

  document.getElementById('uploadDocument').addEventListener('click',async()=>{
    if(!auth.currentUser || !isAdmin()){ alert('Action réservée à l’administrateur.'); return; }
    const name=document.getElementById('documentName').value.trim();
    const file=document.getElementById('documentFile').files[0];
    const category=document.getElementById('documentCategory').value;
    const expiry=document.getElementById('documentExpiry').value;
    const visibility=document.getElementById('documentVisibility').value;
    if(!name || !file){ alert('Indique un nom et choisis un fichier.'); return; }
    if(file.size>15*1024*1024){ alert('Fichier trop lourd. Limite : 15 Mo.'); return; }
    const button=document.getElementById('uploadDocument'); button.disabled=true; documentStatus.textContent='Envoi du document…';
    try{
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const storagePath=`documents/${Date.now()}-${safeName}`;
      const storageRef=ref(storage,storagePath);
      await uploadBytes(storageRef,file,{contentType:file.type});
      const downloadUrl=await getDownloadURL(storageRef);
      await addDoc(collection(db,'documents'),{name,category,expiry:expiry||null,visibility,downloadUrl,storagePath,fileType:file.type,authorUid:auth.currentUser.uid,authorEmail:auth.currentUser.email,createdAt:serverTimestamp()});
      document.getElementById('documentName').value=''; document.getElementById('documentFile').value=''; document.getElementById('documentExpiry').value='';
      documentStatus.textContent='Document ajouté avec succès.'; await loadDocuments();
    }catch(error){ console.error(error); documentStatus.textContent='Échec de l’envoi. Vérifie Firebase Storage et ses règles.'; }
    finally{ button.disabled=false; }
  });

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');


  // ===== Carburant, moteur, checklist, carnets et équipe — v3.3 =====
  const FUEL_CAPACITY = 86;
  const fuelSlider=document.getElementById('fuelSlider'), fuelNeedle=document.getElementById('fuelNeedle'), fuelLitres=document.getElementById('fuelLitres'), fuelAlert=document.getElementById('fuelAlert'), fuelDate=document.getElementById('fuelReadingDate');
  const pad2=n=>String(n).padStart(2,'0');
  function localDateTimeValue(date=new Date()){return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;}
  fuelDate.value=localDateTimeValue(); document.getElementById('captainLogDate').value=localDateTimeValue();
  let fuelCache=[];
  function setGauge(value){const litres=Math.max(0,Math.min(FUEL_CAPACITY,Number(value)||0));fuelSlider.value=String(litres);fuelNeedle.style.transform=`rotate(${135+(litres/FUEL_CAPACITY)*270}deg)`;fuelLitres.textContent=`${Math.round(litres)} L`;fuelAlert.className='fuel-alert';if(litres<20){fuelAlert.textContent='ALERTE ADMIN : faire le plein';fuelAlert.classList.add('danger')}else if(litres<=40){fuelAlert.textContent='Prévoir prochainement le plein';fuelAlert.classList.add('warn')}else{fuelAlert.textContent='Niveau de carburant correct';fuelAlert.classList.add('ok')}}
  fuelSlider.addEventListener('input',()=>setGauge(fuelSlider.value));
  function findLastConsumption(items){const s=[...items].sort((a,b)=>new Date(a.readingDate)-new Date(b.readingDate));for(let i=s.length-1;i>=0;i--){if(s[i].type!=='after')continue;for(let j=i-1;j>=0;j--){if(s[j].type==='before')return {litres:Math.max(0,s[j].litres-s[i].litres),hours:(s[i].engineHours!=null&&s[j].engineHours!=null)?Math.max(0,s[i].engineHours-s[j].engineHours):null}}}return null}
  async function loadFuel(){if(!auth.currentUser)return;try{const snap=await getDocs(query(collection(db,'fuel_readings'),orderBy('readingDate','desc'),limit(30)));fuelCache=snap.docs.map(d=>({id:d.id,...d.data()}));const latest=fuelCache[0];if(latest)setGauge(latest.litres);const c=findLastConsumption(fuelCache);document.getElementById('fuelCurrentSummary').textContent=latest?`${latest.litres} L / 86 L`:'—';document.getElementById('fuelConsumptionSummary').textContent=c?`${c.litres} L${c.hours>0?' · '+(c.litres/c.hours).toFixed(1)+' L/h':''}`:'—';const es=await getDoc(doc(db,'engine_state','main'));const h=es.exists()?Number(es.data().hours):null;document.getElementById('engineHoursSummary').textContent=h!=null?`${h.toLocaleString('fr-FR')} h`:'—';if(isAdmin())document.getElementById('engineHours').value=h??'';const hist=document.getElementById('fuelHistory');hist.innerHTML=fuelCache.length?fuelCache.slice(0,15).map(x=>`<div class="fuel-entry"><div><b>${x.type==='before'?'Avant sortie':x.type==='after'?'Après sortie':'Plein effectué'}</b><small>${new Date(x.readingDate).toLocaleString('fr-FR')} · ${escapeHtml(x.authorEmail||'')}</small>${x.note?`<small>${escapeHtml(x.note)}</small>`:''}</div><span class="fuel-value">${x.litres} L</span></div>`).join(''):'<div class="empty-state">Aucun relevé enregistré.</div>'}catch(e){console.error(e);document.getElementById('fuelHistory').innerHTML='<div class="empty-state">Synchronisation carburant impossible. Publie les nouvelles règles Firebase.</div>'}}
  document.getElementById('saveFuelReading').addEventListener('click',async()=>{if(!auth.currentUser||!['admin','captain'].includes(currentRole)){alert('Accès réservé aux capitaines.');return}const type=document.getElementById('fuelReadingType').value, readingDate=fuelDate.value;if(!readingDate)return alert('Indique la date et l’heure.');let engineHours=null;if(isAdmin()){const es=await getDoc(doc(db,'engine_state','main'));engineHours=es.exists()?Number(es.data().hours):null}await addDoc(collection(db,'fuel_readings'),{type,readingDate,litres:Math.round(Number(fuelSlider.value)),note:document.getElementById('fuelReadingNote').value.trim(),engineHours,authorUid:auth.currentUser.uid,authorEmail:auth.currentUser.email,createdAt:serverTimestamp()});document.getElementById('fuelReadingNote').value='';fuelDate.value=localDateTimeValue();const key=type==='before'?'fuel_before':'fuel_after';const cb=document.querySelector(`#checklist input[data-key="${key}"]`);if(cb){cb.checked=true;localStorage.setItem('check_'+key,'1')}await loadFuel();alert(type==='before'?'Niveau avant sortie enregistré.':'Niveau après sortie enregistré. Consommation mise à jour.')});
  document.getElementById('saveEngineHours').addEventListener('click',async()=>{if(!isAdmin())return alert('Action réservée à l’administrateur.');const hours=Number(document.getElementById('engineHours').value);if(!Number.isFinite(hours)||hours<0)return alert('Valeur invalide.');await setDoc(doc(db,'engine_state','main'),{hours,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});await loadFuel();alert('Heures moteur synchronisées.')});
  document.getElementById('confirmFullTank').addEventListener('click',async()=>{if(!isAdmin()||!confirm('Confirmer le plein à 86 L ?'))return;await addDoc(collection(db,'fuel_readings'),{type:'full',readingDate:new Date().toISOString(),litres:86,note:'Plein validé par administrateur',authorUid:auth.currentUser.uid,authorEmail:auth.currentUser.email,createdAt:serverTimestamp()});await loadFuel()});

  async function saveChecklist(){if(!auth.currentUser)return alert('Connecte-toi.');const values={};document.querySelectorAll('#checklist input[type=checkbox]').forEach(c=>values[c.dataset.key]=c.checked);await addDoc(collection(db,'checklists'),{values,ownerUid:auth.currentUser.uid,ownerEmail:auth.currentUser.email,createdAt:serverTimestamp(),date:new Date().toISOString()});document.getElementById('checklistStatus').textContent='Checklist enregistrée et synchronisée.'}
  document.getElementById('saveChecklistCloud').addEventListener('click',saveChecklist);

  async function loadCaptainLog(){if(!auth.currentUser)return;const box=document.getElementById('captainLogHistory');try{const snap=await getDocs(query(collection(db,'captain_logs'),orderBy('logDate','desc'),limit(30)));const mine=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ownerUid===auth.currentUser.uid);box.innerHTML=mine.length?mine.map(x=>`<div class="log-entry"><div><strong>${escapeHtml(x.title)}</strong><small>${new Date(x.logDate).toLocaleString('fr-FR')} · ${escapeHtml(x.type)}</small>${x.details?`<p>${escapeHtml(x.details)}</p>`:''}</div></div>`).join(''):'<div class="empty-state">Aucune entrée dans ton carnet.</div>'}catch(e){console.error(e);box.innerHTML='<div class="empty-state">Impossible de charger ton carnet.</div>'}}
  document.getElementById('addCaptainLog').addEventListener('click',async()=>{if(!auth.currentUser)return alert('Connecte-toi.');const title=document.getElementById('captainLogTitle').value.trim(),logDate=document.getElementById('captainLogDate').value;if(!title||!logDate)return alert('Indique une date et un intitulé.');await addDoc(collection(db,'captain_logs'),{ownerUid:auth.currentUser.uid,ownerEmail:auth.currentUser.email,type:document.getElementById('captainLogType').value,title,details:document.getElementById('captainLogDetails').value.trim(),logDate,createdAt:serverTimestamp()});document.getElementById('captainLogTitle').value='';document.getElementById('captainLogDetails').value='';await loadCaptainLog();document.getElementById('captainLogStatus').textContent='Entrée enregistrée dans ton carnet personnel.'});
  document.getElementById('refreshCaptainLog').addEventListener('click',loadCaptainLog);

  document.getElementById('createTeamAccount').addEventListener('click',async()=>{if(!isAdmin())return;const email=document.getElementById('teamEmail').value.trim(),password=document.getElementById('teamPassword').value,name=document.getElementById('teamName').value.trim(),role=document.getElementById('teamRole').value,status=document.getElementById('teamStatus');if(!email||password.length<6)return alert('E-mail et mot de passe de 6 caractères minimum requis.');status.textContent='Création du compte…';try{const secondaryApp=initializeApp(firebaseConfig,'team-'+Date.now());const secondaryAuth=getAuth(secondaryApp);const cred=await createUserWithEmailAndPassword(secondaryAuth,email,password);await setDoc(doc(db,'users',cred.user.uid),{name,email,role,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});await signOut(secondaryAuth);status.className='sync-status team-success';status.textContent=`Compte créé : ${email} — rôle ${role==='captain'?'Second capitaine':'Lecture seule'}.` ;document.getElementById('teamPassword').value=''}catch(e){console.error(e);status.textContent=e.code==='auth/email-already-in-use'?'Cette adresse possède déjà un compte. Ajoute ou corrige son rôle dans Firestore.':'Création impossible : '+(e.message||e.code)}});

  const controlDialog=document.getElementById('controlDialog');
  document.getElementById('openControlMode').addEventListener('click',async()=>{if(!auth.currentUser)return alert('Connecte-toi avant d’activer le Mode Contrôle.');document.getElementById('controlIdentity').textContent=`Présenté par ${auth.currentUser.email} · ${new Date().toLocaleString('fr-FR')}`;const box=document.getElementById('controlDocuments');box.innerHTML='<div class="empty-state">Chargement…</div>';try{const snap=await getDocs(query(collection(db,'documents'),orderBy('createdAt','desc')));const docs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.visibility==='crew'&&(isAdmin()||!x.ownerUid||x.ownerUid===auth.currentUser.uid||x.sharedWithCrew===true));box.innerHTML=docs.length?docs.map(x=>`<div class="document-item"><div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.category||'Document')}</small></div><a class="secondary" href="${x.downloadUrl}" target="_blank" rel="noopener">Consulter</a></div>`).join(''):'<div class="empty-state">Aucun document autorisé.</div>'}catch(e){box.innerHTML='<div class="empty-state">Chargement impossible.</div>'}document.body.classList.add('control-active');controlDialog.showModal()});
  function closeControl(){controlDialog.close();document.body.classList.remove('control-active')}
  document.getElementById('closeControlMode').addEventListener('click',closeControl);controlDialog.addEventListener('cancel',e=>{e.preventDefault();closeControl()});
  document.addEventListener('contextmenu',e=>{if(controlDialog.open)e.preventDefault()});
  document.addEventListener('keydown',e=>{if(controlDialog.open&&(e.key==='PrintScreen'||(e.ctrlKey&&['s','p','u'].includes(e.key.toLowerCase())))){e.preventDefault();alert('Action désactivée en Mode Contrôle. Les captures système ne peuvent pas être bloquées totalement sur le Web.')}});
  setGauge(43);
    alert(type==='before' ? 'Niveau avant sortie enregistré.' : 'Niveau après sortie enregistré et consommation calculée.');
  });

  document.getElementById('saveEngineHours').addEventListener('click',()=>{
    if(!auth.currentUser || !isAdmin()){alert('Les heures moteur sont réservées à l’administrateur.');return;}
    const value=Number(document.getElementById('engineHours').value);
    if(!Number.isFinite(value) || value<0){alert('Indique un nombre d’heures moteur valide.');return;}
    localStorage.setItem(ENGINE_STORAGE_KEY,String(value));renderFuelModule();alert('Heures moteur enregistrées.');
  });

  document.getElementById('confirmFullTank').addEventListener('click',()=>{
    if(!auth.currentUser || !isAdmin()){alert('Action réservée à l’administrateur.');return;}
    if(!confirm('Confirmer que le plein a été effectué et remettre la jauge à 86 litres ?')) return;
    const readings=getFuelReadings();
    readings.push({id:Date.now(),type:'full',date:new Date().toISOString(),litres:FUEL_CAPACITY,note:'Plein validé par l’administrateur',author:auth.currentUser.email});
    saveFuelReadings(readings);setGauge(FUEL_CAPACITY);renderFuelModule();
  });
  renderFuelModule();
