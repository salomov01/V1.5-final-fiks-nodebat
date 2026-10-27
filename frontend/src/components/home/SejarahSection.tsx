import { cn } from "@/lib/utils";

interface Props {
  judul: string;
  gambar: string;
  paragraf: string[];
  terbalik?: boolean; // true = foto di kanan
  testid: string;
}

// Section sejarah: foto di satu sisi, teks di sisi lain (grid 2 kolom di layar lebar).
export default function SejarahSection({ judul, gambar, paragraf, terbalik, testid }: Props) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24" data-testid={testid}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cn("overflow-hidden rounded-3xl shadow-lg", terbalik && "lg:order-2")}>
          <img src={gambar} alt={judul} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105" />
        </div>
        <div>
          <span className="block h-1 w-14 rounded-full bg-brand" />
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{judul}</h2>
          <div className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-slate-700">
            {paragraf.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </div>
    </section>
  );
}
