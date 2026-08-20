import { createFileRoute } from "@tanstack/react-router";
import { MobileScan } from "@/components/wk/mobile-scan";
export const Route=createFileRoute("/barcode")({component:MobileScan});
