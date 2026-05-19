import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div><h3 className="text-xl font-bold">MediConnect</h3><p className="mt-3 text-sm text-slate-300">Монголын эмч, эмнэлэг, өвчтөнүүдийг найдвартай холбох онлайн эрүүл мэндийн платформ.</p></div>
        <div><h4 className="font-semibold">Үйлчилгээ</h4><div className="mt-3 grid gap-2 text-sm text-slate-300"><Link href="/?appointment=select" prefetch={false}>Цаг захиалах</Link><Link href="/consultation" prefetch={false}>Зөвлөгөө авах</Link><Link href="/dashboard/patient?section=labs" prefetch={false}>Шинжилгээний хариу</Link></div></div>
        <div><h4 className="font-semibold">Платформ</h4><div className="mt-3 grid gap-2 text-sm text-slate-300"><Link href="/doctors" prefetch={false}>Эмч</Link><Link href="/hospitals" prefetch={false}>Эмнэлэг</Link><Link href="/dashboard/patient" prefetch={false}>Хянах самбар</Link></div></div>
        <div><h4 className="font-semibold">Холбоо барих</h4><p className="mt-3 text-sm text-slate-300">Улаанбаатар хот<br />1800-2026<br />support@mediconnect.mn</p></div>
      </div>
    </footer>
  );
}
