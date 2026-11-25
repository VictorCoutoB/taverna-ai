# Taverna AI

RPG em texto narrado por IA (estilo FableAI) para Android, feito com React Native + Expo.
Cada pessoa escolhe o modelo e usa a própria chave de API; tudo fica salvo no celular.

- **Modos:** RPG (dados d20, vida, atributos, inventário) e Roleplay livre.
- **Texto:** OpenRouter, Anthropic (Claude), OpenAI, Google Gemini ou Ollama no PC.
- **Imagem:** OpenRouter, OpenAI, Stability AI ou Stable Diffusion no PC (retratos consistentes via referência no OpenRouter).
- **Voz:** voz do celular (grátis), OpenAI ou ElevenLabs.

Design completo: [docs/superpowers/specs/2026-11-25-ai-rpg-design.md](docs/superpowers/specs/2026-11-25-ai-rpg-design.md)

## Rodar

```powershell
npm install
npx expo start          # abra no celular com o app Expo Go (QR code)
npx expo start --web    # prévia rápida no navegador
```

> Algumas bibliotecas (SQLite, SecureStore, áudio) funcionam melhor num *development build*:
> `npx eas-cli@latest build -p android --profile development`.

## Verificar

```powershell
npx jest
npx tsc --noEmit
npx expo lint
```

## Estrutura

| Pasta | O que faz |
|---|---|
| `src/engine` | Motor de jogo: dados, ficha, validação dos comandos da IA |
| `src/narrator` | Prompts, contexto/memória, leitura da resposta, rodada |
| `src/providers` | Conectores de texto, imagem e voz |
| `src/storage` | SQLite (web: localStorage), chaves seguras, imagens, exportação |
| `src/media` | Imagens de cena, retratos e narração |
| `src/safety` | Filtro de conteúdo e denúncias |
| `src/app` | Telas (Expo Router) |

## Antes de publicar na Play Store

1. Preencha `SUPPORT_EMAIL` em `src/config.ts` (recebe as denúncias).
2. Troque ícone e splash em `assets/images` e confira `android.package` em `app.json`.
3. Crie uma política de privacidade (o app não coleta dados, mas a Play Store exige o link).
4. Gere o pacote: `npx eas-cli@latest build -p android --profile production`.
