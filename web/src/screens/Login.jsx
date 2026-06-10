import { useState, useEffect, useRef } from "react";
import { C } from "../theme.js";
import { api, setToken } from "../api.js";
import { GeodesicSphere } from "../components/GeodesicSphere.jsx";
import { TgIcon, PhoneIcon, MailIcon } from "../components/ui.jsx";

const Card = ({ children }) => (
  <div style={{ background: "rgba(10,20,40,0.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 18, padding: "24px 22px", boxShadow: `0 0 40px rgba(96,165,250,0.08)` }}>{children}</div>
);
const Button = ({ children, onClick, primary, disabled, type = "button" }) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: "13px 0", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, fontSize: 14, fontFamily: "inherit", transition: "all 0.2s",
    background: primary ? "rgba(96,165,250,0.18)" : "transparent",
    border: `1px solid ${primary ? C.borderStrong : C.border}`,
    color: primary ? C.accentBright : C.textDim,
    opacity: disabled ? 0.4 : 1,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  }}>{children}</button>
);
const Input = (props) => (
  <input {...props}
    style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", transition: "border-color 0.2s" }}
    onFocus={(e) => e.target.style.borderColor = C.borderStrong}
    onBlur={(e) => e.target.style.borderColor = C.border}
  />
);
const BackBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>← Назад</button>
);
const Err = ({ msg }) => msg ? (
  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: C.red, fontSize: 12 }}>{msg}</div>
) : null;

export function Login({ onAuth }) {
  const [step, setStep] = useState("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [tgState, setTgState] = useState(null);
  const [tgLink, setTgLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const tgTimer = useRef(null);

  const reset = () => { setBusy(false); setErr(""); };

  const startPhone = async () => {
    reset(); setBusy(true);
    try { await api.phoneRequest(phone); setStep("phone-otp"); }
    catch (e) { setErr(translateErr(e)); }
    finally { setBusy(false); }
  };

  const verifyPhone = async () => {
    reset(); setBusy(true);
    try {
      const { token, user } = await api.phoneVerify(phone, otp);
      setToken(token); onAuth(user);
    } catch (e) { setErr(translateErr(e)); }
    finally { setBusy(false); }
  };

  const startEmail = async () => {
    reset(); setBusy(true);
    try { await api.emailRequest(email); setStep("email-sent"); }
    catch (e) { setErr(translateErr(e)); }
    finally { setBusy(false); }
  };

  const verifyEmail = async () => {
    reset(); setBusy(true);
    try {
      const { token, user } = await api.emailVerify(email, emailCode);
      setToken(token); onAuth(user);
    } catch (e) { setErr(translateErr(e)); }
    finally { setBusy(false); }
  };

  const startTg = async () => {
    reset(); setBusy(true);
    try {
      const { state, deepLink } = await api.tgStart();
      setTgState(state); setTgLink(deepLink); setStep("tg");
      tgTimer.current = setInterval(async () => {
        try {
          const r = await api.tgPoll(state);
          if (r.status === "confirmed") {
            clearInterval(tgTimer.current);
            setToken(r.token); onAuth(r.user);
          }
          if (r.status === "expired") {
            clearInterval(tgTimer.current);
            setErr("Срок действия ссылки истёк. Начните заново.");
          }
        } catch {}
      }, 2500);
    } catch (e) { setErr(translateErr(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => () => { if (tgTimer.current) clearInterval(tgTimer.current); }, []);

  return (
    <div style={{ minHeight: "100vh", padding: "60px 20px 40px", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "inline-flex", marginBottom: 18 }}>
          <GeodesicSphere size={88} glow={20} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6, color: C.text }}>
          TAO <span style={{ color: C.accentBright, textShadow: `0 0 16px ${C.cyanGlow}` }}>VPN</span>
        </div>
        <div style={{ fontSize: 13, color: C.textDim }}>Приватный доступ для своих</div>
      </div>

      <Card>
        {step === "choose" && (<>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Вход или регистрация</div>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Выберите способ подтверждения личности</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button primary onClick={() => startTg()} disabled={busy}><TgIcon /> Telegram</Button>
            <Button onClick={() => setStep("phone")}><PhoneIcon /> Номер телефона</Button>
            <Button onClick={() => setStep("email")}><MailIcon /> Email</Button>
          </div>
          <div style={{ marginTop: 18, fontSize: 11, color: C.textMuted, textAlign: "center", lineHeight: 1.6 }}>
            Регистрация по приглашению. Если вас нет в списке —<br/>напишите администратору.
          </div>
          <Err msg={err} />
        </>)}

        {step === "tg" && (<>
          <BackBtn onClick={() => { clearInterval(tgTimer.current); setStep("choose"); }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text }}>Вход через Telegram</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20, lineHeight: 1.5 }}>
            Откройте бот и нажмите <b style={{ color: C.accentBright }}>Start</b>.
            После подтверждения вход произойдёт автоматически.
          </div>
          <a href={tgLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Button primary><TgIcon /> Открыть бот</Button>
          </a>
          <div style={{ marginTop: 14, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
            Ожидаем подтверждение… Если Telegram недоступен — выберите другой способ.
          </div>
          <Err msg={err} />
        </>)}

        {step === "phone" && (<>
          <BackBtn onClick={() => setStep("choose")} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text }}>Номер телефона</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>Пришлём SMS с кодом подтверждения</div>
          <div style={{ marginBottom: 14 }}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123 45 67" type="tel" />
          </div>
          <Button primary onClick={startPhone} disabled={busy || phone.length < 10}>Получить код</Button>
          <Err msg={err} />
        </>)}

        {step === "phone-otp" && (<>
          <BackBtn onClick={() => setStep("phone")} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text }}>Код из SMS</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>Отправили на <span style={{ color: C.accentBright }}>{phone}</span></div>
          <div style={{ marginBottom: 14 }}>
            <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="• • • •" type="tel" maxLength={4} inputMode="numeric" />
          </div>
          <Button primary onClick={verifyPhone} disabled={busy || otp.length !== 4}>Подтвердить</Button>
          <Err msg={err} />
        </>)}

        {step === "email" && (<>
          <BackBtn onClick={() => setStep("choose")} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text }}>Email</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>Пришлём magic-link и код</div>
          <div style={{ marginBottom: 14 }}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" type="email" />
          </div>
          <Button primary onClick={startEmail} disabled={busy || !email.includes("@")}>Отправить ссылку</Button>
          <Err msg={err} />
        </>)}

        {step === "email-sent" && (<>
          <BackBtn onClick={() => setStep("email")} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text }}>Проверьте почту</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16, lineHeight: 1.5 }}>
            Письмо отправлено на<br/><span style={{ color: C.accentBright }}>{email}</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))} placeholder="Код из письма" type="tel" maxLength={6} inputMode="numeric" />
          </div>
          <Button primary onClick={verifyEmail} disabled={busy || emailCode.length < 6}>Войти</Button>
          <Err msg={err} />
        </>)}
      </Card>

      <div style={{ marginTop: "auto", paddingTop: 32, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        © TAO VPN · v1.0
      </div>
    </div>
  );
}

function translateErr(e) {
  const code = e?.message || e?.data?.error;
  const map = {
    no_invite: "Вы не в списке приглашённых. Напишите администратору.",
    otp_wrong: "Неверный код",
    otp_expired: "Срок действия кода истёк",
    too_many_attempts: "Слишком много попыток. Попробуйте позже.",
    bad_phone: "Неверный номер",
    bad_email: "Неверный email",
  };
  return map[code] || e?.message || "Ошибка соединения";
}
