import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, Link, Navigate, createRootRouteWithContext, useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { reportLovableError } from '@/lib/lovable-error-reporting';
import { apiFetch, ApiError } from '@/lib/api';

function NotFoundComponent(){return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-7xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p><Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Go home</Link></div></div>}
function ErrorComponent({error,reset}:{error:Error;reset:()=>void}){console.error(error);const router=useRouter();useEffect(()=>{reportLovableError(error,{boundary:'tanstack_root_error_component'})},[error]);return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">This page didn't load</h1><p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p><div className="mt-6 flex justify-center gap-2"><button onClick={()=>{router.invalidate();reset()}} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Try again</button><Link to="/" className="rounded-md border border-input px-4 py-2 text-sm">Go home</Link></div></div></div>}

export const Route=createRootRouteWithContext<{queryClient:QueryClient}>()({head:()=>({meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'},{title:'WK Health — AI Health Operating System'},{name:'description',content:'WK Health is a monochrome, editorial health operating system: readiness, activity, guidance and voice in one calm interface.'},{name:'author',content:'WK Health'},{property:'og:title',content:'WK Health — AI Health Operating System'},{property:'og:description',content:'Readiness, recovery, activity and guidance in one calm interface.'},{property:'og:type',content:'website'}]}),shellComponent:RootShell,component:RootComponent,notFoundComponent:NotFoundComponent,errorComponent:ErrorComponent});
function RootShell({children}:{children:ReactNode}){return <div className="min-h-screen">{children}</div>}

async function validateStoredSession(): Promise<'valid'|'invalid'|'transient'> {
  const session=localStorage.getItem('wk_session_token')||localStorage.getItem('wk_token');
  if(!session)return 'invalid';
  if(!localStorage.getItem('wk_token'))localStorage.setItem('wk_token',session);
  if(!localStorage.getItem('wk_session_token'))localStorage.setItem('wk_session_token',session);
  let lastError: unknown=null;
  for(let attempt=0;attempt<3;attempt+=1){
    try{await apiFetch('/api/auth/me');return 'valid';}
    catch(error){
      lastError=error;
      if(error instanceof ApiError&&(error.status===401||error.status===403))return 'invalid';
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,800*(attempt+1)));
    }
  }
  console.warn('WK auth validation temporarily unavailable; preserving existing session',lastError);
  return 'transient';
}

function AuthGate(){
  const location=useLocation();
  const [ready,setReady]=useState(false);
  const [hasSession,setHasSession]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    async function validate(){
      const session=localStorage.getItem('wk_session_token')||localStorage.getItem('wk_token');
      if(!session){if(!cancelled){setHasSession(false);setReady(true)};return;}
      const status=await validateStoredSession();
      if(cancelled)return;
      if(status==='invalid'){
        localStorage.removeItem('wk_session_token');
        localStorage.removeItem('wk_token');
        setHasSession(false);
      }else{
        setHasSession(true);
      }
      setReady(true);
    }
    void validate();
    return()=>{cancelled=true};
  },[location.pathname]);
  if(!ready)return <div className="min-h-screen bg-background" aria-label="Checking authentication"/>;
  if(location.pathname==='/auth')return hasSession?<Navigate to="/" replace/>:<Outlet/>;
  if(!hasSession)return <Navigate to="/auth" replace/>;
  return <Outlet/>;
}

function RootComponent(){const{queryClient}=Route.useRouteContext();return <QueryClientProvider client={queryClient}><AuthGate/></QueryClientProvider>}
