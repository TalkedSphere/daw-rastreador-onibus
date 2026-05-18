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
// Modal que avisa o usuário que está atualizando
const MODAL_ATUALIZANDO = document.getElementById("modal-carregamento");

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
// Mapeia código da linha para array de pontos
let pontosPorLinha = new Map();

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

    // Retorna os pontos armazenados para essa linha (ou nada se não houver)
    return pontosPorLinha.get(codigoLinha) || [];
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

// Se estiver atualizando as informações do ônibus, essa variável fica verdadeira
let atualizandoOnibus = false;

/**
 * Função para buscar dados e atualizar marcadores
 */
async function atualizarOnibus() {
    // Se já estiver atualizando, retorna
    if (atualizandoOnibus) return;

    atualizandoOnibus = true;

    MODAL_ATUALIZANDO.style.display = 'flex';
    fetch(URL_API)
        .then(response => response.json())
        .then(data => {
            desenharOnibus(data);
        }).finally(() => {
            // Quando termina de atualizar, libera
            atualizandoOnibus = false;
            MODAL_ATUALIZANDO.style.display = 'none';
    });
}

// Definir a projeção UTM 23S (Belo Horizonte está na zona 23 Sul)
proj4.defs('EPSG:31983', '+proj=utm +zone=23 +south +datum=SAD69 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

/**
 * Recebe as posições em UTM e transforma em latitude/longitude.
 * @returns {{lon: number, lat: number}}
 */
function converterUTMparaLatLon(x, y) {
    const origem = proj4('EPSG:31983'); // UTM 23S
    const destino = proj4('EPSG:4326'); // WGS84 (lat/lon)
    const resultado = proj4(origem, destino, [parseFloat(x), parseFloat(y)]);
    return {
        lon: resultado[0],
        lat: resultado[1]
    };
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

    const linhaSelecionada = document.getElementById("busLineSelect").value

    requestAnimationFrame(() => {
        apagarOnibus();
        // Filtra os ônibus que vão ser renderizados
        const onibusFiltrados = data.filter(onibus => {
            const numeroLinha = mapaLinhas.get(onibus.NL);
            if (!numeroLinha) return false;

            return linhaSelecionada === "" || linhaSelecionada === numeroLinha.slice(0, -3)
        });

        // Renderiza em lotes
        const TAMANHO_LOTE = 200;

        function renderizarLote(indice) {
            if (indice >= onibusFiltrados.length) {
                // Acabou, atualiza o mapa e os pontos
                markersOnibus.addTo(map);
                const pontosFiltrados = obterPontosDaLinha(linhaSelecionada);
                mostrarPontosProximos(pontosFiltrados);
                return;
            }

            const fim = Math.min(indice + TAMANHO_LOTE, onibusFiltrados.length);

            // Renderiza um lote
            for (let i = indice; i < fim; i++) {
                criarMarkerDeOnibus([onibusFiltrados[i].LT, onibusFiltrados[i].LG]);
            }

            // Agenda o próximo lote para o próximo frame
            requestAnimationFrame(() => {
                renderizarLote(fim);
            });
        }

        renderizarLote(0);
    });

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

        // Extrai latitude e longitude
        const geometria = colunas[6].trim()
        // Obtém os valores a partir do formato
        const match = geometria.match(/POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/)
        if (match) {
            const coordenadas = converterUTMparaLatLon(match[1], match[2])
            const longitude = coordenadas.lon
            const latitude = coordenadas.lat

            // Se a linha não existe em pontosPorLinha, cria um array
            if (!pontosPorLinha.has(codigoLinha)) {
                pontosPorLinha.set(codigoLinha, [])
            }

            // Adiciona o ponto ao array da linha
            pontosPorLinha.get(codigoLinha).push({
                codigo: colunas[5].replaceAll('"','').trim(),
                nome: colunas[4].replaceAll('"','').trim(),
                lat: latitude,
                lon: longitude
            })
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
    // Limpa os pontos anteriores do mapa
    if (markersPontos) {
        markersPontos.clearLayers();
    }

    // Se não houver pontos ou o usuário não estiver localizado, cancela
    if (!pontosDaLinha || pontosDaLinha.length === 0 || !posUser) return;

    requestAnimationFrame(() => {
        let pontoMaisProximo = null;
        let menorDistancia = Infinity;

        // Instancia a posição atual do usuário no formato Leaflet
        const posUsuarioLeaflet = L.latLng(posUser.lat, posUser.lon);

        // Primeira passada: Calcular distâncias e descobrir o mais próximo
        pontosDaLinha.forEach(ponto => {
            const posPonto = L.latLng(ponto.lat, ponto.lon);
            const distancia = posUsuarioLeaflet.distanceTo(posPonto);

            ponto.distancia = distancia; // Salva a distância no objeto do ponto

            if (distancia < menorDistancia) {
                menorDistancia = distancia;
                pontoMaisProximo = ponto;
            }
        });

        let SabrinaCarpenterPoint = [];
        // Segunda passada: Desenhar todos os pontos no mapa com a diferenciação na cor
        pontosDaLinha.forEach(ponto => {
            const ehOMaisProximo = (ponto.codigo === pontoMaisProximo.codigo);
            const cor = ehOMaisProximo ? "#27ae60" : "#2980b9"; // Verde para o mais perto, Azul para os outros
            const raio = ehOMaisProximo ? 10 : 5;
            const posz = ehOMaisProximo && cor == "#27ae60" ? 10 : -10;

            const marcador = L.circleMarker([ponto.lat, ponto.lon], {
                radius: raio,
                fillColor: cor,
                color: "#ffffff",
                weight: 2,
                fillOpacity: 1,
                zIndexOffset: posz 
            })
                .bindPopup(
                    ehOMaisProximo
                        ? `<b>Ponto mais próximo de você!</b><br>Distância: ${Math.round(ponto.distancia)} metros.`
                        : `Ponto Código: ${ponto.codigo}`
                )

            if(ehOMaisProximo) SabrinaCarpenterPoint = [ponto.lat, ponto.lon];
            else marcador.addTo(markersPontos);
        });
        
        var myCustomIcon = L.icon({
            iconUrl: '/src/data/SabrinaCarpenterPoint.png',
            iconSize: [30, 30], 
        });
        
        L.marker(SabrinaCarpenterPoint, {icon: myCustomIcon}).addTo(markersPontos);
    })
}

// Inicia o código
iniciar();
