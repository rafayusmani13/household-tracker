const CONFIG = window.TRACKER_CONFIG || {};
const API = CONFIG.apiUrl || "";
// The shared access key is kept in the private app link's URL fragment,
// not in the public GitHub Pages source code.
const APP_KEY = new URLSearchParams(location.hash.slice(1)).get("key") || "";
function API_KEY_PRESENT(){return Boolean(APP_KEY);}
function jsonp(params) {
  return new Promise((resolve,reject)=>{
    const cb="cb_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const timer=setTimeout(()=>{cleanup();reject(new Error("Request timed out"));},15000);
    function cleanup(){delete window[cb];script.remove();clearTimeout(timer);}
    window[cb]=(data)=>{cleanup();data && data.ok ? resolve(data) : reject(new Error(data?.error || "Request failed"));};
    if (!API_KEY_PRESENT()) { cleanup(); reject(new Error("Open the private app link shared with you.")); return; }
    const q=new URLSearchParams({...params,key:APP_KEY,callback:cb});
    script.src=API+"?"+q.toString();
    script.onerror=()=>{cleanup();reject(new Error("Could not reach tracker backend"));};
    document.body.appendChild(script);
  });
}
function fmtTime(iso){return new Date(iso).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});}
function showError(err){const el=document.querySelector("#notice");if(el){el.textContent=err.message||String(err);el.hidden=false;}}
async function refresh(){try{const res=await jsonp({action:"dashboard"});render(res.data);}catch(e){showError(e);}}
async function manual(params){try{await jsonp({action:"manual",...params});document.querySelector("#notice").hidden=true;await refresh();}catch(e){showError(e);}}
