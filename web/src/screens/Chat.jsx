import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { C, MONO, timeAgo } from "../theme.js";
import { getMatrixClient, startMatrixSync, isMatrixReady, getClient } from "../matrix.js";

// Matrix SDK event types
const EVT_MSG = "m.room.message";
const EVT_SYNC = "sync";
const EVT_TIMELINE = "Room.timeline";
const EVT_RECEIPT = "Room.receipt";
const EVT_REDACTION = "Room.redaction";

export function Chat({ onToast }) {
  const [client, setClient] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Init Matrix client
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getMatrixClient();
        if (cancelled) return;

        c.on(EVT_SYNC, (state) => {
          setSyncState(state);
          if (state === "SYNCING" || state === "PREPARED") {
            setRooms([...c.getRooms()].sort((a, b) =>
              (b.getLastActiveTimestamp?.() ?? 0) - (a.getLastActiveTimestamp?.() ?? 0)
            ));
          }
        });
        c.on(EVT_TIMELINE, () => {
          setRooms([...c.getRooms()].sort((a, b) =>
            (b.getLastActiveTimestamp?.() ?? 0) - (a.getLastActiveTimestamp?.() ?? 0)
          ));
        });
        c.on(EVT_RECEIPT, () => {
          setRooms([...c.getRooms()].sort((a, b) =>
            (b.getLastActiveTimestamp?.() ?? 0) - (a.getLastActiveTimestamp?.() ?? 0)
          ));
        });

        setClient(c);
        await startMatrixSync(c);
      } catch (e) {
        console.error("[chat] Init failed:", e);
        setError(e.message || "Не удалось подключиться к чату");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.accentBright, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em" }}>Подключение к TAO SPACE…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{
          padding: "8px 20px", borderRadius: 10, border: `1px solid ${C.border}`,
          background: C.surface, color: C.accentBright, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
        }}>Повторить</button>
      </div>
    );
  }

  if (!client) return null;

  if (activeRoom) {
    return <ChatArea client={client} roomId={activeRoom} onBack={() => setActiveRoom(null)} onToast={onToast} />;
  }

  return <RoomList client={client} rooms={rooms} syncState={syncState} onSelect={setActiveRoom} onToast={onToast} />;
}

// ═══════════════════════════════════════════════════════
// ROOM LIST
// ═══════════════════════════════════════════════════════

function RoomList({ client, rooms, syncState, onSelect, onToast }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState("groups"); // groups | people
  const userId = client.getUserId();

  // Split rooms into groups and DMs
  const { groups, dms } = useMemo(() => {
    const directMap = client.getAccountData("m.direct")?.getContent() || {};
    const dmIds = new Set();
    Object.values(directMap).forEach((ids) => { if (Array.isArray(ids)) ids.forEach((id) => dmIds.add(id)); });
    const g = [], d = [];
    for (const r of rooms) {
      if (dmIds.has(r.roomId) || (r.getJoinedMemberCount?.() === 2 && !r.name)) d.push(r);
      else g.push(r);
    }
    return { groups: g, dms: d };
  }, [rooms, client, userId]);

  const list = tab === "groups" ? groups : dms;
  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((r) => {
      const name = r.name || getDmName(r, userId);
      return name?.toLowerCase().includes(q);
    });
  }, [list, query, userId]);

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 0 12px", background: "rgba(9,22,39,0.8)", borderRadius: 8, marginBottom: 12 }}>
        <TabBtn active={tab === "groups"} onClick={() => setTab("groups")}>💬 Группы</TabBtn>
        <TabBtn active={tab === "people"} onClick={() => setTab("people")}>👤 Личные</TabBtn>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          marginLeft: "auto", width: 32, height: 32, borderRadius: 8, border: "none",
          background: C.surface, color: C.textMuted, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{showCreate ? "✕" : "+"}</button>
      </div>

      {/* Create */}
      {showCreate && <CreateRoom client={client} isDm={tab === "people"} onCreated={(id) => { setShowCreate(false); onSelect(id); }} onToast={onToast} />}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск…"
          style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, background: "rgba(9,22,39,0.8)", border: `1px solid ${C.border}`, color: C.text, fontSize: 11, fontFamily: "inherit", outline: "none" }} />
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textMuted, opacity: 0.6 }}>⌕</span>
      </div>

      {/* Sync indicator */}
      {syncState && syncState !== "SYNCING" && syncState !== "PREPARED" && (
        <div style={{ fontSize: 10, color: C.amber, textAlign: "center", marginBottom: 8 }}>
          {syncState === "ERROR" ? "Ошибка синхронизации" : syncState}
        </div>
      )}

      {/* Room cards */}
      {filtered.map((room) => (
        <RoomCard key={room.roomId} room={room} userId={userId} isDm={tab === "people"} onClick={() => onSelect(room.roomId)} />
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: C.textMuted, fontSize: 11 }}>
          {query ? "Ничего не найдено" : tab === "groups" ? "Нет групп — нажмите +" : "Нет диалогов — нажмите +"}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "7px 0", borderRadius: 6, border: active ? `1px solid ${C.border}` : "1px solid transparent",
      background: active ? C.surface : "transparent", color: active ? C.text : C.textMuted,
      fontSize: 11, fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

function RoomCard({ room, userId, isDm, onClick }) {
  const name = room.name || getDmName(room, userId);
  const lastEvt = room.timeline?.findLast?.((e) => e.getType() === EVT_MSG);
  const snippet = lastEvt?.getContent()?.body || "";
  const sender = lastEvt?.getSender?.() === userId ? "Вы" : (lastEvt?.sender?.name || "");
  const unread = room.getUnreadNotificationCount?.("total") || 0;
  const lastTs = room.getLastActiveTimestamp?.() ?? 0;
  const time = lastTs ? new Date(lastTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 12, border: `1px solid transparent`, background: "transparent",
      cursor: "pointer", textAlign: "left", fontFamily: "inherit", marginBottom: 2,
      transition: "background 0.15s",
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = C.surface}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: "rgba(96,165,250,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isDm ? 14 : 13, fontWeight: 600, color: C.accentBright, flexShrink: 0,
      }}>
        {isDm ? "💬" : name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ fontSize: 9, color: C.textMuted, flexShrink: 0, marginLeft: 8 }}>{time}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          <span style={{ fontSize: 10.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sender ? `${sender}: ${snippet}` : snippet || "\u00A0"}
          </span>
          {unread > 0 && (
            <span style={{
              flexShrink: 0, minWidth: 17, height: 17, borderRadius: "50%",
              background: C.accentBright, color: C.bg, fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", marginLeft: 4,
            }}>{unread > 99 ? "99+" : unread}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CreateRoom({ client, isDm, onCreated, onToast }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (isDm) {
        const target = name.includes(":") ? name.trim() : `@${name.trim()}:${client.getDomain()}`;
        const res = await client.createRoom({ is_direct: true, invite: [target], preset: "trusted_private_chat", visibility: "private" });
        const directMap = client.getAccountData("m.direct")?.getContent() || {};
        directMap[target] = [...(directMap[target] || []), res.room_id];
        await client.setAccountData("m.direct", directMap);
        onCreated(res.room_id);
      } else {
        const res = await client.createRoom({ name: name.trim(), preset: "private_chat", visibility: "private" });
        onCreated(res.room_id);
      }
    } catch (e) {
      onToast?.(e?.data?.error || e?.message || "Ошибка");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "rgba(9,22,39,0.8)", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10.5, color: C.textDim, marginBottom: 8 }}>{isDm ? "Написать" : "Новая группа"}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder={isDm ? "username" : "Название…"} autoFocus
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", marginBottom: 8 }} />
      <button onClick={create} disabled={busy || !name.trim()} style={{
        width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: C.accentBright, color: C.bg,
        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy || !name.trim() ? 0.3 : 1,
      }}>{busy ? "Создаю…" : isDm ? "Начать диалог" : "Создать"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CHAT AREA
// ═══════════════════════════════════════════════════════

function ChatArea({ client, roomId, onBack, onToast }) {
  const room = client.getRoom(roomId);
  const userId = client.getUserId();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!room) return;
    const refresh = () => {
      const evts = room.getLiveTimeline().getEvents().filter((e) => e.getType() === EVT_MSG && !e.isRedacted());
      setMessages([...evts]);
    };
    refresh();
    client.on(EVT_TIMELINE, refresh);
    client.on(EVT_REDACTION, refresh);
    return () => {
      client.removeListener(EVT_TIMELINE, refresh);
      client.removeListener(EVT_REDACTION, refresh);
    };
  }, [client, room, roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(async () => {
    if (!text.trim()) return;
    const msg = text; setText("");
    await client.sendTextMessage(roomId, msg.trim());
  }, [client, roomId, text]);

  const handleFile = useCallback(() => {
    if (uploading) return;
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const res = await client.uploadContent(file, { name: file.name });
        const url = typeof res === "string" ? res : res?.content_uri || res?.uri;
        if (!url) throw new Error("Upload failed");
        const isImage = file.type.startsWith("image/");
        await client.sendMessage(roomId, {
          body: file.name, filename: file.name,
          info: { size: file.size, mimetype: file.type },
          msgtype: isImage ? "m.image" : "m.file", url,
        });
      } catch (e) {
        onToast?.("Ошибка загрузки: " + (e?.message || e));
      } finally { setUploading(false); }
    };
    input.click();
  }, [client, roomId, uploading, onToast]);

  const memberCount = room?.getJoinedMemberCount?.() ?? 0;
  const roomName = room?.name || "Чат";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: `1px solid ${C.border}`, background: "rgba(5,11,26,0.6)",
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16, padding: 4, fontFamily: "inherit",
        }}>←</button>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: C.surface,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600, color: C.accentBright,
        }}>{roomName.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roomName}</div>
          <div style={{ fontSize: 9.5, color: C.textMuted }}>{memberCount} участник{memberCount !== 1 ? "ов" : ""}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 4px" }}>
        {messages.map((evt, i) => {
          const isOwn = evt.getSender() === userId;
          const content = evt.getContent();
          const body = content.body || "";
          const msgtype = content.msgtype;
          const senderName = evt.sender?.name || evt.getSender()?.split(":")[0].slice(1) || "";
          const time = new Date(evt.getTs()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const showSender = !isOwn && (i === 0 || messages[i - 1].getSender() !== evt.getSender());
          const mxcUrl = content.url;
          const httpUrl = mxcUrl ? client.mxcUrlToHttp(mxcUrl, 800, 600, "scale", false) : null;

          return (
            <div key={evt.getId()} style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 6, marginTop: showSender ? 14 : 0 }}>
              <div style={{
                maxWidth: "80%", padding: "8px 12px",
                background: isOwn ? "rgba(96,165,250,0.1)" : "rgba(14,33,56,0.8)",
                border: `0.5px solid ${isOwn ? "rgba(96,165,250,0.18)" : C.border}`,
                borderRadius: isOwn ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              }}>
                {showSender && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.accentBright, marginBottom: 2 }}>{senderName}</div>
                )}
                {msgtype === "m.image" && httpUrl ? (
                  <img src={httpUrl} alt={body} onClick={() => window.open(httpUrl, "_blank")}
                    style={{ borderRadius: 8, maxWidth: "100%", maxHeight: 200, objectFit: "cover", marginBottom: 4, cursor: "pointer" }} />
                ) : msgtype === "m.file" && httpUrl ? (
                  <a href={httpUrl} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8,
                    background: "rgba(96,165,250,0.06)", border: `0.5px solid ${C.border}`, textDecoration: "none", marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 14 }}>📎</span>
                    <span style={{ fontSize: 11, color: C.accentBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{body}</span>
                  </a>
                ) : (
                  <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{body}</div>
                )}
                <div style={{ fontSize: 8.5, color: C.textMuted, marginTop: 3, textAlign: isOwn ? "right" : "left" }}>{time}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        {messages.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, fontSize: 11 }}>Нет сообщений</div>
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}` }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 12px",
          borderRadius: 16, background: "rgba(9,22,39,0.8)", border: `1px solid ${C.border}`,
        }}>
          <button onClick={handleFile} disabled={uploading} style={{
            background: "none", border: "none", cursor: uploading ? "wait" : "pointer",
            color: C.textMuted, fontSize: 16, padding: 2, opacity: uploading ? 0.3 : 1,
          }}>{uploading ? "⏳" : "📎"}</button>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Сообщение…" rows={1}
            style={{
              flex: 1, background: "transparent", border: "none", resize: "none",
              color: C.text, fontSize: 12.5, fontFamily: "inherit", outline: "none",
              maxHeight: 100, lineHeight: 1.5,
            }} />
          <button onClick={send} disabled={!text.trim()} style={{
            width: 32, height: 32, borderRadius: 10, border: "none",
            background: text.trim() ? C.accentBright : C.surface,
            color: text.trim() ? C.bg : C.textMuted,
            cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            opacity: text.trim() ? 1 : 0.3,
          }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getDmName(room, myId) {
  const members = room.getJoinedMembers?.() || [];
  const other = members.find((m) => m.userId !== myId);
  return other?.name || other?.userId?.split(":")[0].slice(1) || room.name || "Диалог";
}
