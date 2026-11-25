# Taverna AI — como continuar o projeto

Atualizado em 25/11/2026. Este arquivo serve tanto para você quanto para qualquer IA (ChatGPT/Codex,
Gemini, Claude) que for continuar o trabalho.

## Estado atual (pronto e testado)
- **Jogo:** modos RPG (dados d20, vida, atributos, inventário) e Roleplay livre.
- **Narração:** estilo livro, com 3 botões de escolha, ações Fazer / Dizer / História e botão Continuar.
- **Modelo do narrador:** troca direto no jogo, com busca, favoritos e recentes.
- **Estilo do narrador:** tamanho (curta/média/longa) e tom (épico, sombrio, engraçado, romântico).
- **Diário:** missões e personagens anotados pela IA; fatos do mundo escritos pelo jogador.
- **Saves e ramos:** "Salvar ponto" e "Criar caminho daqui" (cópia da história a partir de uma cena).
- **Imagens:** de cena, retrato do personagem (referência para manter o rosto) e voz (celular ou IA).
- **Provedores de texto:** ChatGPT pela assinatura Plus/Pro, OpenRouter, Claude, OpenAI, Gemini, Ollama no PC.
- **Provedores de imagem:**
  - OpenRouter (dezenas de modelos: Nano Banana, GPT Image, FLUX, Seedream, Recraft…);
  - OpenAI;
  - Stability;
  - Stable Diffusion no PC.
- **Interface:** tela inicial em formato biblioteca; cenários em cartões; português e inglês.
- **Segurança:** filtro de conteúdo e botão de denúncia.
- **Qualidade:** 60 testes automáticos passando.

## Próximos passos (em ordem sugerida)
1. **Arte:** ícone do app, tela de abertura e 6 capas de cenário.
   - As capas vão em `assets/images/scenarios/<id>.jpg`.
   - Preencher `image: require(...)` em `src/content/covers.ts`.
   - Atualizar ícone e abertura em `app.json`.
2. **Testar o login com ChatGPT** com uma conta real e corrigir o que aparecer.
3. **Gerar o APK** para instalar no celular sem o Expo Go:
   `npx eas-cli@latest build -p android --profile preview` (precisa de conta grátis em expo.dev).
4. **Antes da Play Store:**
   - preencher `SUPPORT_EMAIL` em `src/config.ts`;
   - criar uma política de privacidade;
   - gerar o build de produção.
5. **Ideias futuras:** música ambiente, retratos dos NPCs, conquistas, mais cenários prontos.

## Como rodar no PC
```powershell
npm install
npx expo start          # escaneie o QR code com o app Expo Go no celular
npx jest                # testes
npx tsc --noEmit        # checagem de tipos
npx expo lint           # estilo de código
```
Pré-requisitos: Node.js LTS e Git instalados.

## Como continuar com outra IA

O código inteiro está no GitHub: **https://github.com/VictorCoutoB/taverna-ai**
(público, licença MIT). Qualquer IA que consiga ler esse repositório consegue continuar. Os arquivos
`AGENTS.md` e `GEMINI.md` na raiz explicam o projeto para elas automaticamente.

### ChatGPT (Codex)
1. Abra o ChatGPT → **Codex** (chatgpt.com/codex) e conecte sua conta do GitHub.
2. Escolha o repositório **taverna-ai** e peça a tarefa, por exemplo:
   *"Leia docs/CONTINUAR.md e faça o próximo passo 1."*
3. O Codex trabalha numa cópia na nuvem e abre um *pull request* (uma proposta de mudança) no GitHub.
   Você revisa e clica em **Merge** para aceitar.
4. Para trazer as mudanças ao seu PC, rode `git pull` na pasta do projeto.

### Gemini
- **Pelo navegador:** em gemini.google.com, anexe o repositório do GitHub (botão de anexar →
  importar código / GitHub) e peça a tarefa. Ele sugere o código; você aplica.
- **No PC (Antigravity, o ambiente de programação do Google):** abra a pasta do projeto nele e peça a
  tarefa. Ele lê o `GEMINI.md` automaticamente.

### Dica para qualquer IA
Comece a conversa com:
> "Este é o projeto Taverna AI. Leia AGENTS.md e docs/CONTINUAR.md antes de mudar qualquer coisa.
> Responda em português. Rode os testes antes de terminar."
