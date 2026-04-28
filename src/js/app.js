// CONSTANTES \\
const urlAPI = "https://corsproxy.io/?url=https://temporeal.pbh.gov.br/?param=D"
let posUser = null;
let map = null;
const zoomInicial = 13;

// FUNÇÕES \\
function iniciar() {
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
    setInterval(atualizarOnibus, 20000);
}


function criaMapa() {
    map = L.map('map').setView(posUser, zoomInicial);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
}


// Função para buscar dados e atualizar marcadores
async function atualizarOnibus() {
    fetch(urlAPI)
        .then(response => response.json())
        .then(_data => {
            // Lógica para limpar marcadores antigos e adicionar novos
            console.log("Dados atualizados!");
        });
}

// Inicia o código
iniciar();