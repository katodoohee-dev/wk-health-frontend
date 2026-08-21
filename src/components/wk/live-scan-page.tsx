import { AppShell } from "@/components/wk/app-shell";
import { LiveScan } from "./live-scan";

export function LiveScanPage(){
  return <AppShell eyebrow="Capture" title="Point, hold, resolve."><div className="wk-page"><p className="mb-6 text-sm text-muted-foreground">Use the camera or upload a photo. WK will analyse the image, estimate nutrition and save the result to your diary.</p><div className="max-w-3xl"><LiveScan/></div></div></AppShell>;
}
