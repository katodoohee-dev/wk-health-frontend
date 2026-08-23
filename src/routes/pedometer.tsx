import { createFileRoute } from "@tanstack/react-router";
import { PedometerPage } from "@/components/app/pedometer-page";

export const Route = createFileRoute("/pedometer")({
  head: () => ({
    meta: [
      { title: "นับก้าวเดิน — WK Health App" },
      { name: "description", content: "ติดตามจำนวนก้าว ระยะทาง แคลอรีที่เผาผลาญ และเส้นทาง GPS" },
    ],
  }),
  component: PedometerPage,
});
