import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { getLegal } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegal("terms");
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: "/terms" },
  };
}

export default async function Terms() {
  return <LegalPage doc={await getLegal("terms")} />;
}
