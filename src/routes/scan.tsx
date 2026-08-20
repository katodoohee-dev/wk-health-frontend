import { createFileRoute } from "@tanstack/react-router";
import { LiveScanPage } from "@/components/wk/live-scan-page";
import { MobileScan } from "@/components/wk/mobile-scan";
export const Route=createFileRoute("/scan")({component:()=> <><div className="hidden lg:block"><LiveScanPage/></div><div className="lg:hidden"><MobileScan/></div></>});
