import { Shell } from "@/components/wk-design";
import { LiveScan } from "./live-scan";

export function LiveScanPage(){
  return <Shell section="SCAN"><div className="wk-page"><div className="wk-heading"><span>CAPTURE</span><h1>Point, hold, resolve.</h1><p>Use the camera or upload a photo. WK will analyse the image, estimate nutrition and save the result to your diary.</p></div><div className="max-w-3xl"><LiveScan/></div></div></Shell>;
}
