import type { Metadata } from "next";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Pibu UI components" };

export default function UiDemoPage() {
  return <Showcase />;
}
