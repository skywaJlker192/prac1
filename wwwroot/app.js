"use strict";

const $ = (id) => document.getElementById(id);

let currentRoom = "";
let streamSubscription = null;
let typingTimer = null;
let typingHideTimer = null;
const streamValues = [];
const maxStreamPoints = 40;

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/monitor")
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .build();

function shortId(id) {
    return id ? id.substring(0, 6) : "?";
}

function addToFeed(kind, label, text) {
    const row = document.createElement("div");
    row.className = "msg " + kind;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = label;

    row.append("[" + new Date().toLocaleTimeString() + "] ", tag, text);

    const feed = $("feed");
    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
}

function setStatus(text, cssClass) {
    const status = $("status");
    status.textContent = text;
    status.className = "status " + cssClass;
}

async function call(method, ...args) {
    try {
        return await connection.invoke(method, ...args);
    } catch (err) {
        addToFeed("error", "Ошибка: ", err.message);
        return null;
    }
}

async function post(url, body) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            addToFeed("error", "Ошибка: ", data.error || ("HTTP " + response.status));
        }
    } catch (err) {
        addToFeed("error", "Ошибка: ", err.message);
    }
}

function setCurrentRoom(room) {
    currentRoom = room;
    $("currentRoom").textContent = room || "нет";
}

connection.on("UserConnected", (id) => {
    addToFeed("info", "Подключился: ", shortId(id));
});

connection.on("UserDisconnected", (id) => {
    addToFeed("info", "Отключился: ", shortId(id));
});

connection.on("ReceiveMessage", (id, text) => {
    addToFeed("broadcast", shortId(id) + ": ", text);
});

connection.on("JoinedRoom", (room) => {
    setCurrentRoom(room);
    addToFeed("info", "Вы вошли в комнату: ", room);
});

connection.on("LeftRoom", (room) => {
    if (currentRoom === room) {
        setCurrentRoom("");
    }
    addToFeed("info", "Вы вышли из комнаты: ", room);
});

connection.on("ReceiveRoomMessage", (id, room, text) => {
    const sender = id === "HTTP" ? "HTTP" : shortId(id);
    addToFeed("room", "[Комната " + room + "] " + sender + ": ", text);
});

connection.on("OnlineCountUpdated", (count) => {
    $("onlineCount").textContent = count;
});

connection.on("SystemMessage", (text) => {
    addToFeed("system", "Система: ", text);
});

connection.on("ReceivePrivateMessage", (id, text) => {
    const sender = id === "HTTP" ? "HTTP" : shortId(id);
    addToFeed("private", "Приватное от " + sender + ": ", text);
});

connection.on("PrivateSent", (targetId, text) => {
    addToFeed("private", "Приватное для " + shortId(targetId) + ": ", text);
});

// Доп. задание (средний уровень): список пользователей
let lastUsers = [];

function renderUsers() {
    const users = lastUsers;
    const body = $("usersBody");
    body.innerHTML = "";

    users.forEach((user) => {
        const row = document.createElement("tr");
        if (user.connectionId === connection.connectionId) {
            row.className = "me";
        }

        const idCell = document.createElement("td");
        idCell.textContent = user.connectionId + (user.connectionId === connection.connectionId ? " (вы)" : "");

        const roomCell = document.createElement("td");
        roomCell.textContent = user.room ? user.room : "без комнаты";

        row.append(idCell, roomCell);
        row.addEventListener("click", () => {
            $("toInput").value = user.connectionId;
        });
        body.appendChild(row);
    });
}

connection.on("UsersUpdated", (users) => {
    lastUsers = users;
    renderUsers();
});

// Доп. задание (лёгкий уровень): индикатор «Печатает…»
connection.on("UserTyping", () => {
    $("typing").textContent = "Пользователь печатает…";
    clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(() => {
        $("typing").textContent = "";
    }, 2000);
});

connection.onreconnecting(() => {
    setStatus("Переподключение…", "reconnecting");
});

connection.onreconnected(() => {
    setStatus("Подключено", "ok");
    $("myId").textContent = connection.connectionId;
    renderUsers();

    if (currentRoom) {
        call("JoinRoom", currentRoom);
    }
});

connection.onclose(() => {
    setStatus("Соединение потеряно", "bad");
    $("myId").textContent = "—";
    stopStream();
});

$("sendBtn").addEventListener("click", async () => {
    const text = $("messageInput").value.trim();
    if (!text) return;
    await call("SendMessage", text);
    $("messageInput").value = "";
});

$("messageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("sendBtn").click();
});

$("joinBtn").addEventListener("click", () => {
    const room = $("roomInput").value.trim();
    if (!room) {
        addToFeed("error", "Ошибка: ", "Введите название комнаты");
        return;
    }
    call("JoinRoom", room);
});

$("leaveBtn").addEventListener("click", () => {
    if (!currentRoom) {
        addToFeed("error", "Ошибка: ", "Вы не в комнате");
        return;
    }
    call("LeaveRoom", currentRoom);
});

$("sendRoomBtn").addEventListener("click", async () => {
    const text = $("roomMessageInput").value.trim();
    if (!text) return;
    if (!currentRoom) {
        addToFeed("error", "Ошибка: ", "Сначала войдите в комнату");
        return;
    }
    await call("SendToRoom", currentRoom, text);
    $("roomMessageInput").value = "";
});

$("roomMessageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("sendRoomBtn").click();
});

// Доп. задание (лёгкий уровень): отправка события «печатает» не чаще раза в 500 мс
$("roomMessageInput").addEventListener("input", () => {
    if (!currentRoom || typingTimer) return;

    call("Typing", currentRoom);
    typingTimer = setTimeout(() => {
        typingTimer = null;
    }, 500);
});

$("sendPrivateBtn").addEventListener("click", async () => {
    const target = $("toInput").value.trim();
    const text = $("privateInput").value.trim();
    if (!target || !text) {
        addToFeed("error", "Ошибка: ", "Укажите получателя и текст");
        return;
    }
    await call("SendPrivate", target, text);
    $("privateInput").value = "";
});

$("systemBtn").addEventListener("click", () => {
    post("/api/system-message", { text: "Системное сообщение, отправленное через HTTP POST" });
});

$("externalRoomBtn").addEventListener("click", () => {
    const room = $("roomInput").value.trim() || currentRoom;
    if (!room) {
        addToFeed("error", "Ошибка: ", "Укажите название комнаты");
        return;
    }
    post("/api/room-notification", { room: room, text: "Внешнее уведомление через HTTP POST" });
});

// Доп. задание (сложный уровень): потоковая передача данных
function drawChart() {
    const canvas = $("chart");
    const ctx = canvas.getContext("2d");
    const max = Number($("streamMax").value) || 100;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (streamValues.length < 2) return;

    const stepX = canvas.width / (maxStreamPoints - 1);
    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    streamValues.forEach((value, index) => {
        const x = index * stepX;
        const y = canvas.height - (value / max) * (canvas.height - 10) - 5;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
}

function addStreamValue(value) {
    streamValues.push(value);
    if (streamValues.length > maxStreamPoints) streamValues.shift();
    drawChart();

    const list = $("streamList");
    list.textContent += value + "  ";
    list.scrollTop = list.scrollHeight;
}

function stopStream() {
    if (streamSubscription) {
        streamSubscription.dispose();
        streamSubscription = null;
    }
}

$("streamStartBtn").addEventListener("click", () => {
    if (streamSubscription) return;

    const max = Number($("streamMax").value) || 100;
    streamValues.length = 0;
    $("streamList").textContent = "";
    drawChart();

    streamSubscription = connection.stream("StreamNumbers", max).subscribe({
        next: (value) => addStreamValue(value),
        error: (err) => {
            addToFeed("error", "Ошибка потока: ", String(err));
            streamSubscription = null;
        },
        complete: () => {
            addToFeed("info", "Поток завершён", "");
            streamSubscription = null;
        }
    });
});

$("streamStopBtn").addEventListener("click", () => {
    if (!streamSubscription) return;
    stopStream();
    addToFeed("info", "Поток остановлен", "");
});

async function start() {
    try {
        await connection.start();
        setStatus("Подключено", "ok");
        $("myId").textContent = connection.connectionId;
        renderUsers();
    } catch (err) {
        setStatus("Соединение потеряно", "bad");
        addToFeed("error", "Ошибка подключения: ", err.message);
    }
}

start();
