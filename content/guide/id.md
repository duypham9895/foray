# Panduan

Penjelasan singkat tentang cara foray bekerja, apa yang dilakukannya untukmu, dan cara menggunakannya dengan efektif.

---

## Apa itu foray (dan bukan apa)

foray adalah ruang komando kampanye pencarian kerjamu. Setiap pagi kamu masuk, melihat apa yang bergerak, memutuskan langkah berikutnya, lalu keluar. Ini adalah sebuah *tempat* — bukan sekadar alat pencatat.

Alat pencatat itu pasif — kamu yang harus memasukkan data ke dalamnya. foray sebaliknya: ia memantau kotak masukmu, mencatat lamaran baru yang kamu mulai, dan hanya menampilkan segelintir keputusan yang menunggumu. Sisanya tidak mengganggumu.

---

## Pagimu, dalam 3 menit

Buka halaman **Hari Ini**. Tiga bagian, berurutan dari yang paling mendesak:

1. **Keputusan** — hal-hal yang menunggumu. Tawaran yang belum dijawab; email yang pengklasifikasi tidak yakin. Satu klik mengonfirmasi klasifikasi; klik kedua membuka foray lengkap.
2. **Wawancara hari ini** — apa pun yang ada di kalender hari ini, diambil dari tahap yang sudah kamu tambahkan ke foray-mu.
3. **Sunyi** — foray yang tidak ada perkembangan lebih dari 7 hari. Tidak merah, tidak berisik — hanya daftar untuk dilihat sekilas kalau mau mengingatkan seseorang.

Sidebar selalu menampilkan **hitungan pipeline** — melamar, penyaringan, wawancara, penawaran, ditutup. Kamu bisa berhenti membaca begitu sudah melihat apa yang perlu dilihat.

---

## Menambah foray

Tiga cara, tergantung konteks:

- **Dari mana saja — ⌘K**. Membuka modal tangkap cepat dengan perusahaan, posisi, dan URL. Gunakan saat kamu sudah ada di dalam aplikasi.
- **Bookmarklet**. Seret dari Pengaturan ke bilah bookmark. Klik di halaman lowongan mana pun; judul, URL, dan teks yang dipilih akan terisi otomatis ke foray baru.
- **Formulir lengkap** di `/applications/new`. Kolom yang sama ditambah kisaran gaji, lokasi, sumber, catatan. Gunakan saat ingin mencatat dengan teliti.

Kamu tidak perlu mengisi semuanya saat menambah. Tahap wawancara, catatan, dan sisanya bisa ditambahkan nanti dari halaman detail foray.

---

## Hubungkan Gmail (dan alasannya)

Di Pengaturan, tekan **Hubungkan Gmail**. Layar OAuth akan meminta akses baca ke kotak masukmu.

Yang terjadi setelah terhubung:

- Cron job memindai Gmail setiap 15 menit.
- Setiap email baru diklasifikasi — *penolakan*, *undangan wawancara*, *rekruter menghubungi*, *tidak relevan*, atau *tidak cocok*.
- Klasifikasi dengan kepercayaan tinggi (≥85%) secara otomatis memperbarui status foray yang sesuai. Kamu melihatnya di timeline.
- Klasifikasi dengan kepercayaan rendah masuk ke **antrean ulasan** di `/inbox`, dan tiga teratas muncul di halaman Hari Ini.

**Yang disimpan**: subjek, pengirim, dan 500 karakter pertama dari setiap email. Isi lengkap hanya dimuat saat kamu membuka baris di `/inbox`.

**Peringatan 7 hari**: saat Gmail OAuth dalam mode Uji Coba, Google mungkin mencabut refresh token setelah tujuh hari. Jika sinkronisasi sudah lama, Pengaturan akan menampilkan banner peringatan dan kamu bisa menghubungkan kembali.

---

## Antrean ulasan

Saat pengklasifikasi tidak yakin, email masuk ke `/inbox` dengan tebakan terbaik dan persentase kepercayaan. Kamu punya empat tindakan untuk setiap baris:

- **Konfirmasi** — terima label dari pengklasifikasi. Status foray diperbarui.
- **Ubah** — pilih label yang benar dari dropdown.
- **Tautkan ke foray** — jika pengklasifikasi tidak menemukan foray yang cocok dan kamu tahu milik foray mana.
- **Abaikan** — tandai sebagai tidak relevan, tidak mengubah foray mana pun.

Antrean kosong = kamu sudah menyelesaikan semuanya. Halaman Hari Ini mencerminkan itu dengan nada yang lebih tenang.

---

## Tahap vs status kanonik

Dua lapisan status, dengan tujuan yang berbeda:

- **Status kanonik** adalah salah satu dari enam status tetap: melamar, penyaringan, wawancara, penawaran, ditolak, ditarik. Digunakan untuk filter, kolom kanban, strip pipeline — di mana pun kamu membandingkan antar foray.
- **Tahap** bersifat bebas per foray. "Panggilan rekruter", "Babak teknis 2", "Bar raiser", "On-site". Perusahaan berbeda menjalankan proses wawancara yang berbeda; tahap memungkinkanmu mencatat dengan tepat sedang di mana.

Sebuah foray bisa berada di status kanonik `wawancara` sementara tahap saat ini adalah "Babak teknis 2 dari 3". Keduanya menjawab pertanyaan yang berbeda: status adalah "di mana dalam pipeline?", tahap adalah "di mana dalam proses perusahaan ini?".

---

## Gerak cepat

- **⌘K** dari mana saja → modal tangkap cepat
- **Klik kartu di papan** → detail foray dengan timeline + catatan
- **Filter berdasarkan status** di `/applications` → URL adalah sumber kebenaran, bagikan link untuk berbagi filter
- **Beralih Papan / Daftar** di `/applications` → papan untuk melihat sekilas, daftar untuk menyortir berdasarkan tanggal
- **Bahasa** di Pengaturan → English / Tiếng Việt / Bahasa Indonesia. Konten pekerjaan tetap dalam bahasa aslinya; hanya antarmuka yang diterjemahkan.

---

## Apa yang TIDAK dilakukan foray

Batasan yang jujur, ditetapkan sejak awal:

- **Tidak akan melamar untukmu.** Menambah foray hanya satu klik; lamarannya sendiri adalah tugasmu.
- **Tidak akan memotivasimu.** Tidak ada streak, tidak ada loop dopamin, tidak ada tulisan "kamu pasti bisa". Produk memberimu data; motivasi adalah milikmu.
- **Tidak akan melacak perusahaan yang tidak kamu lamar.** Setiap foray adalah yang kamu mulai sendiri.
- **Tidak akan menyimpan isi email selamanya.** Hanya kutipan, isi lengkap dimuat saat dibutuhkan. Privasi adalah prioritas utama.
- **Tidak akan berpura-pura pengklasifikasi selalu benar.** Apa pun di bawah 85% kepercayaan ada di antrean ulasan dengan persentase yang ditampilkan — kamu bisa melihat apa yang dipikirkan model lalu memutuskan.

Itu saja. Buka [halaman Hari Ini](/today) dan lihat sendiri.
