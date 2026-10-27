import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { HERO } from "@/content/beranda";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Hero halaman Home: judul besar di atas foto desa. Teks diatur di src/content/beranda.ts
export default function Hero() {
  return (
    <section className="relative overflow-hidden" data-testid="hero">
      <img src={HERO.gambar} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/20" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-36">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand animate-in fade-in duration-500">Om Swastiastu</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-3 duration-700" data-testid="hero-judul">
          {HERO.judul}
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-700 animate-in fade-in duration-1000">{HERO.subjudul}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/informasi-lapak" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")} data-testid="hero-btn-lapak">
            Lihat Lapak Kosong <ArrowRight data-icon="inline-end" className="size-4" />
          </Link>
          <Link to="/info-pasar" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full bg-white px-6")} data-testid="hero-btn-info">
            Info Pasar
          </Link>
        </div>
      </div>
    </section>
  );
}
