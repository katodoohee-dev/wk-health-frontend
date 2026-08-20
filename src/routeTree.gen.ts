/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AssistantRouteImport } from './routes/assistant'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as ScanRouteImport } from './routes/scan'
import { Route as MusicRouteImport } from './routes/music'
import { Route as StatsRouteImport } from './routes/stats'
import { Route as NotificationsRouteImport } from './routes/notifications'
import { Route as StateLibraryRouteImport } from './routes/state-library'
import { Route as VisionRouteImport } from './routes/vision'
import { Route as HealthMobileRouteImport } from './routes/health-mobile'
import { Route as NotificationsMobileRouteImport } from './routes/notifications-mobile'
import { Route as StatsDetailRouteImport } from './routes/stats-detail'
import { Route as VisionMobileRouteImport } from './routes/vision-mobile'
import { Route as VisionPreviewRouteImport } from './routes/vision-preview'
const make=(source:any,id:string,path:string)=>source.update({id,path,getParentRoute:()=>rootRouteImport} as any)
const IndexRoute=make(IndexRouteImport,'/','/')
const AssistantRoute=make(AssistantRouteImport,'/assistant','/assistant')
const AuthRoute=make(AuthRouteImport,'/auth','/auth')
const ScanRoute=make(ScanRouteImport,'/scan','/scan')
const MusicRoute=make(MusicRouteImport,'/music','/music')
const StatsRoute=make(StatsRouteImport,'/stats','/stats')
const NotificationsRoute=make(NotificationsRouteImport,'/notifications','/notifications')
const StateLibraryRoute=make(StateLibraryRouteImport,'/state-library','/state-library')
const VisionRoute=make(VisionRouteImport,'/vision','/vision')
const HealthMobileRoute=make(HealthMobileRouteImport,'/health-mobile','/health-mobile')
const NotificationsMobileRoute=make(NotificationsMobileRouteImport,'/notifications-mobile','/notifications-mobile')
const StatsDetailRoute=make(StatsDetailRouteImport,'/stats-detail','/stats-detail')
const VisionMobileRoute=make(VisionMobileRouteImport,'/vision-mobile','/vision-mobile')
const VisionPreviewRoute=make(VisionPreviewRouteImport,'/vision-preview','/vision-preview')
export type FileRouteTypes=any
export type RootRouteChildren=any
declare module '@tanstack/react-router' { interface FileRoutesByPath { [key:string]: any } }
const rootRouteChildren:any={IndexRoute,AssistantRoute,AuthRoute,ScanRoute,MusicRoute,StatsRoute,NotificationsRoute,StateLibraryRoute,VisionRoute,HealthMobileRoute,NotificationsMobileRoute,StatsDetailRoute,VisionMobileRoute,VisionPreviewRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' { interface Register { ssr:true; router:Awaited<ReturnType<typeof getRouter>>; config:Awaited<ReturnType<typeof startInstance.getOptions>> } }
