# Superteam Snake: como lançar e o que falta

Guia para colocar o jogo na App Store dos badges e manter o faucet funcionando.
Detalhes técnicos estão no [README](README.md).

## Onde estamos (9 nov 2026)

| | Status |
|---|---|
| Jogo (app do badge) | ✅ pronto, testado no emulador local (offline) |
| Servidor do faucet | ✅ no ar em https://stbr-snake.vercel.app (Vercel, conta pessoal "Kuka's projects") |
| Segredos no servidor (`TREASURY_SECRET`, `PLAYER_KEY_SECRET`, `PUBLIC_ORIGIN`) | ✅ configurados |
| Banco (Upstash Redis) | ❌ falta: aceitar os termos (passo 1) |
| Faucet com saldo | ❌ falta: fundear (passo 2) |
| Teste com rede de verdade (pagamento ponta a ponta) | ❌ falta (passo 3) |
| Publicado na App Store | ❌ falta (passo 4) |

## O que falta, em ordem

### 1. Ligar o banco (Upstash Redis)

O servidor guarda as partidas e o limite diário num Redis. Sem ele, toda partida dá erro
no servidor e ninguém recebe.

1. Aceitar os termos do Upstash na Vercel:
   https://vercel.com/kukas-projects-42f30d98/~/integrations/accept-terms/upstash?source=cli
2. Criar o banco (plano grátis) e ligar ao projeto, na pasta `apps/stbr-snake/server`:
   ```sh
   npx vercel integration add upstash/upstash-kv --no-claim --no-env-pull --name stbr-snake-kv
   npx vercel deploy --prod
   ```
   Isso cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` no projeto. Também dá para fazer pelo
   painel: projeto `stbr-snake` > Storage > Upstash for Redis > Connect.

### 2. Fundear o faucet

Endereço (DevNet): **`3Q8wJvSvnMuzsJXAx3CgfWj2UgrFbMedm4n1NBEjxrA9`**

- Faucets: https://faucet.solana.com (com login do GitHub dá mais), ou pedir SOL de DevNet
  para quem tiver sobrando.
- Quanto: cada jogador pode sacar até **0,5 SOL por dia**. 100 jogadores = até 50 SOL/dia
  no pior caso.
- Saldo atual: https://stbr-snake.vercel.app/api/status (`balanceSol`).
- Se o faucet secar, o jogo avisa "The faucet is empty, sorry!" e não desconta nada do
  limite do jogador.

### 3. Testar com rede de verdade

O emulador local (`http://127.0.0.1:8787/?app=stbr-snake`) é offline: só joga em modo
treino. O teste real é no site da Solana:

1. Entrar em https://solana.com/breakpoint/badge/apps/submit com uma conta que tenha o
   **X conectado** (em `/profile`). Essa conta vira a autora do app: de preferência a do
   Superteam BR.
2. Arrastar **`build/stbr-snake.zip`** para o editor (veja "Gerar o zip" abaixo). Não
   arraste a pasta `apps/stbr-snake` inteira: ela levaria o servidor junto.
3. **Try in emulator** (ou **Run on badge**, com o badge no USB): abre um teste de 12 horas
   em que a rede funciona.
4. Conferir:
   - [ ] No menu aparece o saldo da wallet e "today 0.5 left".
   - [ ] Partida: o placar mostra "today ... left" (sem "offline").
   - [ ] Com 10 pontos: "CASH OUT UNLOCKED!", SELECT > Cash out paga ("+0.1 SOL sent to your wallet!").
   - [ ] Morrer com 10+ pontos: "You lost ... SOL!" e nada é pago.
   - [ ] My wallet: endereço, 12 palavras e chave privada aparecem.
   - [ ] Send to Phantom: Phantom em Testnet Mode (Solana Devnet), escanear o QR, aprovar,
         e o SOL chega no celular.
   - [ ] Importar as 12 palavras no Phantom dá a mesma wallet do badge.

### 4. Publicar na App Store

No mesmo editor do passo 3, **Publish**. A loja compila o código e roda uma checagem
automática (cerca de 1 minuto). Se passar, o jogo aparece para todo mundo.

- **Pode cair em revisão manual.** A checagem procura apps que mandam dados para fora ou
  mexem com chaves. O nosso fala com um servidor externo e mostra chave privada. Se for
  sinalizado, espera um organizador da Solana aprovar; até lá só a gente vê o app.
- **Se rejeitarem por causa das chaves:** tirar as páginas de chave da tela My wallet
  (`screens/wallet.lua`) e deixar só o Send to Phantom. A documentação da Solana desaconselha
  guardar chaves no badge; por isso as telas dizem que é uma wallet só de teste, de DevNet.

### 5. Divulgar

- Funciona em qualquer badge com Solana OS 0.5.3+, o original ou o Superteam OS. Não
  precisa gravar firmware em ninguém: a pessoa instala pelo app **App Store** do badge.
- O badge precisa de **Wi-Fi** e ter **dono** (ativado com a conta da pessoa). Sem isso o
  jogo roda só em modo treino.
- Para ver no Phantom: Settings > Developer Settings > Testnet Mode > Solana Devnet.

## Depois do lançamento

### Gerar o zip do app

Na raiz do repositório:

```sh
cd apps/stbr-snake && mkdir -p ../../build && rm -f ../../build/stbr-snake.zip \
  && zip -q -X ../../build/stbr-snake.zip app.json main.lua screens/*.lua
```

Para atualizar o jogo: aumentar `version` em `app.json`, gerar o zip de novo e publicar.
O badge oferece a atualização e baixa só o que mudou.

### Mudar as regras (sem publicar o jogo de novo)

São variáveis de ambiente do projeto na Vercel. O jogo lê os valores do servidor a cada
partida.

| Variável | Padrão | O que é |
|---|---|---|
| `LAMPORTS_PER_POINT` | `10000000` (0,01 SOL) | quanto vale cada ponto |
| `DAILY_CAP_LAMPORTS` | `500000000` (0,5 SOL) | máximo por jogador por dia (UTC) |
| `MIN_POINTS` | `10` | pontos para liberar o saque |
| `MIN_MS_PER_POINT` | `350` | ritmo mínimo (contra pontuação falsa) |
| `ALLOW_EMULATOR` | ligado | `0` paga só badges físicos |

```sh
cd apps/stbr-snake/server
npx vercel env add DAILY_CAP_LAMPORTS --environment production   # cola o valor
npx vercel deploy --prod
```

Os textos do guia (How to play) citam 0,01 / 10 pontos / 0,5 SOL: se mudar os números,
atualize `screens/help.lua` e publique uma versão nova.

### Acompanhar

- Saldo e regras: https://stbr-snake.vercel.app/api/status
- Logs: `cd apps/stbr-snake/server && npx vercel logs --since 1h`
- Testes do servidor (offline): `cd apps/stbr-snake/server && npm install && npm test`

### Segredos: guardar com cuidado

Ficam no Mac do Pedro, em `~/.config/solana/`, e como "Secret" na Vercel. Faça backup
num cofre de senhas do time.

| Arquivo | O que é | Se perder |
|---|---|---|
| `superteam-snake-faucet.json` | chave da wallet do faucet | perde o acesso ao SOL do faucet (é DevNet: dá para criar outro e fundear de novo) |
| `superteam-snake-player-secret` | gera as wallets dos jogadores | **todo jogador ganha uma wallet nova e vazia**; o que já estava nas antigas só sai pela cópia guardada no badge |

### Pendências opcionais

- [ ] Mover o projeto da Vercel da conta pessoal para um time do Superteam BR
      (Settings > Transfer). O endereço `stbr-snake.vercel.app` continua o mesmo.
- [ ] Ligar o projeto da Vercel ao GitHub (`solanabr/superteam-os`, Root Directory
      `apps/stbr-snake/server`) para fazer deploy a cada push. Precisa de uma conta da
      Vercel com acesso ao repositório.
- [ ] Um RPC de DevNet próprio (Helius, Triton) em `SOLANA_RPC_URL`, se o público ficar
      lento ou limitar.
- [ ] Testar o jogo num badge físico.
