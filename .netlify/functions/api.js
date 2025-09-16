/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Usando ES Modules para importação.
// O 'node-fetch' não é necessário nos runtimes mais recentes do Netlify,
// pois a API fetch é globalmente disponível, similar aos navegadores.

// --- CONFIGURAÇÃO ---
// Chaves de API devem ser armazenadas como variáveis de ambiente no Netlify.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY; // Placeholder

// URL da API do Gemini (usando um modelo atualizado).
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// URL da API de Geração de Imagens (Placeholder).
const IMAGE_API_URL = 'https://api.example.com/v1/images/generations'; // Substitua pela URL real.

// Limite diário de gerações gratuitas para todos os usuários.
const GLOBAL_DAILY_LIMIT = 50;


// --- LÓGICA DE PERSISTÊNCIA (CONTADOR GLOBAL) ---
/*
 * IMPORTANTE: Em um ambiente serverless, as funções são "stateless" (sem estado).
 * Uma variável global ou um arquivo local não funcionará para persistir dados entre
 * diferentes execuções da função.
 *
 * Para implementar um contador diário real, você DEVE usar um serviço externo
 * de banco de dados ou cache, como:
 * - Netlify Blobs (https://docs.netlify.com/blobs/overview/)
 * - Upstash (Redis Serverless)
 * - Firebase Firestore / Realtime Database
 * - Supabase
 *
 * O código abaixo SIMULA a lógica, mas precisa ser substituído pela integração
 * com o serviço de sua escolha.
 */

// Placeholder para obter o estado atual do contador do seu banco de dados.
async function getCounterState() {
  console.log("AVISO: Usando contador em memória. Substitua por um banco de dados persistente.");
  // Exemplo de como seria com um DB:
  // const db = connectToDatabase();
  // const state = await db.get('dailyCounter');
  // return state || { count: 0, lastReset: '1970-01-01' };

  // Simulação para fins de demonstração (não funciona em produção real):
  global.counterState = global.counterState || { count: 0, lastReset: new Date().toISOString().split('T')[0] };
  return global.counterState;
}

// Placeholder para atualizar o estado do contador no seu banco de dados.
async function updateCounterState(newState) {
   console.log("AVISO: Usando contador em memória. Substitua por um banco de dados persistente.");
   // Exemplo de como seria com um DB:
   // const db = connectToDatabase();
   // await db.set('dailyCounter', newState);

   // Simulação:
   global.counterState = newState;
}


// --- FUNÇÕES AUXILIARES DE GERAÇÃO ---

/**
 * Gera o roteiro do vídeo usando a API Gemini.
 * @param {string} idea - A ideia central do vídeo.
 * @param {number} duration - A duração do vídeo em segundos.
 * @returns {Promise<Array<object>>} - Uma promessa que resolve para o array de cenas (script).
 */
async function generateScript(idea, duration) {
  // Prompt cuidadosamente elaborado para instruir o modelo a retornar um JSON válido.
  const prompt = `
    Crie um roteiro detalhado para um vídeo de ${duration} segundos sobre o tema: "${idea}".
    O roteiro deve ser uma lista de cenas.
    Sua resposta DEVE ser APENAS um objeto JSON válido, sem nenhuma formatação extra como markdown (\`\`\`json).
    O objeto JSON deve conter uma única chave chamada "script", que é um array de objetos.
    Cada objeto de cena no array deve ter exatamente as seguintes chaves:
    - "title": (string) Um título curto para a cena.
    - "timing": (string) O tempo da cena no formato "início-fim" em segundos (ex: "0-5s").
    - "description": (string) Uma descrição visual detalhada, otimizada para ser usada como prompt em uma API de geração de imagem.
    - "soundtrackSuggestion": (string) Uma sugestão de trilha sonora ou efeito sonoro.
    - "narrationScript": (string) O texto da narração para esta cena.
  `;

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Configuração para garantir que a resposta seja JSON.
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Erro na API Gemini:", response.status, errorBody);
    throw new Error('Falha ao gerar o roteiro. A API Gemini retornou um erro.');
  }

  const data = await response.json();

  // Extrai e parseia o texto da resposta que contém o JSON do roteiro.
  try {
    const scriptJsonText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(scriptJsonText);
    if (!result.script || !Array.isArray(result.script)) {
        throw new Error("Formato de script inválido recebido da API.");
    }
    return result.script;
  } catch (e) {
    console.error("Erro ao processar a resposta da Gemini:", e);
    console.error("Resposta recebida:", JSON.stringify(data, null, 2));
    throw new Error('A resposta da API de geração de roteiro não estava no formato esperado.');
  }
}

/**
 * Gera imagens para cada cena do roteiro (usando uma API de placeholder).
 * @param {Array<object>} script - O array de cenas gerado.
 * @returns {Promise<Array<string>>} - Uma promessa que resolve para um array de URLs de imagem.
 */
async function generateImages(script) {
  // Usando Promise.all para fazer as chamadas de API em paralelo, melhorando a performance.
  const imagePromises = script.map(scene => {
    // A descrição da cena é usada como prompt para a imagem.
    const prompt = scene.description;

    // Log para depuração. Em produção, você pode querer remover isso.
    console.log(`Gerando imagem para a cena: "${prompt}"`);

    // ** SUBSTITUA ESTA LÓGICA PELA CHAMADA REAL DA SUA API DE IMAGEM **
    return fetch(IMAGE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${IMAGE_API_KEY}`
        },
        body: JSON.stringify({
            prompt: prompt,
            n: 1, // Gerar 1 imagem
            size: "1024x1024" // Exemplo de parâmetro
        })
    })
    .then(res => {
        if (!res.ok) throw new Error(`API de imagem falhou para a cena: ${scene.title}`);
        return res.json();
    })
    .then(data => {
        // A estrutura da resposta dependerá da sua API de imagem.
        // Ex: data.data[0].url para a API da OpenAI.
        return data.imageUrl || 'https://via.placeholder.com/1024x1024.png?text=Imagem+Gerada';
    })
    .catch(error => {
        console.error(error);
        // Retorna uma imagem de placeholder em caso de falha para não quebrar a aplicação.
        return 'https://via.placeholder.com/1024x1024.png?text=Falha+ao+Gerar';
    });
  });

  return Promise.all(imagePromises);
}


// --- HANDLER DA FUNÇÃO NETLIFY ---

export const handler = async (event) => {
  // Permitir requisições de qualquer origem (CORS).
  // Em produção, restrinja para o domínio do seu frontend.
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Requisições OPTIONS são para "preflight" do CORS, devemos respondê-las imediatamente.
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // A função só aceita requisições POST.
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido. Use POST.' }),
    };
  }

  // --- LÓGICA DE NEGÓCIO (FREEMIUM) ---
  try {
    const today = new Date().toISOString().split('T')[0];
    let state = await getCounterState();

    // Reseta o contador se for um novo dia.
    if (state.lastReset !== today) {
      console.log("Novo dia detectado. Resetando o contador global.");
      state = { count: 0, lastReset: today };
    }

    // Verifica se o limite diário global foi atingido.
    if (state.count >= GLOBAL_DAILY_LIMIT) {
      console.warn(`Limite diário global de ${GLOBAL_DAILY_LIMIT} atingido.`);
      return {
        statusCode: 429, // Too Many Requests
        headers,
        body: JSON.stringify({
          error: 'Limite de gerações diárias atingido. Faça upgrade.',
        }),
      };
    }

    // --- EXECUÇÃO DA GERAÇÃO ---

    // Parseia os dados enviados pelo frontend.
    const { idea, duration } = JSON.parse(event.body);
    if (!idea || !duration) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Os campos "idea" e "duration" são obrigatórios.' }),
      };
    }

    // Incrementa o contador ANTES de prosseguir com as chamadas de API.
    state.count++;
    await updateCounterState(state);
    console.log(`Geração ${state.count}/${GLOBAL_DAILY_LIMIT} do dia.`);


    // 1. Gera o roteiro.
    const script = await generateScript(idea, duration);

    // 2. Gera as imagens para cada cena.
    const images = await generateImages(script);

    // 3. Combina tudo e envia a resposta final para o frontend.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ script, images }),
    };

  } catch (error) {
    console.error('Ocorreu um erro inesperado:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Ocorreu um erro interno no servidor.' }),
    };
  }
};
