/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AssistantRouteImport } from './routes/assistant'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as BudgetRouteImport } from './routes/budget'
import { Route as DeviceConnectRouteImport } from './routes/device-connect'
import { Route as DiaryRouteImport } from './routes/diary'
import { Route as ExportRouteImport } from './routes/export'
import { Route as FriendsRouteImport } from './routes/friends'
import { Route as GalleryRouteImport } from './routes/gallery'
import { Route as MoodRouteImport } from './routes/mood'
import { Route as MusicRouteImport } from './routes/music'
import { Route as NlpRouteImport } from './routes/nlp'
import { Route as NotificationsRouteImport } from './routes/notifications'
import { Route as PedometerRouteImport } from './routes/pedometer'
import { Route as ProfileRouteImport } from './routes/profile'
import { Route as ScanRouteImport } from './routes/scan'
import { Route as StatsRouteImport } from './routes/stats'
import { Route as WorkoutRouteImport } from './routes/workout'
import { Route as SoundControlRouteImport } from './routes/sound-control'
import { Route as VisionRouteImport } from './routes/vision'
const make=(source:any,id:string,path:string)=>source.update({id,path,getParentRoute:()=>rootRouteImport} as any)
const IndexRoute=make(IndexRouteImport,'/','/')
const YouRoute=make(IndexRouteImport,'/you','/you')
const ScanRoute=make(ScanRouteImport,'/scan','/scan')
const MusicRoute=make(MusicRouteImport,'/music','/music')
const StatsRoute=make(StatsRouteImport,'/stats','/stats')
const AssistantRoute=make(AssistantRouteImport,'/assistant','/assistant')
const AuthRoute=make(AuthRouteImport,'/auth','/auth')
const BarcodeRoute=make(BudgetRouteImport,'/barcode','/barcode')
const BodyRoute=make(DeviceConnectRouteImport,'/body','/body')
const CheckinRoute=make(DiaryRouteImport,'/checkin','/checkin')
const DiaryStatsRoute=make(MoodRouteImport,'/diaryStats','/diaryStats')
const ExportRoute=make(ExportRouteImport,'/export','/export')
const FriendsRoute=make(FriendsRouteImport,'/friends','/friends')
const GalleryRoute=make(GalleryRouteImport,'/gallery','/gallery')
const InsightRoute=make(SoundControlRouteImport,'/insight','/insight')
const MoodBudgetRoute=make(VisionRouteImport,'/moodBudget','/moodBudget')
const NlpRoute=make(NlpRouteImport,'/nlp','/nlp')
const NotificationsRoute=make(NotificationsRouteImport,'/notifications','/notifications')
const PedometerRoute=make(PedometerRouteImport,'/pedometer','/pedometer')
const RouteRoute=make(SoundControlRouteImport,'/route','/route')
const WaterRoute=make(VisionRouteImport,'/water','/water')
const WorkoutRoute=make(WorkoutRouteImport,'/workout','/workout')
const ProfileRoute=make(ProfileRouteImport,'/profile','/profile')
export type FileRouteTypes=any
export type RootRouteChildren=any
declare module '@tanstack/react-router' { interface FileRoutesByPath { [key:string]: any } }
const rootRouteChildren:any={IndexRoute,YouRoute,ScanRoute,MusicRoute,StatsRoute,AssistantRoute,AuthRoute,BarcodeRoute,BodyRoute,CheckinRoute,DiaryStatsRoute,ExportRoute,FriendsRoute,GalleryRoute,InsightRoute,MoodBudgetRoute,NlpRoute,NotificationsRoute,PedometerRoute,RouteRoute,WaterRoute,WorkoutRoute,ProfileRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' { interface Register { ssr:true; router:Awaited<ReturnType<typeof getRouter>>; config:Awaited<ReturnType<typeof startInstance.getOptions>> } }
