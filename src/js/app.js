// CONSTANTES \\

//numero de colunas necessario para aparecer no select
const N_DE_COLUNAS_SUFICIENTE = 3
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

    await carregarLinhasCSV()
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
        // maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Inicializa o grupo de marcadores de ônibus
    markersOnibus = L.markerClusterGroup();
}

/**
 * Cria um marker de um ônibus
 * @param pos posição do ônibus
 */
function criarMarkerDeOnibus(pos) {
    markersOnibus.addLayer(L.circleMarker(pos))
}


/**
 * Função para buscar dados e atualizar marcadores
 */
async function atualizarOnibus() {

    fetch(URL_API)
        .then(response => response.json())
        .then(data => {
            console.log("Dados atualizados:");
            console.log(data);
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
    apagarOnibus()
    data.forEach(onibus => {
        criarMarkerDeOnibus([onibus.LT, onibus.LG])
    });
    markersOnibus.addTo(map);
    // aqui, iteraria nos ônibus e desenharia cada um usando criarMarkerDeOnibus(pos)
}

async function carregarLinhasCSV() {
    
    //carrego o arquivo csv
    const response = await fetch("/src/data/20260401_ponto_onibus.csv")

    //transformo o conteudo em texto
    const texto = await response.text()

    //transformo o texto em um array
    const linhas = texto.split(/\r?\n/)

    //removo o cabeçalho
    linhas.shift()

    //crio um mapa para evitar linhas duplicadas
    const linhasUnicas = new Map()

    linhas.forEach(linha => {

        //retorno se a linha estiver vazia
        if(!linha.trim()) return

        //divido a linha em colunas
        const colunas = linha.split(";")

        //se faltar colunas, ignoro essa linha
        if(colunas.length < N_DE_COLUNAS_SUFICIENTE) return

        //removo as aspas e os espacos vazios do codigo e do nome da linha
        const codigoLinha = colunas[1]
            .replaceAll('"','')
            .trim()
        const nomeLinha = colunas[2]
            .replaceAll('"','')
            .trim()

        //se essa linha ja existir no mapa, atualizo ela
        if(!linhasUnicas.has(codigoLinha)) {
            linhasUnicas.set(codigoLinha, nomeLinha)
        }
    })

    //adiciono a linha no select
    preencherSelect(linhasUnicas)
}

function preencherSelect(linhas) {

    //busco o select pelo id
    const select = document.getElementById("busLineSelect")

    //passo por todas as linhas
    linhas.forEach((nomeLinha,codigoLinha) => {

        //crio um option pelo js
        const option = document.createElement("option")

        //defino o valor da opcao
        option.value = codigoLinha

        //defino o texto visivel
        option.textContent = `${codigoLinha} | ${nomeLinha}`

        //coloco o elemento dentro do select
        select.appendChild(option)
    })
}

// Inicia o código
iniciar();