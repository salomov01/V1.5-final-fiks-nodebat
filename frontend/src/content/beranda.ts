// Teks & gambar halaman publik. EDIT DI SINI untuk mengganti judul, deskripsi, dan sejarah.
// Gambar diambil dari folder src/assets/ — ganti file-nya atau ubah baris import di bawah.
import heroImg from "@/assets/hero-desa.jpg";
import sejarahDesaImg from "@/assets/sejarah-desa.jpg";
import sejarahPasarImg from "@/assets/sejarah-pasar.jpg";

export const HERO = {
  judul: "Desa Adat Jimbaran",
  subjudul: "Menjaga adat, budaya, dan perekonomian krama desa melalui Pasar Adat Jimbaran.",
  gambar: heroImg,
};

export const SEJARAH_DESA = {
  judul: "Sejarah Desa Adat Jimbaran",
  gambar: sejarahDesaImg,
  paragraf: [
    "Desa Adat Jimbaran merupakan salah satu desa adat tua di Kabupaten Badung, Bali, yang tumbuh di tepi teluk dan dikenal dengan kehidupan nelayan serta tradisi keagamaannya yang kuat.",
    "Nama Jimbaran dipercaya berasal dari kata 'jimbar' yang berarti luas — menggambarkan wilayah pesisir yang lapang.",
    "Hingga kini, kehidupan krama desa diatur oleh awig-awig dan dipimpin oleh Bendesa Adat, dengan pura-pura kahyangan desa sebagai pusat kegiatan spiritual.",
  ],
};

export const SEJARAH_PASAR = {
  judul: "Sejarah Pasar Adat Jimbaran",
  gambar: sejarahPasarImg,
  paragraf: [
    "Pasar Adat Jimbaran berawal dari tempat berkumpulnya krama desa untuk menukar hasil laut, kebun, dan perlengkapan upacara setiap pagi.",
    "Seiring waktu, pasar dikelola oleh desa adat agar manfaatnya kembali ke masyarakat — mulai dari pemeliharaan pura hingga kegiatan sosial.",
    "Kini pasar menampung pedagang harian, bulanan, dan tahunan, dengan pendataan lapak serta iuran yang tercatat secara digital.",
  ],
};
