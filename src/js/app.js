// CONSTANTES \\

// API para pegar os dados dos ônibus
const URL_API = "https://proxy.corsfix.com/?https://temporeal.pbh.gov.br/?param=D"; //"https://corsproxy.io/?url=https://temporeal.pbh.gov.br/?param=D"
// Zoom inicial do mapa
const ZOOM_INICIAL = 13;
// Tempo entre atualizações dos dados dos ônibus (em milissegundos)
const INTERVAL_UPDATE = 13000; // 13 segundos (retirei 7seg por causa do tempo de resposta)

// VARIÁVEIS \\

// Posição atual do usuário
let posUser = null;
// Mapa do Leaflet
let map = null;
// Array para armazenar os marcadores dos ônibus
let markersOnibus;

// FUNÇÕES \\
async function iniciar() {
    // Verifica se o navegador apresenta GPS e pega as coordenadas oferecidas por ele.
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                // Guarda a posição atual como do usuário.
                posUser = {lat: pos.coords.latitude, lon: pos.coords.longitude}
                // Cria um mapa Leaflet e configura seus tiles de imagem.
                criaMapa();
                // Mensagem de sucesso.
                console.log("SUCESSO: Usuário Localizado.")
            },
            () => console.log("ERRO: Incapaz de localizar o usuário.")
        );
    }

    // Inicia o ciclo de 20 segundos para o fetch da API.
    await atualizarOnibus(); // chama pela primeira vez.
    setInterval(atualizarOnibus, INTERVAL_UPDATE); // inicia o ciclo
    // poderia, também, ter feito algo como:
    // atualizarOnibus().then(() => setInterval(atualizarOnibus, INTERVAL_UPDATE));
}


/**
 * Cria o mapa do Leafjet.
 */
function criaMapa() {
    map = L.map('map').setView(posUser, ZOOM_INICIAL);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Inicializa o grupo de marcadores de ônibus
    markersOnibus = L.layerGroup().addTo(map);
}

/**
 * Cria um marker de um ônibus
 * @param pos posição do ônibus
 */
function criarMarkerDeOnibus(pos) {
    L.marker(pos).addTo(markersOnibus);
}


/**
 * Função para buscar dados e atualizar marcadores
 */
async function atualizarOnibus() {

    fetch(URL_API)
        // .then(response => response.json())
        .then(data => {
            console.log("Dados atualizados:");
            console.log(data.json());
            apagarOnibus();
            desenharOnibus(data);
        });
}

/**
 * Remover marcadores de ônibus do mapa
 */
function apagarOnibus() {
    markersOnibus.clearLayers();
}

/**
 * Desenha os ônibus no mapa com base nos dados fornecidos
 * @param data dados sobre os ônibus
 */
function desenharOnibus(data) {
    // aqui, iteraria nos ônibus e desenharia cada um usando criarMarkerDeOnibus(pos)
}

// Inicia o código
iniciar();