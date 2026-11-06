import { lang } from '../i18n';
import { REPO_URL } from './Header';

/** Privacy policy and terms. Kept short and literal: what is (and is not) collected. */

type Doc = { title: string; updated: string; sections: [string, string[]][] };

const UPDATED = '2026-11-06';

const PRIVACY: Record<'en' | 'id', Doc> = {
  en: {
    title: 'Privacy Policy',
    updated: `Last updated ${UPDATED}`,
    sections: [
      ['Your files', [
        'Localkit processes PDFs and images entirely in your browser. Files are never uploaded to any server, including ours. The page security policy (CSP) only allows network requests to this site and to the optional Localkit API described below.',
      ]],
      ['Data kept on your device', [
        'Settings (language, theme), saved flows, the current flow draft and, if enabled, a history of jobs (file names, sizes and times, never file contents) are stored in your browser\'s local storage. The background-removal model and app files may be cached so the app works offline.',
        'You can erase all of it at any time in Settings → Erase all local data, or by clearing site data in your browser.',
      ]],
      ['Optional account and cloud save', [
        'Signing in is optional. If you sign in with Google, we receive your Google account ID, email address and name. We use them only to identify your account.',
        'With an account, your saved flows and settings, and, only if you turn on "Sync history", your history metadata (file names, sizes, times), are stored on our server so they are available on your other devices. Files are never sent.',
        'Sessions use a random token; the server stores only a hash of it. Sessions expire after 180 days without use.',
      ]],
      ['What we do not do', [
        'No analytics, no advertising, no tracking cookies, no third-party scripts. We do not sell or share your data with anyone.',
      ]],
      ['Where data is stored', [
        'The account database runs on a server operated by the developer of Localkit, behind Cloudflare. Data is sent over HTTPS.',
      ]],
      ['Deleting your data', [
        'Settings → Delete cloud account removes your account and everything stored for it on the server immediately. Signing out keeps the data on your device. Turning off "Sync history" deletes the cloud copy of your history.',
      ]],
      ['Google user data', [
        'Localkit\'s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We request only the basic openid, email and profile scopes.',
      ]],
      ['Contact', [`Questions or requests: open an issue at ${REPO_URL}.`]],
    ],
  },
  id: {
    title: 'Kebijakan Privasi',
    updated: `Terakhir diperbarui ${UPDATED}`,
    sections: [
      ['File kamu', [
        'Localkit mengolah PDF dan gambar sepenuhnya di browser kamu. File tidak pernah diunggah ke server mana pun, termasuk server kami. Kebijakan keamanan halaman (CSP) hanya mengizinkan permintaan jaringan ke situs ini dan ke API Localkit opsional di bawah.',
      ]],
      ['Data di perangkat kamu', [
        'Pengaturan (bahasa, tema), alur tersimpan, draft alur, dan, jika diaktifkan, riwayat proses (nama file, ukuran, waktu, tanpa isi file) disimpan di penyimpanan lokal browser. Model hapus background dan file aplikasi bisa di-cache supaya aplikasi jalan offline.',
        'Semuanya bisa dihapus kapan saja di Pengaturan → Hapus semua data lokal, atau dengan menghapus data situs di browser.',
      ]],
      ['Akun & cloud save (opsional)', [
        'Login bersifat opsional. Jika kamu login dengan Google, kami menerima ID akun Google, alamat email, dan nama. Data itu hanya dipakai untuk mengenali akun kamu.',
        'Dengan akun, alur tersimpan dan pengaturan, serta metadata riwayat (nama file, ukuran, waktu) hanya jika "Sinkronkan riwayat" diaktifkan, disimpan di server kami agar tersedia di perangkat lain. File tidak pernah dikirim.',
        'Sesi memakai token acak; server hanya menyimpan hash-nya. Sesi kedaluwarsa setelah 180 hari tidak dipakai.',
      ]],
      ['Yang tidak kami lakukan', [
        'Tanpa analitik, tanpa iklan, tanpa cookie pelacak, tanpa script pihak ketiga. Kami tidak menjual atau membagikan data kamu kepada siapa pun.',
      ]],
      ['Lokasi penyimpanan', [
        'Database akun berjalan di server yang dikelola pengembang Localkit, di belakang Cloudflare. Data dikirim lewat HTTPS.',
      ]],
      ['Menghapus data', [
        'Pengaturan → Hapus akun cloud langsung menghapus akun dan semua data milikmu di server. Keluar (sign out) tidak menghapus data di perangkat. Mematikan "Sinkronkan riwayat" menghapus salinan riwayat di cloud.',
      ]],
      ['Data pengguna Google', [
        'Penggunaan informasi dari Google API oleh Localkit mematuhi Google API Services User Data Policy, termasuk ketentuan Limited Use. Kami hanya meminta scope dasar openid, email, dan profile.',
      ]],
      ['Kontak', [`Pertanyaan atau permintaan: buka issue di ${REPO_URL}.`]],
    ],
  },
};

const TERMS: Record<'en' | 'id', Doc> = {
  en: {
    title: 'Terms of Use',
    updated: `Last updated ${UPDATED}`,
    sections: [
      ['The service', ['Localkit is a free tool that processes PDFs and images in your browser. It is open source under the MIT license.']],
      ['Your content', ['You keep all rights to your files. You are responsible for having the right to process them and for checking the results before you use them.']],
      ['No warranty', ['Localkit is provided "as is", without warranty of any kind. The developer is not liable for any loss or damage arising from its use, including lost or altered files. Keep copies of important originals.']],
      ['Accounts', ['The optional account is for syncing your own flows and settings. Do not abuse the service or try to access other accounts. Accounts may be removed if the service is misused.']],
      ['Changes', ['These terms may change; the date above shows the latest version. See also the Privacy Policy at /privacy.']],
    ],
  },
  id: {
    title: 'Ketentuan Penggunaan',
    updated: `Terakhir diperbarui ${UPDATED}`,
    sections: [
      ['Layanan', ['Localkit adalah alat gratis untuk mengolah PDF dan gambar di browser kamu. Kodenya terbuka dengan lisensi MIT.']],
      ['Konten kamu', ['Semua hak atas file tetap milikmu. Kamu bertanggung jawab memastikan berhak mengolah file tersebut dan memeriksa hasilnya sebelum dipakai.']],
      ['Tanpa jaminan', ['Localkit disediakan "apa adanya" tanpa jaminan apa pun. Pengembang tidak bertanggung jawab atas kerugian akibat penggunaannya, termasuk file yang hilang atau berubah. Simpan salinan file asli yang penting.']],
      ['Akun', ['Akun opsional dipakai untuk menyinkronkan alur dan pengaturanmu sendiri. Jangan menyalahgunakan layanan atau mencoba mengakses akun lain. Akun dapat dihapus bila terjadi penyalahgunaan.']],
      ['Perubahan', ['Ketentuan ini dapat berubah; tanggal di atas menunjukkan versi terbaru. Lihat juga Kebijakan Privasi di /privacy.']],
    ],
  },
};

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const doc = (kind === 'privacy' ? PRIVACY : TERMS)[lang.value];
  return (
    <main class="subpage narrow legal">
      <div class="page-head">
        <div>
          <h1>{doc.title}</h1>
          <p>{doc.updated}</p>
        </div>
      </div>
      {doc.sections.map(([h, ps]) => (
        <section key={h} class="s-card">
          <h2>{h}</h2>
          {ps.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
