'use strict';
const $=id=>document.getElementById(id), touchDevice=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1;
$('touch').checked=new URLSearchParams(location.search).has('touch')?new URLSearchParams(location.search).get('touch')==='1':touchDevice;
$('light').checked=touchDevice;
let instance, manifest, loading=false, downloaded=0, exiting=false;
let exited=false;try{exited=sessionStorage.getItem('ashbound.exited')==='1';sessionStorage.removeItem('ashbound.exited');}catch{}
if(exited){$('gate').classList.add('is-exited');$('exit-note').hidden=false;$('start').firstElementChild.textContent='다시 게임 시작';}
const objectURLs=[];
const manifestPromise=fetch('assets.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('게임 파일 목록을 불러오지 못했습니다.');return r.json();}).then(m=>{manifest=m;$('download').textContent=`첫 실행 다운로드 약 ${Math.ceil(m.totalBytes/1048576)}MB · Wi-Fi 사용을 권장합니다.`;return m;});
manifestPromise.catch(()=>{$('download').textContent='게임 연결을 확인해주세요.';});
let suspendAt=-1000;
function connectTouchInput(){
 const canvas=$('game'),phases={touchstart:0,touchmove:1,touchend:3,touchcancel:4};
 for(const [type,phase] of Object.entries(phases))canvas.addEventListener(type,event=>{
  if(!instance||exiting||!$('touch').checked)return;
  const rect=canvas.getBoundingClientRect(),scale=540/Math.max(1,rect.height);
  for(const point of event.changedTouches)instance.SendMessage('Ashbound Game','OnBrowserTouch',JSON.stringify({id:point.identifier,phase,x:(point.clientX-rect.left)*scale,y:(point.clientY-rect.top)*scale}));
 },{passive:true});
}
function suspend(reason){if(!instance||exiting||performance.now()-suspendAt<150)return;suspendAt=performance.now();instance.SendMessage('Ashbound Game','SuspendForBrowser',reason);}
function orientation(){const portrait=!!(instance&&$('touch').checked&&innerHeight>innerWidth);$('rotate').hidden=!portrait;if(portrait)suspend('rotate');}
addEventListener('blur',()=>suspend('focus'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend('background');});
addEventListener('pagehide',()=>suspend('background'));
addEventListener('resize',orientation);
document.addEventListener('contextmenu',event=>{if(event.target===$('game'))event.preventDefault();});
async function fullscreen(){try{await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.('landscape');}catch{/* Safari and embedded browsers can retain browser chrome. */}}
$('fullscreen').onclick=fullscreen;
$('retry').onclick=()=>location.reload();
window.ashboundQuitReady=async failed=>{
 if(!instance||exiting)return;
 if(failed){instance.SendMessage('Ashbound Game','QuitFailed','storage');return;}
 exiting=true;$('rotate').hidden=true;$('gate').hidden=false;$('loading').hidden=false;$('progress').value=1;$('status').textContent='저장 완료 · 게임을 종료하는 중…';
 const running=instance;instance=null;
 const finish=()=>{try{sessionStorage.setItem('ashbound.exited','1');}catch{}location.reload();};
 // Storage has finished. Reload guarantees all input and audio resources are released.
 const fallback=setTimeout(finish,12000);
 try{await running.Quit();}catch{ /* Reload completes cleanup if the runtime is already shutting down. */ }
 clearTimeout(fallback);
 try{screen.orientation?.unlock?.();if(document.fullscreenElement)await document.exitFullscreen();}catch{}
 finish();
};
async function assetURL(asset){
 if(asset.parts.length===1)return asset.parts[0];
 const buffers=[];
 for(const part of asset.parts){const response=await fetch(part);if(!response.ok)throw Error('다운로드가 중단됐습니다. 연결을 확인하고 다시 시도해주세요.');const bytes=await response.arrayBuffer();buffers.push(bytes);downloaded+=bytes.byteLength;$('progress').value=.55*downloaded/manifest.totalBytes;$('status').textContent=`고원 준비 중 · ${Math.round(downloaded/1048576)}MB`;}
 const url=URL.createObjectURL(new Blob(buffers,{type:'application/octet-stream'}));objectURLs.push(url);return url;
}
$('start').onclick=async()=>{
 if(loading)return;loading=true;$('exit-note').hidden=true;$('gate').classList.add('is-loading');$('start').disabled=true;$('start').hidden=true;$('loading').hidden=false;$('error').hidden=true;document.querySelector('.options').hidden=true;
 try{
  const probe=document.createElement('canvas'),gl=probe.getContext('webgl2');if(!gl)throw Error('이 브라우저에서 3D 화면을 시작할 수 없습니다. 최신 Safari 또는 Chrome으로 열어주세요.');gl.getExtension('WEBGL_lose_context')?.loseContext();
  const url=new URL(location.href);url.searchParams.set('touch',$('touch').checked?'1':'0');url.searchParams.set('quality',$('light').checked?'low':'high');history.replaceState(null,'',url);
  const m=await manifestPromise;
  const dataUrl=await assetURL(m.data),codeUrl=await assetURL(m.wasm);
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=m.loader;script.onload=resolve;script.onerror=()=>reject(Error('실행 파일을 불러오지 못했습니다. 다시 시도해주세요.'));document.body.appendChild(script);});
  instance=await createUnityInstance($('game'),{dataUrl,codeUrl,frameworkUrl:m.framework,streamingAssetsUrl:'StreamingAssets',companyName:'Ashbound Studio',productName:'Ashbound - Dragon Oath',productVersion:m.version,devicePixelRatio:$('light').checked?Math.min(1,960/Math.max(1,$('game').clientWidth),600/Math.max(1,$('game').clientHeight)):Math.min(devicePixelRatio,1.5),matchWebGLToCanvasSize:true,autoSyncPersistentDataPath:true,showBanner:(message,type)=>{if(type==='error')showError(message);}},p=>{$('progress').value=.55+.45*p;$('status').textContent=p<.9?'지형과 드래곤을 불러오는 중…':'곧 고원에 도착합니다…';});
  connectTouchInput();$('gate').hidden=true;$('fullscreen').hidden=true;$('game').focus();orientation();
  for(const objectURL of objectURLs)URL.revokeObjectURL(objectURL);
 }catch(error){showError(error.message);}
};
function showError(message){$('gate').hidden=false;$('error').hidden=false;$('error').textContent='게임을 여는 중 문제가 생겼습니다. '+message;$('loading').hidden=true;$('retry').hidden=false;}

