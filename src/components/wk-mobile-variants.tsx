import type { ReactNode } from 'react';
import { Health, Vision, MobileHeader, MobileDock } from './wk-design';
import './wk-mobile-variants.css';
function MobileFrame({children,active='Overview'}:{children:ReactNode;active?:string}){return <div className="wk-mobile-frame"><MobileHeader/><div className="wk-mobile-screen">{children}</div><MobileDock active={active}/></div>}
export function MobileHealth(){return <MobileFrame><Health/></MobileFrame>}
export function MobileVision(){return <MobileFrame><Vision/></MobileFrame>}
