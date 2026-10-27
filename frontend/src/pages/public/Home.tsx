import PublicLayout from "@/components/layout/PublicLayout";
import Hero from "@/components/home/Hero";
import SejarahSection from "@/components/home/SejarahSection";
import { SEJARAH_DESA, SEJARAH_PASAR } from "@/content/beranda";

// Halaman Home publik: Hero → Sejarah Desa → Sejarah Pasar.
export default function Home() {
  return (
    <PublicLayout>
      <Hero />
      <div className="bg-white">
        <SejarahSection {...SEJARAH_DESA} testid="section-sejarah-desa" />
      </div>
      <SejarahSection {...SEJARAH_PASAR} terbalik testid="section-sejarah-pasar" />
    </PublicLayout>
  );
}
