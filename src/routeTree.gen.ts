/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AssistantRouteImport } from './routes/assistant'
import { Route as ActivityRouteImport } from './routes/activity'
import { Route as NavigateRouteImport } from './routes/navigate'
import { Route as FriendsRouteImport } from './routes/friends'
import { Route as NotificationsRouteImport } from './routes/notifications'
import { Route as ProfileRouteImport } from './routes/profile'
import { Route as SettingsRouteImport } from './routes/settings'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as StateLibraryRouteImport } from './routes/state-library'
import { Route as VisionRouteImport } from './routes/vision'
import { Route as ScanRouteImport } from './routes/scan'
import { Route as MusicRouteImport } from './routes/music'
import { Route as StatsRouteImport } from './routes/stats'
import { Route as DiaryRouteImport } from './routes/diary'
import { Route as MoodRouteImport } from './routes/mood'
import { Route as PedometerRouteImport } from './routes/pedometer'
import { Route as WorkoutRouteImport } from './routes/workout'
import { Route as SoundRouteImport } from './routes/sound'
import { Route as YouRouteImport } from './routes/you'
const make=(source:any,id:string,path:string)=>source.update({id,path,getParentRoute:()=>rootRouteImport} as any)
const IndexRoute=make(IndexRouteImport,'/','/')
const AssistantRoute=make(AssistantRouteImport,'/assistant','/assistant')
const ActivityRoute=make(ActivityRouteImport,'/activity','/activity')
const NavigateRoute=make(NavigateRouteImport,'/navigate','/navigate')
const FriendsRoute=make(FriendsRouteImport,'/friends','/friends')
const NotificationsRoute=make(NotificationsRouteImport,'/notifications','/notifications')
const ProfileRoute=make(ProfileRouteImport,'/profile','/profile')
const SettingsRoute=make(SettingsRouteImport,'/settings','/settings')
const AuthRoute=make(AuthRouteImport,'/auth','/auth')
const StateLibraryRoute=make(StateLibraryRouteImport,'/state-library','/state-library')
const VisionRoute=make(VisionRouteImport,'/vision','/vision')
const ScanRoute=make(ScanRouteImport,'/scan','/scan')
const MusicRoute=make(MusicRouteImport,'/music','/music')
const StatsRoute=make(StatsRouteImport,'/stats','/stats')
const DiaryRoute=make(DiaryRouteImport,'/diary','/diary')
const MoodRoute=make(MoodRouteImport,'/mood','/mood')
const PedometerRoute=make(PedometerRouteImport,'/pedometer','/pedometer')
const WorkoutRoute=make(WorkoutRouteImport,'/workout','/workout')
const SoundRoute=make(SoundRouteImport,'/sound','/sound')
const YouRoute=make(YouRouteImport,'/you','/you')
export type FileRouteTypes=any
export type RootRouteChildren=any
declare module '@tanstack/react-router' { interface FileRoutesByPath { [key:string]: any } }
const rootRouteChildren:any={IndexRoute,AssistantRoute,ActivityRoute,NavigateRoute,FriendsRoute,NotificationsRoute,ProfileRoute,SettingsRoute,AuthRoute,StateLibraryRoute,VisionRoute,ScanRoute,MusicRoute,StatsRoute,DiaryRoute,MoodRoute,PedometerRoute,WorkoutRoute,SoundRoute,YouRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' { interface Register { ssr:true; router:Awaited<ReturnType<typeof getRouter>>; config:Awaited<ReturnType<typeof startInstance.getOptions>> } }
