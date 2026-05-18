// CONSTANTES \\

// indice em que está o codigo e o numero da linha no bhtrans.csv
const INDICE_CODIGO_LINHA = 0
const INDICE_NUMERO_LINHA = 1

//numero das colunas dos dados dos onibus
const N_COLUNA_CODIGO = 1
const N_COLUNA_NOME = 2
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
let markersPontos; // ADICIONE ESTA LINHA
// Mapa para guardar as chaves (codigo da linha retornado pela API) e os valores (linha correta do onibus)
let mapaLinhas = new Map();
let linhasUnicas = new Map();

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

    await carregarLinhasCSV();
    await carregarPontosCSV();
    // Inicia o ciclo de 20 segundos para o fetch da API.
    await atualizarOnibus(); // chama pela primeira vez.
    setInterval(atualizarOnibus, INTERVAL_UPDATE); // inicia o ciclo
    // poderia, também, ter feito algo como:
    // atualizarOnibus().then(() => setInterval(atualizarOnibus, INTERVAL_UPDATE));    
    
}

// Adiciona o evento de mudança no select
document.getElementById("busLineSelect").addEventListener("change", () => {
    // 1. Atualiza os ônibus imediatamente para a nova linha
    atualizarOnibus();
    
    // 2. Filtra e mostra os pontos da linha recém-selecionada
    const linhaSelecionada = document.getElementById("busLineSelect").value;
    const pontosFiltrados = obterPontosDaLinha(linhaSelecionada);
    mostrarPontosProximos(pontosFiltrados);
});

/**
 * Filtra a lista global de pontos para retornar apenas os que pertencem à linha selecionada
 */
function obterPontosDaLinha(codigoLinha) {
    if (!codigoLinha) return [];

    let pontosDaLinha = [];

    // 'linhasUnicas' guarda as informações que vieram do seu CSV
    linhasUnicas.forEach((nomeLinha, codigo) => {
        // Se o código da linha bater com a selecionada, extraímos as coordenadas do seu modelo de dados
        if (codigo === codigoLinha) {
            pontosDaLinha.push({
                codigo: codigo,
                nome: nomeLinha,
                // Substitua 'ponto.lat' e 'ponto.lon' pelas propriedades reais 
                // que você extrair das colunas do seu CSV de pontos
                lat: ponto.latitude_do_csv, 
                lon: ponto.longitude_do_csv  
            });
        }
    });

    return pontosDaLinha;
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
    markersOnibus = L.markerClusterGroup().addTo(map);
    markersPontos = L.layerGroup().addTo(map);
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

    const linhaSelecionada = document.getElementById("busLineSelect").value;

    data.forEach(onibus => {
        if (linhaSelecionada === "" || linhaSelecionada === mapaLinhas.get(onibus.LN)) {
            criarMarkerDeOnibus([onibus.LT, onibus.LG])
        }
    });
    markersOnibus.addTo(map);

    // [NOVA LINHA]: Atualiza também os pontos fixos junto com a atualização dos ônibus
    const pontosFiltrados = obterPontosDaLinha(linhaSelecionada);
    mostrarPontosProximos(pontosFiltrados);
}


/**
 * Função que inicializa o mapa "mapaLinhas" onde a chave é o codigo da linha que a API retorna e o valor o numero da linha
 */
async function carregarLinhasCSV() {
    const response = await fetch("/src/data/bhtrans_bdlinha.csv");
    const texto = await response.text();
    const linhas = texto.split(/\r?\n/);
    linhas.shift();

    linhas.forEach(linha => {
        if (!linha.trim()) return;

        const colunas = linha.split(";")

        const codigoLinha = colunas[INDICE_CODIGO_LINHA].trim()
        const numeroLinha = colunas[INDICE_NUMERO_LINHA].trim()

        mapaLinhas.set(codigoLinha, numeroLinha);
    })
}

async function carregarPontosCSV() {
    
    //carrego o arquivo csv
    const response = await fetch("/src/data/20260401_ponto_onibus.csv")

    //transformo o conteudo em texto
    const texto = await response.text()

    //transformo o texto em um array
    const linhas = texto.split(/\r?\n/)

    //removo o cabeçalho
    linhas.shift()

    linhas.forEach(linha => {

        //retorno se a linha estiver vazia
        if(!linha.trim()) return

        //divido a linha em colunas
        const colunas = linha.split(";")

        //se faltar colunas, ignoro essa linha
        if(colunas.length < N_DE_COLUNAS_SUFICIENTE) return

        //removo as aspas e os espacos vazios do codigo e do nome da linha
        const codigoLinha = colunas[N_COLUNA_CODIGO]
            .replaceAll('"','')
            .trim()
        const nomeLinha = colunas[N_COLUNA_NOME]
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

/**
 * Encontra e desenha os pontos da linha selecionada, destacando o mais próximo do usuário
 * @param {Array} pontosDaLinha Array de objetos contendo os pontos da linha [{lat: -19.9, lon: -43.9, codigo: '123'}]
 */
function mostrarPontosProximos(pontosDaLinha) {
    // 1. Limpa os pontos anteriores do mapa
    if (markersPontos) {
        markersPontos.clearLayers();
    }

    // Se não houver pontos ou o usuário não estiver localizado, cancela
    if (!pontosDaLinha || pontosDaLinha.length === 0 || !posUser) return;

    let pontoMaisProximo = null;
    let menorDistancia = Infinity;
    
    // Instancia a posição atual do usuário no formato Leaflet
    const posUsuarioLeaflet = L.latLng(posUser.lat, posUser.lon);

    // 2. Primeira passada: Calcular distâncias e descobrir o mais próximo
    pontosDaLinha.forEach(ponto => {
        const posPonto = L.latLng(ponto.lat, ponto.lon); // Certifique-se que seu CSV extrai lat e lon
        const distancia = posUsuarioLeaflet.distanceTo(posPonto);

        ponto.distancia = distancia; // Salva a distância no objeto do ponto

        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            pontoMaisProximo = ponto;
        }
    });

    // 3. Segunda passada: Desenhar todos os pontos no mapa com a diferenciação cromática
    pontosDaLinha.forEach(ponto => {
        const ehOMaisProximo = (ponto.codigo === pontoMaisProximo.codigo);
        const cor = ehOMaisProximo ? "#27ae60" : "#2980b9"; // Verde para o mais perto, Azul para os outros
        const raio = ehOMaisProximo ? 8 : 5;

        L.circleMarker([ponto.lat, ponto.lon], {
            radius: raio,
            fillColor: cor,
            color: "#ffffff",
            weight: 2,
            fillOpacity: 1
        })
        .bindPopup(
            ehOMaisProximo 
            ? `<b>Ponto mais próximo de você!</b><br>Distância: ${Math.round(ponto.distancia)} metros.`
            : `Ponto Código: ${ponto.codigo}`
        )
        .addTo(markersPontos);
    });
}

// Inicia o código
iniciar();
