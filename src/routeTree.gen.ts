/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as HomeRouteImport } from './routes/home'
import { Route as AssistantRouteImport } from './routes/assistant'
import { Route as FriendsRouteImport } from './routes/friends'
import { Route as NotificationsRouteImport } from './routes/notifications'
import { Route as ProfileRouteImport } from './routes/profile'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as VisionRouteImport } from './routes/vision'
import { Route as ScanRouteImport } from './routes/scan'
import { Route as MusicRouteImport } from './routes/music'
import { Route as StatsRouteImport } from './routes/stats'
import { Route as DiaryRouteImport } from './routes/diary'
import { Route as MoodRouteImport } from './routes/mood'
import { Route as PedometerRouteImport } from './routes/pedometer'
import { Route as WorkoutRouteImport } from './routes/workout'
import { Route as NlpRouteImport } from './routes/nlp'
import { Route as BudgetRouteImport } from './routes/budget'
import { Route as GalleryRouteImport } from './routes/gallery'
import { Route as DeviceConnectRouteImport } from './routes/device-connect'
import { Route as ExportRouteImport } from './routes/export'
import { Route as SoundControlRouteImport } from './routes/sound-control'
const make=(source:any,id:string,path:string)=>source.update({id,path,getParentRoute:()=>rootRouteImport} as any)
const IndexRoute=make(IndexRouteImport,'/','/')
const HomeRoute=make(HomeRouteImport,'/home','/home')
const AssistantRoute=make(AssistantRouteImport,'/assistant','/assistant')
const FriendsRoute=make(FriendsRouteImport,'/friends','/friends')
const NotificationsRoute=make(NotificationsRouteImport,'/notifications','/notifications')
const ProfileRoute=make(ProfileRouteImport,'/profile','/profile')
const AuthRoute=make(AuthRouteImport,'/auth','/auth')
const VisionRoute=make(VisionRouteImport,'/vision','/vision')
const ScanRoute=make(ScanRouteImport,'/scan','/scan')
const MusicRoute=make(MusicRouteImport,'/music','/music')
const StatsRoute=make(StatsRouteImport,'/stats','/stats')
const DiaryRoute=make(DiaryRouteImport,'/diary','/diary')
const MoodRoute=make(MoodRouteImport,'/mood','/mood')
const PedometerRoute=make(PedometerRouteImport,'/pedometer','/pedometer')
const WorkoutRoute=make(WorkoutRouteImport,'/workout','/workout')
const NlpRoute=make(NlpRouteImport,'/nlp','/nlp')
const BudgetRoute=make(BudgetRouteImport,'/budget','/budget')
const GalleryRoute=make(GalleryRouteImport,'/gallery','/gallery')
const DeviceConnectRoute=make(DeviceConnectRouteImport,'/device-connect','/device-connect')
const ExportRoute=make(ExportRouteImport,'/export','/export')
const SoundControlRoute=make(SoundControlRouteImport,'/sound-control','/sound-control')
export type FileRouteTypes=any
export type RootRouteChildren=any
declare module '@tanstack/react-router' { interface FileRoutesByPath { [key:string]: any } }
const rootRouteChildren:any={IndexRoute,HomeRoute,AssistantRoute,FriendsRoute,NotificationsRoute,ProfileRoute,AuthRoute,VisionRoute,ScanRoute,MusicRoute,StatsRoute,DiaryRoute,MoodRoute,PedometerRoute,WorkoutRoute,NlpRoute,BudgetRoute,GalleryRoute,DeviceConnectRoute,ExportRoute,SoundControlRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' { interface Register { ssr:true; router:Awaited<ReturnType<typeof getRouter>>; config:Awaited<ReturnType<typeof startInstance.getOptions>> } }
