let playerName = "";
let deck = [];
let playerHand = [];
let botHand = [];

function enterLobby() {
    playerName = document.getElementById("nickname").value;
    if (!playerName) return alert("닉네임 입력");

    document.getElementById("login").style.display = "none";
    document.getElementById("lobby").style.display = "block";
}

function createRoom() {
    startGame();
}

function startGame() {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("game").style.display = "block";

    initDeck();
    playerHand = drawCards(5);
    botHand = drawCards(5);

    render();
}

function initDeck() {
    const suits = ["♠","♥","♦","♣"];
    deck = [];

    for (let s of suits) {
        for (let i = 1; i <= 13; i++) {
            deck.push({suit: s, value: i});
        }
    }

    deck.sort(() => Math.random() - 0.5);
}

function drawCards(n) {
    return deck.splice(0, n);
}

function render() {
    document.getElementById("status").innerText = "카드 교체 가능";

    document.getElementById("player").innerHTML =
        "<h3>" + playerName + "</h3>" +
        playerHand.map(c => `<div class="card">${c.suit}${c.value}</div>`).join("");

    document.getElementById("bot").innerHTML =
        "<h3>AI</h3>" +
        botHand.map(c => `<div class="card">🂠</div>`).join("");
}

function draw() {
    playerHand = drawCards(5);
    botHand = drawCards(5);

    let playerScore = score(playerHand);
    let botScore = score(botHand);

    document.getElementById("bot").innerHTML =
        "<h3>AI</h3>" +
        botHand.map(c => `<div class="card">${c.suit}${c.value}</div>`).join("");

    let result = "패배";
    if (playerScore > botScore) result = "승리";
    if (playerScore === botScore) result = "무승부";

    document.getElementById("status").innerText = result;
}

function score(hand) {
    return hand.reduce((sum, c) => sum + c.value, 0);
}
