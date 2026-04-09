import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
  remove,
  onDisconnect,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const lobbyScreen = document.getElementById("lobbyScreen");
const waitingScreen = document.getElementById("waitingScreen");
const gameScreen = document.getElementById("gameScreen");
const nicknameInput = document.getElementById("nicknameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const waitingRoomCode = document.getElementById("waitingRoomCode");
const waitingPlayers = document.getElementById("waitingPlayers");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const phaseLabel = document.getElementById("phaseLabel");
const messageLabel = document.getElementById("messageLabel");
const opponentInfo = document.getElementById("opponentInfo");
const myInfo = document.getElementById("myInfo");
const opponentCards = document.getElementById("opponentCards");
const myCards = document.getElementById("myCards");
const drawBtn = document.getElementById("drawBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const logBox = document.getElementById("logBox");
const selectionHelp = document.getElementById("selectionHelp");
const leaveBtn = document.getElementById("leaveBtn");

const SUITS = ["S", "H", "D", "C"];
const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

let currentRoomCode = null;
let currentPlayerId = null;
let roomRef = null;
let roomListener = null;
let selectedIndexes = new Set();
let latestRoomData = null;

const qs = new URLSearchParams(location.search);
if (qs.get("room")) roomCodeInput.value = qs.get("room");
if (localStorage.getItem("poker_nickname")) nicknameInput.value = localStorage.getItem("poker_nickname");

function showScreen(name) {
  lobbyScreen.classList.add("hidden");
  waitingScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
  if (name === "lobby") lobbyScreen.classList.remove("hidden");
  if (name === "waiting") waitingScreen.classList.remove("hidden");
  if (name === "game") gameScreen.classList.remove("hidden");
}

function normalizeRoomCode(raw) {
  return (raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}-${suit}`);
    }
  }
  return shuffle(deck);
}

function dealHand(deck, count = 5) {
  const hand = deck.splice(0, count);
  return hand;
}

function cardToParts(card) {
  const [rank, suit] = card.split("-");
  return { rank, suit, value: RANK_VALUE[rank], symbol: SUIT_SYMBOLS[suit] };
}

function sortValuesDesc(values) {
  return [...values].sort((a, b) => b - a);
}

function evaluateHand(cards) {
  const parts = cards.map(cardToParts);
  const values = sortValuesDesc(parts.map((p) => p.value));
  const suits = parts.map((p) => p.suit);
  const counts = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const isFlush = suits.every((s) => s === suits[0]);
  const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
  let isStraight = false;
  let straightHigh = Math.max(...values);

  if (uniqueValues.length === 5) {
    const regular = uniqueValues[4] - uniqueValues[0] === 4;
    const wheel = JSON.stringify(uniqueValues) === JSON.stringify([2, 3, 4, 5, 14]);
    if (regular || wheel) {
      isStraight = true;
      straightHigh = wheel ? 5 : uniqueValues[4];
    }
  }

  let rank = 0;
  let name = "하이카드";
  let tiebreak = values;

  if (isStraight && isFlush && straightHigh === 14) {
    rank = 9; name = "로열 플러시"; tiebreak = [14];
  } else if (isStraight && isFlush) {
    rank = 8; name = "스트레이트 플러시"; tiebreak = [straightHigh];
  } else if (groups[0].count === 4) {
    rank = 7; name = "포카드"; tiebreak = [groups[0].value, groups[1].value];
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    rank = 6; name = "풀하우스"; tiebreak = [groups[0].value, groups[1].value];
  } else if (isFlush) {
    rank = 5; name = "플러시"; tiebreak = values;
  } else if (isStraight) {
    rank = 4; name = "스트레이트"; tiebreak = [straightHigh];
  } else if (groups[0].count === 3) {
    rank = 3; name = "트리플";
    tiebreak = [groups[0].value, ...groups.slice(1).map((g) => g.value).sort((a, b) => b - a)];
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    rank = 2; name = "투페어";
    const pairValues = groups.filter((g) => g.count === 2).map((g) => g.value).sort((a, b) => b - a);
    const kicker = groups.find((g) => g.count === 1).value;
    tiebreak = [...pairValues, kicker];
  } else if (groups[0].count === 2) {
    rank = 1; name = "원페어";
    tiebreak = [groups[0].value, ...groups.slice(1).map((g) => g.value).sort((a, b) => b - a)];
  }

  return { rank, name, tiebreak };
}

function compareHands(cardsA, cardsB) {
  const a = evaluateHand(cardsA);
  const b = evaluateHand(cardsB);
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i += 1) {
    const av = a.tiebreak[i] || 0;
    const bv = b.tiebreak[i] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

function renderCard(card, hidden = false, selectable = false, index = -1) {
  const el = document.createElement("div");
  if (hidden) {
    el.className = "card back";
    el.textContent = "🂠";
    return el;
  }
  const { rank, suit, symbol } = cardToParts(card);
  el.className = `card ${suit === "H" || suit === "D" ? "red" : ""}`.trim();
  if (selectable) {
    el.classList.add("selectable");
    if (selectedIndexes.has(index)) el.classList.add("selected");
    el.addEventListener("click", () => toggleCardSelection(index));
  }
  el.innerHTML = `
    <div class="card-corner">${rank}${symbol}</div>
    <div class="card-rank">${rank}</div>
    <div class="card-suit">${symbol}</div>
  `;
  return el;
}

function appendLog(lines = []) {
  logBox.innerHTML = "";
  lines.slice().reverse().forEach((line) => {
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = line;
    logBox.appendChild(div);
  });
}

function phaseText(phase) {
  return {
    waiting: "대기",
    draw: "카드 교체",
    showdown: "쇼다운",
    finished: "라운드 종료"
  }[phase] || phase;
}

function toggleCardSelection(index) {
  if (!latestRoomData) return;
  const me = latestRoomData.players?.[currentPlayerId];
  if (!me || latestRoomData.phase !== "draw" || me.hasDrawn) return;
  if (selectedIndexes.has(index)) {
    selectedIndexes.delete(index);
  } else {
    if (selectedIndexes.size >= 3) return;
    selectedIndexes.add(index);
  }
  renderRoom(latestRoomData);
}

async function createGameState(playerIds, players) {
  const deck = createDeck();
  const handA = dealHand(deck, 5);
  const handB = dealHand(deck, 5);
  const [p1, p2] = playerIds;
  players[p1].cards = handA;
  players[p2].cards = handB;
  players[p1].hasDrawn = false;
  players[p2].hasDrawn = false;
  players[p1].ready = true;
  players[p2].ready = true;
  players[p1].lastHandName = "";
  players[p2].lastHandName = "";

  return {
    phase: "draw",
    deck,
    players,
    winnerId: null,
    resultText: "",
    createdAt: Date.now(),
    log: [`게임 시작: ${players[p1].name} vs ${players[p2].name}`],
    round: (latestRoomData?.round || 0) + 1
  };
}

async function ensureGameStarts(roomCode) {
  const gameRef = ref(db, `rooms/${roomCode}`);
  await runTransaction(gameRef, (room) => {
    if (!room) return room;
    if (!room.players) return room;
    const playerIds = Object.keys(room.players).filter((id) => room.players[id]?.connected);
    if (playerIds.length !== 2) {
      room.phase = "waiting";
      return room;
    }
    if (room.phase && room.phase !== "waiting") return room;
    const deck = createDeck();
    const [a, b] = playerIds;
    room.players[a].cards = dealHand(deck, 5);
    room.players[b].cards = dealHand(deck, 5);
    room.players[a].hasDrawn = false;
    room.players[b].hasDrawn = false;
    room.players[a].ready = true;
    room.players[b].ready = true;
    room.players[a].lastHandName = "";
    room.players[b].lastHandName = "";
    room.phase = "draw";
    room.deck = deck;
    room.winnerId = null;
    room.resultText = "";
    room.round = (room.round || 0) + 1;
    room.log = [`라운드 ${room.round} 시작: ${room.players[a].name} vs ${room.players[b].name}`];
    room.updatedAt = Date.now();
    return room;
  });
}

async function createOrJoinRoom(mode) {
  const nickname = nicknameInput.value.trim();
  let roomCode = normalizeRoomCode(roomCodeInput.value);
  if (!nickname) {
    alert("닉네임을 입력하세요.");
    return;
  }
  if (!roomCode && mode === "join") {
    alert("참가할 방 코드를 입력하세요.");
    return;
  }
  if (!roomCode && mode === "create") roomCode = randomRoomCode();

  localStorage.setItem("poker_nickname", nickname);
  currentPlayerId = crypto.randomUUID();
  currentRoomCode = roomCode;
  roomRef = ref(db, `rooms/${roomCode}`);

  const snapshot = await get(roomRef);
  const room = snapshot.val();
  const currentPlayers = room?.players ? Object.values(room.players).filter((p) => p.connected) : [];

  if (mode === "create" && room && currentPlayers.length > 0) {
    alert("이미 존재하는 방입니다. 다른 코드를 사용하세요.");
    return;
  }
  if (mode === "join" && !room) {
    alert("해당 방이 존재하지 않습니다.");
    return;
  }
  if (currentPlayers.length >= 2) {
    alert("이 방은 이미 가득 찼습니다.");
    return;
  }

  const updates = {};
  if (!room) {
    updates[`rooms/${roomCode}`] = {
      roomCode,
      phase: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      round: 0,
      log: ["방이 생성되었습니다."],
      players: {}
    };
    await update(ref(db), updates);
  }

  await update(roomRef, {
    [`players/${currentPlayerId}`]: {
      id: currentPlayerId,
      name: nickname,
      connected: true,
      joinedAt: Date.now(),
      hasDrawn: false,
      ready: false,
      cards: [],
      lastHandName: ""
    },
    updatedAt: Date.now()
  });

  onDisconnect(ref(db, `rooms/${roomCode}/players/${currentPlayerId}/connected`)).set(false);
  onDisconnect(ref(db, `rooms/${roomCode}/updatedAt`)).set(serverTimestamp());

  history.replaceState({}, "", `${location.pathname}?room=${roomCode}`);
  waitingRoomCode.textContent = roomCode;
  roomCodeLabel.textContent = roomCode;
  leaveBtn.classList.remove("hidden");
  attachRoomListener();
  await ensureGameStarts(roomCode);
}

function getConnectedPlayers(room) {
  return Object.values(room.players || {}).filter((p) => p.connected);
}

function renderWaiting(room) {
  waitingRoomCode.textContent = room.roomCode;
  const players = getConnectedPlayers(room);
  waitingPlayers.innerHTML = "";
  players.forEach((player) => {
    const div = document.createElement("div");
    div.className = "player-chip";
    div.textContent = player.name;
    waitingPlayers.appendChild(div);
  });
}

function renderRoom(room) {
  latestRoomData = room;
  const me = room.players?.[currentPlayerId];
  if (!me) {
    alert("방에서 제거되었습니다.");
    leaveRoom(false);
    return;
  }

  const players = getConnectedPlayers(room);
  const opponent = players.find((p) => p.id !== currentPlayerId);

  if (players.length < 2 || room.phase === "waiting") {
    showScreen("waiting");
    renderWaiting(room);
    return;
  }

  showScreen("game");
  phaseLabel.textContent = phaseText(room.phase);
  roomCodeLabel.textContent = room.roomCode;
  appendLog(room.log || []);

  myInfo.innerHTML = `<strong>${me.name}</strong>${room.winnerId === currentPlayerId ? '<span class="badge">승리</span>' : ''}<div>교체 완료: ${me.hasDrawn ? '예' : '아니오'}</div>${me.lastHandName ? `<div>족보: ${me.lastHandName}</div>` : ''}`;
  opponentInfo.innerHTML = opponent
    ? `<strong>${opponent.name}</strong>${room.winnerId === opponent.id ? '<span class="badge">승리</span>' : ''}<div>교체 완료: ${opponent.hasDrawn ? '예' : '아니오'}</div>${opponent.lastHandName ? `<div>족보: ${opponent.lastHandName}</div>` : ''}`
    : "상대 없음";

  messageLabel.textContent = room.resultText || (
    room.phase === "draw"
      ? (me.hasDrawn ? "상대의 카드 교체를 기다리는 중" : "교체할 카드를 선택하세요")
      : room.phase === "showdown"
        ? "족보를 공개했습니다"
        : "다음 라운드를 시작할 수 있습니다"
  );

  myCards.innerHTML = "";
  (me.cards || []).forEach((card, index) => {
    const selectable = room.phase === "draw" && !me.hasDrawn;
    myCards.appendChild(renderCard(card, false, selectable, index));
  });

  opponentCards.innerHTML = "";
  if (opponent?.cards?.length) {
    const reveal = room.phase === "showdown" || room.phase === "finished";
    opponent.cards.forEach((card) => opponentCards.appendChild(renderCard(card, !reveal, false)));
  }

  drawBtn.classList.toggle("hidden", !(room.phase === "draw" && !me.hasDrawn));
  selectionHelp.classList.toggle("hidden", !(room.phase === "draw" && !me.hasDrawn));
  nextRoundBtn.classList.toggle("hidden", room.phase !== "finished");
}

function attachRoomListener() {
  if (roomListener && roomRef) off(roomRef, "value", roomListener);
  roomListener = onValue(roomRef, async (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      alert("방이 종료되었습니다.");
      leaveRoom(false);
      return;
    }
    renderRoom(room);
    const connected = getConnectedPlayers(room);
    if (connected.length === 2 && room.phase === "waiting") {
      await ensureGameStarts(currentRoomCode);
    }
  });
}

async function drawSelectedCards() {
  const room = latestRoomData;
  const me = room?.players?.[currentPlayerId];
  if (!room || !me || room.phase !== "draw" || me.hasDrawn) return;

  await runTransaction(roomRef, (data) => {
    if (!data || data.phase !== "draw") return data;
    const player = data.players?.[currentPlayerId];
    if (!player || player.hasDrawn) return data;

    const indexes = [...selectedIndexes].sort((a, b) => a - b);
    const newCards = [...player.cards];
    for (const index of indexes) {
      const replacement = data.deck.shift();
      if (replacement) newCards[index] = replacement;
    }
    player.cards = newCards;
    player.hasDrawn = true;
    data.players[currentPlayerId] = player;
    data.log = data.log || [];
    data.log.push(`${player.name} 님이 카드 ${indexes.length}장을 교체했습니다.`);

    const everyoneDone = Object.values(data.players).filter((p) => p.connected).every((p) => p.hasDrawn);
    if (everyoneDone) {
      const ids = Object.keys(data.players).filter((id) => data.players[id].connected);
      const [a, b] = ids;
      const result = compareHands(data.players[a].cards, data.players[b].cards);
      const evalA = evaluateHand(data.players[a].cards);
      const evalB = evaluateHand(data.players[b].cards);
      data.players[a].lastHandName = evalA.name;
      data.players[b].lastHandName = evalB.name;
      data.phase = "showdown";
      if (result > 0) {
        data.winnerId = a;
        data.resultText = `${data.players[a].name} 승리 (${evalA.name} vs ${evalB.name})`;
      } else if (result < 0) {
        data.winnerId = b;
        data.resultText = `${data.players[b].name} 승리 (${evalB.name} vs ${evalA.name})`;
      } else {
        data.winnerId = "draw";
        data.resultText = `무승부 (${evalA.name})`;
      }
      data.log.push(`쇼다운 결과: ${data.resultText}`);
      data.phase = "finished";
    }

    data.updatedAt = Date.now();
    return data;
  });

  selectedIndexes.clear();
}

async function nextRound() {
  const room = latestRoomData;
  if (!room || room.phase !== "finished") return;
  await runTransaction(roomRef, (data) => {
    if (!data || data.phase !== "finished") return data;
    const connectedIds = Object.keys(data.players || {}).filter((id) => data.players[id].connected);
    if (connectedIds.length !== 2) {
      data.phase = "waiting";
      data.resultText = "상대 접속을 기다리는 중";
      return data;
    }

    const deck = createDeck();
    connectedIds.forEach((id) => {
      data.players[id].cards = dealHand(deck, 5);
      data.players[id].hasDrawn = false;
      data.players[id].lastHandName = "";
    });
    data.deck = deck;
    data.phase = "draw";
    data.winnerId = null;
    data.resultText = "새 라운드 시작";
    data.round = (data.round || 0) + 1;
    data.log = data.log || [];
    data.log.push(`라운드 ${data.round} 시작`);
    data.updatedAt = Date.now();
    return data;
  });
  selectedIndexes.clear();
}

async function leaveRoom(removePlayer = true) {
  selectedIndexes.clear();
  if (roomRef && roomListener) off(roomRef, "value", roomListener);
  if (removePlayer && currentRoomCode && currentPlayerId) {
    try {
      await remove(ref(db, `rooms/${currentRoomCode}/players/${currentPlayerId}`));
      const snap = await get(ref(db, `rooms/${currentRoomCode}/players`));
      const remaining = snap.val() ? Object.keys(snap.val()) : [];
      if (remaining.length === 0) {
        await remove(ref(db, `rooms/${currentRoomCode}`));
      } else {
        await update(ref(db, `rooms/${currentRoomCode}`), {
          phase: "waiting",
          resultText: "상대가 나갔습니다.",
          updatedAt: Date.now(),
          log: (latestRoomData?.log || []).concat(["플레이어가 방을 떠났습니다."])
        });
      }
    } catch (error) {
      console.error(error);
    }
  }
  currentRoomCode = null;
  currentPlayerId = null;
  roomRef = null;
  roomListener = null;
  latestRoomData = null;
  leaveBtn.classList.add("hidden");
  history.replaceState({}, "", location.pathname);
  showScreen("lobby");
}

createRoomBtn.addEventListener("click", () => createOrJoinRoom("create"));
joinRoomBtn.addEventListener("click", () => createOrJoinRoom("join"));
drawBtn.addEventListener("click", drawSelectedCards);
nextRoundBtn.addEventListener("click", nextRound);
leaveBtn.addEventListener("click", () => leaveRoom(true));
window.addEventListener("beforeunload", () => {
  if (currentRoomCode && currentPlayerId) {
    navigator.sendBeacon?.("", "");
  }
});
showScreen("lobby");
