import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PendaftaranList from "@/components/katalog/PendaftaranList";
import UnitLapakManager from "@/components/katalog/UnitLapakManager";

export default function Pendaftaran() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-pendaftaran">
        Pendaftaran &amp; Katalog Lapak
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Konfirmasi pendaftar dari halaman publik dan kelola daftar lapak yang ditampilkan.
      </p>
      <Tabs defaultValue="pendaftaran" className="mt-6">
        <TabsList>
          <TabsTrigger value="pendaftaran" data-testid="tab-pendaftaran">Pendaftaran</TabsTrigger>
          <TabsTrigger value="katalog" data-testid="tab-katalog">Katalog Lapak</TabsTrigger>
        </TabsList>
        <TabsContent value="pendaftaran" className="mt-4">
          <PendaftaranList />
        </TabsContent>
        <TabsContent value="katalog" className="mt-4">
          <UnitLapakManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
