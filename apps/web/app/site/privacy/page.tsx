import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { getLegal } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegal("privacy");
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: "/privacy" },
  };
}

export default async function Privacy() {
  return <LegalPage doc={await getLegal("privacy")} />;
}
