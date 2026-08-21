import { API_BASE_URL, getToken } from './api';
export async function liveFetch<T=any>(path:string,options:{method?:string;body?:unknown;signal?:AbortSignal}={}){const token=getToken();const res=await fetch(`${API_BASE_URL}${path}`,{method:options.method??'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(options.body!==undefined?{body:JSON.stringify(options.body)}:{}),...(options.signal?{signal:options.signal}:{})});let data:any={};try{data=await res.json()}catch{}if(!res.ok||data?.success===false)throw new Error(data?.error||data?.message||`Request failed (${res.status})`);return data as T}
export type LiveDevice={id:string;name?:string|null;deviceUid?:string|null;deviceType:string;status:string;metadata?:Record<string,unknown>};
export async function listDevices(){return (await liveFetch<{devices:LiveDevice[]}>('/api/devices')).devices}
export async function saveDevice(device:{name?:string;deviceUid?:string;deviceType?:string;metadata?:Record<string,unknown>}){return (await liveFetch<{device:LiveDevice}>('/api/devices',{method:'POST',body:device})).device}
export async function syncDevice(id:string){return liveFetch(`/api/devices/${encodeURIComponent(id)}/sync`,{method:'POST'})}
export async function removeDevice(id:string){return liveFetch(`/api/devices/${encodeURIComponent(id)}`,{method:'DELETE'})}
export type SoundSettings={volume:number;mode:string;voiceEnabled:boolean;outputDevice:string|null;inputDevice:string|null;updatedAt?:string};
export async function getSoundSettings(){return (await liveFetch<{settings:SoundSettings}>('/api/sound')).settings}
export async function saveSoundSettings(settings:Partial<SoundSettings>){return (await liveFetch<{settings:SoundSettings}>('/api/sound',{method:'PUT',body:settings})).settings}
