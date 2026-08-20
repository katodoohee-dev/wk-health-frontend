import { MobileShell } from './mobile-shell';
import { LiveScan } from './live-scan';

export function MobileScan(){
  return <MobileShell eyebrow="SCAN" active="SCAN"><main className="px-4 pt-8"><p className="eyebrow">CAPTURE</p><h1 className="display mt-2 text-[34px]">What did you eat?</h1><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Point at a plate, package or barcode. WK can capture the image, analyse it and save the result to your diary.</p><div className="mt-7"><LiveScan/></div></main></MobileShell>;
}
