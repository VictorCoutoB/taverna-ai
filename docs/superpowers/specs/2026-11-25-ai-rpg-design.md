# Design — App de RPG em texto com IA (nome provisório: "Taverna AI")

Data: 2026-11-25
Status: aguardando revisão

## 1. Objetivo

Um app Android para o público geral, no estilo do FableAI: uma aventura em texto em que a IA narra e o jogador escreve livremente o que faz. Inclui imagens das cenas, retratos consistentes dos personagens e narração por voz. Cada pessoa escolhe os modelos de IA e usa a própria chave de API.

## 2. Decisões principais

| Tema | Decisão |
|---|---|
| Público | Público geral, com publicação na Play Store |
| Quem paga a IA | Cada pessoa usa a própria chave (BYOK). Sem servidor, sem login, sem pagamentos |
| Plataforma | Android primeiro. React Native + Expo + TypeScript. Código preparado para iOS depois |
| Provedores | Três caminhos: OpenRouter, APIs diretas e modelos locais (Ollama / Stable Diffusion no PC da pessoa, acessados pela rede) |
| Modos de jogo | **RPG** (com dados, atributos, vida e inventário) e **Roleplay** (narrativa livre, sem números) |
| Voz | Voz do celular (padrão, grátis) + vozes de IA opcionais (OpenAI, ElevenLabs) |
| Idiomas | Português e inglês |
| Conteúdo adulto | Bloqueado na v1 |

## 3. Arquitetura

Tudo roda no aparelho. Os módulos são independentes e se comunicam por interfaces bem definidas.

```
UI (telas)
 ├── Narrador ──────────► Provedor de Texto (interface)
 │     └── Motor de Jogo (só no modo RPG)
 ├── Imagens/Retratos ──► Provedor de Imagem (interface)
 ├── Voz ───────────────► Provedor de Voz (interface)
 ├── Segurança de conteúdo
 └── Armazenamento (SQLite + arquivos + SecureStore)
```

### 3.1 Provedores de IA
Existem três interfaces: `TextProvider`, `ImageProvider` e `SpeechProvider`. Cada serviço é um adaptador.

- **Texto:** OpenRouter, Anthropic (Claude), OpenAI, Google Gemini, Ollama (local).
  - Métodos: `listModels()`, `chat(messages, options)` com streaming, `testKey()`.
- **Imagem:** OpenRouter, OpenAI, Stability AI, Stable Diffusion local (API do Automatic1111/ComfyUI).
  - Métodos: `generate(prompt, {style, referenceImage?, size})`, `supportsReference`, `testKey()`.
- **Voz:** voz do aparelho (`expo-speech`), OpenAI TTS, ElevenLabs.
  - Métodos: `listVoices()`, `speak(text, voice)`, `stop()`.

Para adicionar um serviço novo basta criar um adaptador, sem alterar o resto do app.

### 3.2 Motor de Jogo (só no modo RPG)
É código determinístico e é ele quem manda nos números.

- **Ficha:** vida (atual/máx.), 6 atributos (Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma), nível/XP, inventário e ouro.
- **Testes:** d20 + modificador do atributo contra uma dificuldade (CD). Também há sucesso e falha crítica (20 e 1 naturais).
- **Comandos aceitos da IA:** `teste(atributo, cd)`, `dano(n)`, `curar(n)`, `darItem(nome, qtd)`, `removerItem(nome, qtd)`, `ouro(±n)`, `xp(n)`.
- **Validação:** limites de valor (dano e cura por turno, vida entre 0 e o máximo), remover apenas itens que o jogador tem e ignorar comandos desconhecidos. Comandos inválidos são descartados e registrados no log, sem quebrar o turno.
- **Morte:** com vida 0 aparece a tela de "fim de jogo", com as opções voltar um turno ou recomeçar.

### 3.3 Narrador
Monta o pedido para o modelo de texto:

1. Instruções de sistema (regras do modo, idioma, limites de conteúdo e formato da resposta).
2. Cenário e descrição dos personagens.
3. Estado atual da ficha (modo RPG).
4. **Memória de longo prazo:** resumo da história, atualizado automaticamente quando o histórico passa de um limite de tokens.
5. As últimas N mensagens.

**Formato da resposta no modo RPG:** texto da narração + um bloco JSON com os comandos para o motor. Se o JSON vier inválido, o app aproveita a narração e ignora os comandos.

**Fluxo com teste:** se a IA pede um `teste`, o motor rola o dado, mostra uma animação e faz uma segunda chamada para a IA narrar o resultado.

### 3.4 Imagens e retratos
- Cada personagem tem uma **descrição visual fixa** e um **retrato de referência**, gerado na criação.
- A imagem da cena é montada com o estilo escolhido, o resumo da cena e as descrições fixas dos personagens presentes. Se o provedor aceitar referência, o retrato também é enviado.
- **Quando gerar:** sempre, a cada X turnos ou apenas pelo botão (padrão: apenas pelo botão, para economizar).

### 3.5 Voz
- Leitura automática ligada ou desligada, além de um botão de "ouvir" em cada mensagem.
- Com vozes de IA, é possível escolher uma voz para o narrador.

### 3.6 Armazenamento
- **SQLite (`expo-sqlite`):** aventuras, mensagens, personagens, fichas, resumos e configurações.
- **Sistema de arquivos:** imagens geradas.
- **SecureStore:** chaves de API. Elas nunca vão para os backups nem para os arquivos exportados.
- **Exportar/importar** a aventura como arquivo `.json` (imagens opcionais).

### 3.7 Segurança de conteúdo
- Instruções de sistema com limites de conteúdo, mais um filtro local de palavras e categorias aplicado às entradas e saídas.
- Botão "denunciar resposta" que salva o trecho localmente e abre um e-mail ou formulário de contato do desenvolvedor.
- Classificação etária dos cenários prontos.
- Aviso na primeira abertura sobre conteúdo gerado por IA.

## 4. Telas

1. **Início:** lista de aventuras (continuar, apagar, exportar) e botão "Nova aventura".
2. **Nova aventura:** escolher um cenário pronto ou personalizado, escolher o modo (RPG / Roleplay) e criar o personagem (nome, aparência, história; no modo RPG, também distribuir atributos), com geração do retrato.
3. **Jogo:** histórico em formato de chat com imagens embutidas, campo de ação, botões (sugestões, refazer, desfazer, editar, gerar imagem, ouvir) e uma aba lateral com a ficha.
4. **Configurações:** provedores e modelos (texto, imagem e voz), chaves com "testar" e "como conseguir", estilo de imagem, frequência das imagens, voz, idioma e filtro.
5. **Primeira abertura:** um assistente curto para escolher o provedor e colar a chave, com guia passo a passo.

## 5. Cenários prontos (v1)
Fantasia medieval, cyberpunk, terror, ficção espacial, pós-apocalíptico e escola de magia. Cada um tem descrição, tom, abertura e sugestão de estilo de imagem.

## 6. Tratamento de erros
- A ação do jogador é salva **antes** do envio, então nada se perde.
- Há mensagens claras para os casos comuns: chave inválida, sem saldo, limite de uso, sem internet, servidor local fora do ar e modelo indisponível. Todas têm o botão "tentar de novo".
- Uma falha na imagem ou na voz nunca bloqueia o texto.
- Respostas cortadas ou mal formatadas: a narração é aproveitada e os comandos são ignorados.

## 7. Testes
- **Unitários (Jest):** motor de jogo (dados com semente fixa, limites, inventário, validação de comandos), parser da resposta da IA e montagem do contexto e dos resumos do narrador.
- **Adaptadores:** testados com respostas HTTP simuladas, sem chamadas reais.
- **Manual:** no celular via Expo Go; build de teste (APK) via EAS.

## 8. Fora da v1
Compartilhar cenários entre usuários, conteúdo adulto, iOS, contas e login, sistema de créditos e sincronização na nuvem.
