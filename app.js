(() => {
  const $ = s => document.querySelector(s);
  const cfg = window.LG_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('PASTE-YOUR-') && !cfg.SUPABASE_ANON_KEY.includes('PASTE-YOUR-');
  const supabase = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
  const state = { user:null, profile:null, items:[], query:'', sort:'newest', random:false, authMode:'login', loading:false };
  const mediaBucket='media', avatarBucket='avatars';

  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const bytes = n => { if(!n) return '0 B'; const u=['B','KB','MB','GB']; let i=0,x=n; while(x>=1024&&i<u.length-1){x/=1024;i++} return `${x.toFixed(i?1:0)} ${u[i]}` };
  const date = s => new Date(s).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  const msg = t => { const x=$('#toast'); if(x){ x.textContent=t; x.classList.add('show'); clearTimeout(msg.t); msg.t=setTimeout(()=>x.classList.remove('show'),4200); } console.log('[LOVERS GARAGE]', t); };
  const authStatus = t => { const x=$('#authStatus'); if(x){ x.textContent=t; x.classList.remove('hidden'); } console.log('[LOVERS GARAGE AUTH]', t); };
  const validName = n => /^[A-Za-z0-9_]{3,24}$/.test(n);
  const emailFor = u => `${u.toLowerCase()}@accounts.loversgarage.invalid`;
  const failIfNotConfigured = () => { if(!supabase) throw new Error('The site is not connected to Supabase yet. Add your project URL and anon key to config.js.'); };

  function avatar(p, cls='avatar') {
    if(p?.avatar_url) return `<img class="${cls}" src="${esc(p.avatar_url)}" alt="">`;
    return `<div class="${cls} avatar-fallback">${esc((p?.username||'?')[0].toUpperCase())}</div>`;
  }
  function currentFiltered(){
    let a=[...state.items];
    const q=state.query.trim().toLowerCase();
    if(q) a=a.filter(x=>x.name.toLowerCase().includes(q)||x.creator.username.toLowerCase().includes(q));
    if(state.sort==='oldest') a.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    else if(state.sort==='name') a.sort((a,b)=>a.name.localeCompare(b.name));
    else if(state.sort==='size') a.sort((a,b)=>(b.size||0)-(a.size||0));
    else a.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(state.random) a.sort(()=>Math.random()-.5);
    return a;
  }

  async function loadMedia(){
    failIfNotConfigured();
    state.loading=true;
    try {
      const {data,error}=await supabase.from('media').select('id,name,storage_path,mime_type,size,created_at,owner_id,profiles!media_owner_id_fkey(id,username,description,avatar_url)').order('created_at',{ascending:false});
      if(error) throw error;
      const rows=data||[];
      state.items=rows.map(r=>({id:r.id,name:r.name,storage_path:r.storage_path,type:r.mime_type,size:r.size,created_at:r.created_at,creator:r.profiles||{id:r.owner_id,username:'unknown'},likes:0,dislikes:0}));
      const ids=state.items.map(x=>x.id);
      if(ids.length){
        const {data:rx,error:re}=await supabase.from('reactions').select('media_id,type,user_id').in('media_id',ids);
        if(re) throw re;
        const mine=new Map();
        (rx||[]).forEach(r=>{const x=state.items.find(m=>m.id===r.media_id); if(x) r.type==='like'?x.likes++:x.dislikes++; if(state.user&&r.user_id===state.user.id) mine.set(r.media_id,r.type)});
        state.items.forEach(x=>x.myReaction=mine.get(x.id)||null);
      }
      render();
    } catch(e){ console.error(e); msg(e.message||'Could not load the garage.'); }
    finally{state.loading=false}
  }

  function publicUrl(path){ const {data}=supabase.storage.from(mediaBucket).getPublicUrl(path); return data.publicUrl; }
  function card(x){
    const c=document.createElement('article'); c.className='card'; c.dataset.id=x.id;
    const p=document.createElement('div'); p.className='preview';
    if(x.type.startsWith('video/')){ const v=document.createElement('video'); v.src=publicUrl(x.storage_path); v.controls=true; v.preload='metadata'; v.playsInline=true; v.setAttribute('playsinline',''); p.appendChild(v); }
    else { const im=document.createElement('img'); im.src=publicUrl(x.storage_path); im.alt=x.name; im.loading='lazy'; p.appendChild(im); }
    const b=document.createElement('div'); b.className='card-body';
    b.innerHTML=`<div class="card-name">${esc(x.name)}</div><div class="meta">${esc(x.type)} · ${bytes(x.size)} · ${date(x.created_at)}</div><div class="creator-line" data-user="${esc(x.creator.id)}">${avatar(x.creator)}<span>${esc(x.creator.username)}</span></div><div class="reactions"><button class="react ${x.myReaction==='like'?'selected':''}" data-react="like">♥ ${x.likes}</button><button class="react ${x.myReaction==='dislike'?'selected':''}" data-react="dislike">✕ ${x.dislikes}</button></div>`;
    if(state.user?.id===x.creator.id) b.innerHTML+=`<button class="rename" data-action="rename">Rename</button><button class="delete" data-action="delete">Delete</button>`;
    c.append(p,b); return c;
  }
  function render(){ const a=currentFiltered(); $('#resultCount').textContent=a.length; $('#mediaGrid').innerHTML=''; $('#emptyState').classList.toggle('hidden',a.length!==0); a.forEach(x=>$('#mediaGrid').appendChild(card(x))); }

  async function showProfile(uid){
    const profile=$('#profileView'); profile.innerHTML='<div class="empty"><h2>LOADING PROFILE...</h2></div>';
    try{
      const {data:user,error}=await supabase.from('profiles').select('*').eq('id',uid).single(); if(error) throw error;
      const media=state.items.filter(x=>x.creator.id===uid);
      profile.innerHTML=`<div class="profile-head">${avatar(user,'profile-pfp')}<div><div class="profile-name">${esc(user.username)}</div><div class="profile-desc">${esc(user.description||'No description.')}</div><div class="meta">Joined ${date(user.created_at)}</div></div></div><div class="profile-items"><p class="eyebrow">PUBLIC UPLOADS</p><div class="grid" id="profileGrid"></div></div>`;
      const pg=$('#profileGrid'); if(!media.length){pg.innerHTML="<div class='empty'><h2>NO UPLOADS YET.</h2></div>";return} media.forEach(x=>{const c=card(x); pg.appendChild(c)});
    }catch(e){profile.innerHTML=`<div class="empty"><h2>USER NOT FOUND.</h2><p>${esc(e.message)}</p></div>`}
  }
  function route(){ const h=location.hash||'#home'; $('#homeView').classList.toggle('hidden',h!=='#home'); $('#uploadView').classList.toggle('hidden',h!=='#upload'); $('#profileView').classList.toggle('hidden',!h.startsWith('#profile/')); if(h.startsWith('#profile/'))showProfile(h.split('/')[1]); if(h==='#upload'&&!state.user) { setTimeout(()=>{accountModal();msg('Log in or create an account to upload.');},0); } }

  async function openDetail(id){
    const x=state.items.find(m=>m.id===id); if(!x)return;
    // Stop any card-preview video before opening the detail player so one upload
    // can never keep playing underneath the modal player.
    document.querySelectorAll('.preview video').forEach(v=>{ try{ v.pause(); }catch(_){} });
    const d=$('#detailContent'); const url=publicUrl(x.storage_path);
    const media=x.type.startsWith('video/')?`<video class="detail-media detail-video" src="${esc(url)}" controls playsinline preload="metadata"></video>`:`<img class="detail-media" src="${esc(url)}" alt="${esc(x.name)}">`;
    d.innerHTML=`${media}<div class="detail-info"><div class="detail-name">${esc(x.name)}</div><div class="detail-creator" data-user="${esc(x.creator.id)}">${avatar(x.creator)}<span>${esc(x.creator.username)}</span></div><div class="detail-date">Released ${date(x.created_at)}</div><div class="reactions"><button id="detailLike" class="react ${x.myReaction==='like'?'selected':''}">♥ ${x.likes}</button><button id="detailDislike" class="react ${x.myReaction==='dislike'?'selected':''}">✕ ${x.dislikes}</button></div>${state.user?.id===x.creator.id?`<div class="detail-edit"><input id="renameInput" maxlength="150" value="${esc(x.name)}"><button id="saveRename" class="primary">Save name</button></div>`:''}<section class="comments"><div class="comments-head"><p class="eyebrow">COMMENTS</p><span id="commentCount" class="comment-count">0</span></div>${state.user?`<div class="comment-form"><textarea id="commentInput" maxlength="500" placeholder="Leave a comment..."></textarea><div class="comment-form-bottom"><span id="commentCounter">0/500</span><button id="postComment" class="primary">Post comment</button></div></div>`:`<button id="commentLogin" class="secondary comment-login">Log in to comment</button>`}<div id="commentsList" class="comments-list"><div class="comment-loading">Loading comments...</div></div></section></div>`;
    $('#detailModal').classList.remove('hidden'); d.querySelector('.detail-creator').onclick=()=>{close('detailModal');location.hash='#profile/'+x.creator.id}; $('#detailLike').onclick=()=>react(x.id,'like',true); $('#detailDislike').onclick=()=>react(x.id,'dislike',true);
    if($('#saveRename')) $('#saveRename').onclick=()=>renameMedia(x.id,$('#renameInput').value,true);
    if($('#postComment')){ $('#postComment').onclick=()=>postComment(x.id); $('#commentInput').oninput=e=>$('#commentCounter').textContent=`${e.target.value.length}/500`; $('#commentInput').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();postComment(x.id)}}; }
    if($('#commentLogin')) $('#commentLogin').onclick=()=>{close('detailModal');accountModal();};
    await loadComments(x.id);
  }
  function close(id){ if(id==='detailModal') $('#detailContent').querySelectorAll('video').forEach(v=>{try{v.pause();}catch(_){} }); $('#'+id).classList.add('hidden'); }

  async function loadComments(mediaId){
    const list=$('#commentsList'); if(!list)return;
    try{
      const {data,error}=await supabase.from('comments').select('id,body,created_at,user_id,profiles!comments_user_id_fkey(id,username,avatar_url)').eq('media_id',mediaId).order('created_at',{ascending:true});
      if(error)throw error;
      const rows=data||[]; const count=$('#commentCount'); if(count)count.textContent=rows.length;
      if(!rows.length){list.innerHTML='<div class="no-comments">NO COMMENTS YET.</div>';return;}
      list.innerHTML=rows.map(r=>`<div class="comment" data-comment-id="${esc(r.id)}"><div class="comment-avatar">${avatar(r.profiles||{username:'?'},'avatar')}</div><div class="comment-main"><div class="comment-top"><button class="comment-user" data-comment-user="${esc(r.user_id)}">@${esc(r.profiles?.username||'unknown')}</button><span class="comment-date">${date(r.created_at)}</span>${state.user?.id===r.user_id?`<button class="comment-delete" data-comment-delete="${esc(r.id)}">Delete</button>`:''}</div><div class="comment-body">${esc(r.body)}</div></div></div>`).join('');
      list.onclick=e=>{ const u=e.target.closest('[data-comment-user]'); if(u){close('detailModal');location.hash='#profile/'+u.dataset.commentUser;return;} const del=e.target.closest('[data-comment-delete]'); if(del)deleteComment(del.dataset.commentDelete,mediaId); };
    }catch(e){console.error(e);list.innerHTML=`<div class="no-comments">Could not load comments.</div>`;msg(e.message||'Could not load comments.');}
  }
  async function postComment(mediaId){
    if(!state.user){accountModal();return;}
    const input=$('#commentInput'); if(!input)return; const body=input.value.trim();
    if(!body)return msg('Write something first.'); if(body.length>500)return msg('Comment must be 500 characters or less.');
    const btn=$('#postComment'); if(btn)btn.disabled=true;
    try{ const {error}=await supabase.from('comments').insert({media_id:mediaId,user_id:state.user.id,body}); if(error)throw error; input.value=''; const counter=$('#commentCounter');if(counter)counter.textContent='0/500'; await loadComments(mediaId); msg('Comment posted.'); }
    catch(e){msg(e.message||'Could not post comment.');}
    finally{if(btn)btn.disabled=false;}
  }
  async function deleteComment(commentId,mediaId){
    if(!state.user)return;
    if(!confirm('Delete this comment?'))return;
    try{const {error}=await supabase.from('comments').delete().eq('id',commentId).eq('user_id',state.user.id);if(error)throw error;await loadComments(mediaId);msg('Comment deleted.');}catch(e){msg(e.message||'Could not delete comment.');}
  }

  async function react(id,type,detail=false){
    if(!state.user){accountModal();msg('Log in to react to media.');return}
    try{
      const {data:existing,error}=await supabase.from('reactions').select('id,type').eq('media_id',id).eq('user_id',state.user.id).maybeSingle(); if(error)throw error;
      if(existing?.type===type){ const {error:e}=await supabase.from('reactions').delete().eq('id',existing.id); if(e)throw e; }
      else if(existing){ const {error:e}=await supabase.from('reactions').update({type}).eq('id',existing.id); if(e)throw e; }
      else { const {error:e}=await supabase.from('reactions').insert({media_id:id,user_id:state.user.id,type}); if(e)throw e; }
      await loadMedia(); if(detail)openDetail(id); msg(type==='like'?'Liked.':'Disliked.');
    }catch(e){msg(e.message||'Reaction failed.')}
  }

  function accountModal(){ const c=$('#accountContent'); $('#accountModal').classList.remove('hidden'); if(state.user){ c.innerHTML=`<p class="eyebrow">YOUR ACCOUNT</p><h2 class="form-title">@${esc(state.profile?.username||'')}</h2><p class="form-sub">Your account is stored centrally, so you can close the site and log back in later.</p><div class="field"><label>PROFILE PICTURE</label><input id="pfpInput" type="file" accept="image/png,image/jpeg,image/webp"></div><div class="field"><label>DESCRIPTION</label><textarea id="descInput" maxlength="100">${esc(state.profile?.description||'')}</textarea><div class="counter"><span id="counter">${(state.profile?.description||'').length}</span>/100</div></div><div class="account-actions"><button id="saveProfile" class="primary">Save profile</button><button id="logoutBtn" class="secondary">Log out</button><a class="secondary" href="#profile/${state.user.id}" data-close-link="accountModal">View profile</a></div>`; $('#descInput').oninput=e=>$('#counter').textContent=e.target.value.length; $('#saveProfile').onclick=saveProfile; $('#logoutBtn').onclick=logout; }
    else renderAuth(c);
  }
  function renderAuth(c){ c.innerHTML=state.authMode==='login'?`<p class="eyebrow">ACCOUNT</p><h2 class="form-title">LOG IN.</h2><p class="form-sub">Use the same username and password you created before. Your session can persist between visits on the same browser.</p><div class="field"><label>USERNAME</label><input id="authUser" maxlength="24" autocomplete="username"></div><div class="field"><label>PASSWORD</label><input id="authPass" type="password" autocomplete="current-password"></div><div id="authStatus" class="auth-status hidden"></div><button id="authSubmit" class="primary">Log in</button><p class="auth-switch">No account? <button id="switchAuth">Create one</button></p>`:`<p class="eyebrow">ACCOUNT</p><h2 class="form-title">CREATE ACCOUNT.</h2><p class="form-sub">Choose a unique username and password. Password recovery is not available in this username-only version, so keep your password safe.</p><div class="field"><label>USERNAME</label><input id="authUser" maxlength="24" autocomplete="username"><div class="counter">3–24 letters, numbers, or underscores</div></div><div class="field"><label>PASSWORD</label><input id="authPass" type="password" autocomplete="new-password"><div class="counter">At least 8 characters</div></div><div id="authStatus" class="auth-status hidden"></div><button id="authSubmit" class="primary">Create account</button><p class="auth-switch">Already have one? <button id="switchAuth">Log in</button></p>`; $('#switchAuth').onclick=()=>{state.authMode=state.authMode==='login'?'register':'login';renderAuth(c)}; $('#authSubmit').onclick=authSubmit; }
  async function ensureProfile(user, username){
    let {data,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();
    if(error) throw error;
    if(!data){
      const ins=await supabase.from('profiles').insert({id:user.id,username});
      if(ins.error){
        // The database trigger normally creates this row. If it raced us, read it again.
        const again=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();
        if(again.error||!again.data) throw ins.error;
        data=again.data;
      } else {
        data={id:user.id,username,description:'',avatar_url:null,created_at:new Date().toISOString()};
      }
    }
    state.profile=data;
  }

  async function authSubmit(){
    try {
      failIfNotConfigured();
      if(!window.supabase) throw new Error('Supabase JavaScript did not load. Check your internet connection or the Supabase CDN script.');
      const u=$('#authUser')?.value.trim() || '', p=$('#authPass')?.value || '';
      if(!validName(u)){ authStatus('Username must be 3–24 letters, numbers, or underscores.'); return; }
      if(p.length<8){ authStatus('Password must be at least 8 characters.'); return; }
      const normalized=u.toLowerCase();
      const email=emailFor(normalized);
      authStatus(state.authMode==='register' ? 'Creating account…' : 'Logging in…');
      if(state.authMode==='register'){
        const {data:existing,error:checkError}=await supabase.from('profiles').select('id,username').eq('username_lower',normalized).maybeSingle();
        if(checkError) throw new Error('Could not check username: '+checkError.message);
        if(existing){ authStatus('That username is already taken.'); return; }
        const {data,error}=await supabase.auth.signUp({email,password:p,options:{data:{username:u}}});
        if(error) throw error;
        if(!data?.user) throw new Error('Supabase did not return a user.');
        let session=data.session;
        if(!session){
          authStatus('Account created. Signing you in…');
          const login=await supabase.auth.signInWithPassword({email,password:p});
          if(login.error || !login.data?.session){
            throw new Error('The account was created, but Supabase is waiting for email confirmation. In Supabase go to Authentication → Providers → Email and turn OFF Confirm email. Then try again.');
          }
          session=login.data.session;
        }
        state.user=session.user;
        await ensureProfile(state.user,u);
        await loadProfile();
        $('#accountModal').classList.add('hidden');
        updateAccount();
        await loadMedia();
        msg('Account created and logged in.');
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email,password:p});
        if(error) throw error;
        if(!data?.session) throw new Error('Login succeeded without a session. Please refresh and try again.');
        state.user=data.user;
        await ensureProfile(state.user,u);
        await loadProfile();
        $('#accountModal').classList.add('hidden');
        updateAccount();
        await loadMedia();
        msg('Logged in.');
      }
    }catch(e){
      console.error('LOVERS GARAGE auth error:',e);
      const raw=e?.message || String(e) || 'Authentication failed.';
      let friendly=raw;
      if(/Invalid login credentials/i.test(raw)) friendly='Login failed. Check your username and password.';
      if(/email.*confirm/i.test(raw)) friendly='Email confirmation is enabled. In Supabase: Authentication → Providers → Email → turn OFF Confirm email.';
      if(/duplicate key|profiles_username_unique/i.test(raw)) friendly='That username is already taken.';
      authStatus(friendly);
      msg(friendly);
    }
  }

  async function loadProfile(){ if(!state.user)return; const {data,error}=await supabase.from('profiles').select('*').eq('id',state.user.id).single(); if(error)throw error; state.profile=data; }
  function updateAccount(){ $('#accountBtn').textContent=state.profile?'@'+state.profile.username:'Account'; }
  async function saveProfile(){ try{ const description=$('#descInput').value.slice(0,100); const {error}=await supabase.from('profiles').update({description}).eq('id',state.user.id); if(error)throw error; const f=$('#pfpInput').files[0]; if(f){ if(f.size>5*1024*1024)throw new Error('Profile picture must be 5 MB or smaller.'); if(!/^image\/(png|jpeg|webp)$/.test(f.type))throw new Error('Profile picture must be PNG, JPG, or WebP.'); const path=`${state.user.id}/${crypto.randomUUID()}.${f.name.split('.').pop().toLowerCase()}`; const {error:e}=await supabase.storage.from(avatarBucket).upload(path,f,{upsert:false,contentType:f.type}); if(e)throw e; const {data:u}=supabase.storage.from(avatarBucket).getPublicUrl(path); const {error:e2}=await supabase.from('profiles').update({avatar_url:u.publicUrl}).eq('id',state.user.id); if(e2)throw e2; } await loadProfile(); updateAccount(); close('accountModal'); await loadMedia(); msg('Profile saved.'); }catch(e){msg(e.message||'Could not save profile.')}}
  async function logout(){await supabase.auth.signOut();state.user=null;state.profile=null;updateAccount();close('accountModal');await loadMedia();msg('Logged out.');}

  async function renameMedia(id,name,detail=false){ if(!state.user)return; name=name.trim(); if(!name||name.length>150)return msg('Name must be 1–150 characters.'); try{const {error}=await supabase.from('media').update({name}).eq('id',id).eq('owner_id',state.user.id);if(error)throw error;await loadMedia();if(detail)openDetail(id);msg('Upload renamed.')}catch(e){msg(e.message)}}
  async function deleteMedia(id){ try{const x=state.items.find(m=>m.id===id);if(!x) return; if(!confirm('Delete this public upload?'))return; const {error}=await supabase.from('media').delete().eq('id',id).eq('owner_id',state.user.id);if(error)throw error;const {error:e}=await supabase.storage.from(mediaBucket).remove([x.storage_path]);if(e)console.warn(e);await loadMedia();msg('Deleted.')}catch(e){msg(e.message||'Delete failed.')}}
  async function upload(files){
    if(!files?.length)return; if(!state.user){accountModal();msg('Log in or create an account to upload.');return}
    for(const f of [...files]){
      const row=document.createElement('div');row.className='queue-item';row.innerHTML=`<div class="qname">${esc(f.name)}</div><div class="qstatus">Uploading…</div>`;$('#uploadQueue').prepend(row);
      try{
        const allowed=['image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','video/quicktime']; if(!allowed.includes(f.type))throw new Error(`${f.name}: unsupported file type.`); if(f.size>50*1024*1024)throw new Error(`${f.name}: file is over the 50 MB free-plan limit.`);
        const ext=(f.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,''); const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
        const {error}=await supabase.storage.from(mediaBucket).upload(path,f,{upsert:false,contentType:f.type,cacheControl:'3600'});if(error)throw error;
        const {error:e}=await supabase.from('media').insert({owner_id:state.user.id,name:f.name.slice(0,150),storage_path:path,mime_type:f.type,size:f.size});if(e){await supabase.storage.from(mediaBucket).remove([path]);throw e;}
        row.querySelector('.qstatus').textContent='Uploaded ✓';
      }catch(e){row.querySelector('.qstatus').textContent=e.message||'Failed';}
    }
    $('#fileInput').value=''; await loadMedia();
  }

  $('#continueBtn').onclick=()=>{localStorage.setItem('loversGarageAgeGate','accepted');$('#ageGate').classList.add('hidden')}; if(localStorage.getItem('loversGarageAgeGate')==='accepted')$('#ageGate').classList.add('hidden');
  $('#accountBtn').onclick=accountModal; $('#randomBtn').onclick=()=>{state.random=true;render();msg('Randomized the garage.')}; $('#heroRandom').onclick=()=>{state.random=true;render();scrollTo({top:0,behavior:'smooth'})};
  $('#searchInput').oninput=e=>{state.query=e.target.value;state.random=false;render()}; $('#sortSelect').onchange=e=>{state.sort=e.target.value;state.random=false;render()};
  $('#mediaGrid').onclick=e=>{const creator=e.target.closest('[data-user]');if(creator){e.stopPropagation();location.hash='#profile/'+creator.dataset.user;return}const reactBtn=e.target.closest('[data-react]'),cardEl=e.target.closest('.card');if(!cardEl)return;if(reactBtn){e.stopPropagation();react(cardEl.dataset.id,reactBtn.dataset.react);return}if(e.target.dataset.action==='delete'){e.stopPropagation();deleteMedia(cardEl.dataset.id);return}if(e.target.dataset.action==='rename'){e.stopPropagation();const x=state.items.find(m=>m.id===cardEl.dataset.id);const n=prompt('Rename your upload:',x?.name||'');if(n)renameMedia(cardEl.dataset.id,n);return}openDetail(cardEl.dataset.id)};
  $('#profileView').onclick=e=>{const c=e.target.closest('[data-user]');if(c){location.hash='#profile/'+c.dataset.user;return}const r=e.target.closest('[data-react]'),cardEl=e.target.closest('.card');if(!cardEl)return;if(r){react(cardEl.dataset.id,r.dataset.react);return}if(e.target.dataset.action==='delete'){deleteMedia(cardEl.dataset.id);return}if(e.target.dataset.action==='rename'){const x=state.items.find(m=>m.id===cardEl.dataset.id);const n=prompt('Rename your upload:',x?.name||'');if(n)renameMedia(cardEl.dataset.id,n);return}openDetail(cardEl.dataset.id)};
  $('#chooseBtn').onclick=()=>$('#fileInput').click(); $('#fileInput').onchange=e=>upload(e.target.files); ['dragenter','dragover'].forEach(t=>$('#dropzone').addEventListener(t,e=>{e.preventDefault();$('#dropzone').classList.add('drag')})); ['dragleave','drop'].forEach(t=>$('#dropzone').addEventListener(t,e=>{e.preventDefault();$('#dropzone').classList.remove('drag')})); $('#dropzone').ondrop=e=>upload(e.dataTransfer.files);
  document.addEventListener('click',e=>{const x=e.target.closest('[data-close]');if(x)close(x.dataset.close);const link=e.target.closest('[data-close-link]');if(link)close(link.dataset.closeLink)}); document.addEventListener('keydown',e=>{if(e.key==='Escape'){close('accountModal');close('detailModal')}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#searchInput').focus()}}); window.addEventListener('hashchange',route);

  (async()=>{ try { route(); if(!configured){msg('Connect Supabase in config.js to activate the public site.'); return;} if(!window.supabase){msg('Supabase library failed to load. Refresh the page.'); return;} const {data:{session},error}=await supabase.auth.getSession(); if(error) console.error(error); if(session){state.user=session.user;try{await loadProfile()}catch(e){console.error(e);state.user=null;await supabase.auth.signOut()}} updateAccount(); await loadMedia(); supabase.auth.onAuthStateChange(async (_event,session)=>{state.user=session?.user||null;if(state.user){try{await loadProfile()}catch(e){console.error(e)}}else state.profile=null;updateAccount();await loadMedia();}); } catch(e) { console.error('LOVERS GARAGE startup error:',e); msg(e?.message||'The site failed to start. Open the browser console for details.'); } })();
})();
