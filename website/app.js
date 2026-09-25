const menuButton=document.querySelector('.menu-button');
const nav=document.getElementById('nav');
function setMenuOpen(open){nav.classList.toggle('open',open);menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'Close menu':'Menu'}
menuButton.addEventListener('click',()=>setMenuOpen(!nav.classList.contains('open')));
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>setMenuOpen(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){setMenuOpen(false);menuButton.focus()}});
document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menuButton.contains(e.target))setMenuOpen(false)});
document.getElementById('request-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  if(!form.reportValidity())return;
  const button=form.querySelector('button[type="submit"]');
  const summary=document.getElementById('request-summary');
  const d=Object.fromEntries(new FormData(form));
  const turnstileToken=String(d['cf-turnstile-response']||'');
  if(!turnstileToken){summary.innerHTML='<b>Security check required</b><p>Please complete the security check and try again.</p>';summary.hidden=false;return;}
  button.disabled=true;button.textContent='Sending test request…';
  summary.hidden=true;
  try{
    const response=await fetch('https://api-staging.apxride.com/api/public-booking-requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...d,turnstileToken,privacy:d.privacy==='on'})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'The request could not be sent. Please try again.');
    summary.innerHTML=`<b>Test request received — ${escapeHtml(result.reference)}</b><p>Your details are now in the APX RIDE bookings operator’s Booking Requests area. This is a test request, not a confirmed journey.</p><p>Email status: ${escapeHtml(result.notificationStatus||'PREPARED')}. Check the portal notification log for delivery details.</p>`;
    form.reset();
  }catch(error){summary.innerHTML=`<b>Request not sent</b><p>${escapeHtml(error.message||'The booking service is temporarily unavailable.')}</p><p>Your form details are still here so you can try again.</p>`;}
  finally{if(window.turnstile)window.turnstile.reset();summary.hidden=false;button.disabled=false;button.textContent='Send test request';summary.scrollIntoView({behavior:'smooth',block:'nearest'});}
});
function escapeHtml(value){const div=document.createElement('div');div.textContent=String(value||'');return div.innerHTML}
document.getElementById('year').textContent=new Date().getFullYear();
