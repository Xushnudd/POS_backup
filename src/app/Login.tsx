"use client";

import { FormEvent, useState } from "react";

type IconType = "mail" | "eye" | "shield";

const Icon = ({ type }: { type: IconType }) => {
  const path = type === "mail"
    ? <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 8 10 7L22 8" /></>
    : type === "eye"
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" /><circle cx="12" cy="12" r="3" /></>
      : <path d="M12 2 4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4Z" />;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8">
      {path}
    </svg>
  );
};

export default function Login() {
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log({ login, password, remember });
  };

  return (
    <main className="min-h-screen w-full text-base" style={{ backgroundColor: "#f6f7f8", color: "#17191b" }}>
      <style>{`.layout{grid-template-columns:1fr}.aside{display:none}.field:focus{border-color:#087352;box-shadow:0 0 0 2px rgba(8,115,82,.1)}.submit:hover{background-color:#075c42}@media(min-width:1024px){.layout{grid-template-columns:46% 54%}.aside{display:flex;padding:40px}}@media(min-width:1280px){.aside{padding:42px}}`}</style>
      <div className="layout grid min-h-screen w-full overflow-hidden bg-white">
      <section className="aside hidden flex-col justify-start p-10 lg:flex" style={{ backgroundColor: "#f6f7f8" }}>
        <div className="grid place-items-center rounded-sm bg-white" style={{ height: 58, width: 58, boxShadow: "0 2px 8px rgba(30,50,60,0.04)" }}>
          <div className="flex flex-col items-center justify-center font-extrabold leading-none" style={{ fontSize: 6, color: "#087352" }}>
            <span className="mb-1 grid h-5 w-7 place-items-center rounded-sm text-white" style={{ borderRadius: 2, backgroundColor: "#087352" }}>
              <svg width="22" height="16" viewBox="0 0 28 22" fill="none" aria-hidden="true">
                <rect y="4" width="28" height="14" rx="2" fill="white" />
                <rect x="4" width="20" height="6" rx="1" fill="#2ecc71" />
                <rect x="6" y="8" width="6" height="6" rx="1" fill="#087352" />
                <rect x="16" y="8" width="6" height="6" rx="1" fill="#087352" />
              </svg>
            </span>
            SHUNI POS
          </div>
        </div>
        <div className="mt-8">
          <h1 className="font-extrabold leading-tight" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Savdoning<br />aqlli usuli.
          </h1>
          <p className="mt-5 leading-5" style={{ color: "#697177", fontSize: 13 }}>
            Biznesingizni boshqarish uchun tezkor, ishonchli va<br />xavfsiz tizim.
          </p>
        </div>
        <div className="mt-auto flex w-fit items-center gap-3 rounded-xl border bg-white px-5 py-4" style={{ borderColor: "#e4e7eb", boxShadow: "0 2px 8px rgba(30,50,60,0.03)" }}>
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: "#e8f5ef", color: "#087352" }}>
            <Icon type="shield" />
          </span>
          <div>
            <b className="block text-sm">Tizim himoyalangan</b>
            <small className="text-xs text-gray-400">Barcha ma’lumotlar shifrlangan</small>
          </div>
        </div>
      </section>

      <section className="flex w-full items-center justify-center bg-white p-7 sm:p-14 lg:w-auto">
        <form onSubmit={submit} className="w-full max-w-360">
          <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: -0.3 }}>Xush kelibsiz</h2>
          <p className="mt-2 leading-5" style={{ color: "#697177", fontSize: 13 }}>
            Hisobingizga kirish uchun ma’lumotlarni kiriting.
          </p>
          <div className="relative mt-9">
            <input value={login} onChange={(e) => setLogin(e.target.value)}
              placeholder="Email yoki Login" required
              aria-label="Email yoki Login"
              className="field h-12 w-full rounded-lg border px-4 outline-none transition" style={{ borderColor: "#e1e4e8", backgroundColor: "#f4f5f7", fontSize: 13 }} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon type="mail" />
            </span>
          </div>
          <div className="relative mt-5">
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"} placeholder="Parol" required
              aria-label="Parol"
              className="field h-12 w-full rounded-lg border px-4 outline-none transition" style={{ borderColor: "#e1e4e8", backgroundColor: "#f4f5f7", fontSize: 13 }} />
            <button type="button" aria-label={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"} onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon type="eye" />
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between" style={{ fontSize: 13 }}>
            <label className="flex items-center gap-2" style={{ color: "#697177" }}>
              <input type="checkbox" checked={remember}
                onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5" style={{ accentColor: "#087352" }} />
              Meni eslab qol
            </label>
            <a href="#" className="font-semibold" style={{ color: "#087352" }}>Parolni unutdingizmi?</a>
          </div>
          <button type="submit"
            className="submit mt-6 h-12 w-full rounded-lg font-semibold text-white shadow transition" style={{ backgroundColor: "#087352", fontSize: 13, boxShadow: "0 4px 10px rgba(8,115,82,0.18)" }}>
            Kirish&nbsp; <span aria-hidden="true">→</span>
          </button>
          <div className="mt-7 space-y-3 text-center" style={{ fontSize: 13, color: "#8a9299" }}>
            Yordam kerakmi? <a href="#" className="font-semibold" style={{ color: "#087352" }}>Qo’llab-quvvatlash bo’limi</a><br />
            Hisobingiz yo’qmi? <a href="#" className="font-semibold" style={{ color: "#087352" }}>Ro’yxatdan o’ting</a>
          </div>
        </form>
      </section>
      </div>
    </main>
  );
}
