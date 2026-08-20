import { createFileRoute } from "@tanstack/react-router";
import { Scan as DesktopScan } from "@/components/wk-design";
import { MobileScan } from "@/components/wk/mobile-scan";
export const Route=createFileRoute("/scan")({component:()=> <><div className="hidden lg:block"><DesktopScan/></div><MobileScan/></>});
