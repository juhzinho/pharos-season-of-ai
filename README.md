# Pharos Season of AI — builds

**For reviewers (English):** each task is a separate script with its own README:

| Task | Folder | Run |
|---|---|---|
| Doc-Search CLI | [`tasks/01-doc-search-cli`](tasks/01-doc-search-cli/README.md) · [live demo](https://pharos-contract-reader.vercel.app/#docs) | `npm run docs -- "how do I deploy a contract?"` |
| Read Contract State | [`tasks/02-read-contract-state`](tasks/02-read-contract-state/README.md) · [live demo](https://pharos-contract-reader.vercel.app/#read) | `npm run read -- USDC` / `npm run agent` |
| Event/Log Monitor | [`tasks/03-event-monitor`](tasks/03-event-monitor/README.md) · [live demo](https://pharos-contract-reader.vercel.app/#events) | `npm run monitor -- USDC` |

Setup: `npm install` (Node.js 20.12+). Read-only: no wallet or private key is ever needed.

---

Tarefas do [Pharos Agent Arena](https://pharos-agent-arena.vercel.app/) construídas sobre os MCPs oficiais da Pharos, sem chave de API:

| MCP | Endpoint |
|---|---|
| Chain MCP | `https://mcp.pharos.xyz/mcp` |
| Developer Docs MCP | `https://docs.pharos.xyz/~gitbook/mcp` |

Rede: Pharos Pacific Mainnet (chain ID `1672`). Nenhuma tarefa precisa de chave privada: todas só leem dados.

## Instalação

```bash
npm install
npm test        # testes de interpretação de perguntas + testes de ponta a ponta contra a mainnet real
```

Requer Node.js 20.12+ (testado no Node 22).

---

## Tarefa 1 — Doc-Search CLI (Easy, 50 pts)

Wrapper de linha de comando sobre o Developer Docs MCP (`askQuestion`, `searchDocumentation`, `getPage`). Recebe a pergunta direto, devolve uma resposta curta com os links das páginas de origem e, quando a documentação não cobre o assunto, avisa em vez de inventar. Detalhes e 3 exemplos reais: [`tasks/01-doc-search-cli/README.md`](tasks/01-doc-search-cli/README.md). Ao vivo: [#docs](https://pharos-contract-reader.vercel.app/#docs).

```bash
npm link                                   # opcional: instala o comando pharos-docs
pharos-docs "how do I deploy a contract?"  # ou: npm run docs -- "how do I deploy a contract?"
pharos-docs search "chain id rpc mainnet" --limit 3
pharos-docs page /getting-started/token-registry
```

---

## Tarefa 2 — Read Contract State (Easy, 50 pts)

Lê o estado ativo de um contrato da Pharos pelo Chain MCP e explica em linguagem simples. Tem duas formas:

- **Script** (`read.js`): determinístico, sempre mostra o mesmo relatório completo.
- **Agente** (`agent.js`): responde perguntas em **português ou inglês**, no idioma da pergunta. Não usa IA paga nem chave de API: ele interpreta a pergunta, monta um plano, chama as ferramentas do Chain MCP e explica o resultado. Lembra do contrato da pergunta anterior ("And who owns it?").
- **Agente com IA, opcional** (`agent-ai.js`): a mesma ideia, mas com um modelo de linguagem (Gemini, OpenAI, Groq, OpenRouter ou Ollama) decidindo quais ferramentas chamar.

Todos usam o mesmo código de leitura (`lib/contract-state.js`).

**Demonstração ao vivo:** [pharos-contract-reader.vercel.app](https://pharos-contract-reader.vercel.app/): leitura do contrato e chat com o agente direto no navegador, em inglês ou português (`?lang=pt`). O mesmo site tem abas para as tarefas 1 e 3. As funções em `api/` chamam o Chain MCP no servidor, porque o endpoint não libera CORS para navegadores. Para rodar localmente: `npm run web`.

### Contrato escolhido: USDC oficial na Pharos

`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`, o USDC emitido pela Circle e listado no [Token Registry](https://docs.pharos.xyz/getting-started/token-registry) da documentação oficial (endereço obtido pelo próprio Developer Docs MCP). Ele é interessante porque, além dos dados de token, tem proprietário, pode ser pausado e é um contrato *proxy* atualizável — tudo isso aparece na leitura. O script aceita qualquer outro contrato também.

### Como cada requisito é atendido

| Requisito | Como |
|---|---|
| Lê 3+ valores via Chain MCP | `name`, `symbol`, `decimals`, `totalSupply`, `owner`, `paused`, `balanceOf` (via `eth_call`), bytecode (`get_code`), saldo PROS (`get_balance`) e slots de proxy EIP-1967 / ZeppelinOS no armazenamento bruto (`get_storage_at`) |
| Mostra endereço e bloco | O bloco é lido uma vez (`get_chain_info`) e **todas** as leituras são fixadas nele, então os valores são consistentes entre si |
| Formata para humanos | Decimais aplicados sem perder precisão, separadores pt-BR, endereços rotulados (`[proprietário]`, `[implementação]`, `[admin do proxy]`, `[carteira consultada]`, tokens oficiais), link do explorer e um resumo em português simples |
| README | Este arquivo |

### Como rodar o script

```bash
npm run read -- USDC                           # contrato escolhido
npm run read -- USDC 0xSuaCarteira             # + saldo de uma carteira
npm run read -- WPROS --block 20170000         # em um bloco do passado
npm run read -- 0xQualquerContrato --json      # dados brutos em JSON
```

### Exemplo de saída

```
LEITURA DO CONTRATO — dados lidos no bloco 20.175.891 da Pharos (chain 1672)

  Contrato                 USDC oficial (Circle)
  Endereço                 0xC879C018dB60520F4355C26eD1a6D572cdAC1815
  Ver no explorer          https://www.pharosscan.xyz/address/0xC879C018dB60520F4355C26eD1a6D572cdAC1815
  Bloco da leitura         20.175.891
  Tamanho do código        1.798 bytes

  TOKEN
  Nome                     USDC
  Símbolo                  USDC
  Casas decimais           6
  Total em circulação      18.158.760,24 USDC
  Valor bruto on-chain     18158760247433 (÷ 10^6)

  CONTROLE
  Proprietário (owner)     0x9F8Ea09770Dc38fc61f5a62031b3BE0526D54D92  [proprietário]
  Pausado                  não
  Proxy                    sim (padrão ZeppelinOS)
  Implementação            0xC35BEcB283fEC66626220467265F6d3B3f8cEae8  [implementação]
  Admin do proxy           0x46f958BdEFfD33495E058873cDd114c79Ec13F1b  [admin do proxy]
  Saldo PROS do contrato   0 PROS

EM LINGUAGEM SIMPLES

  Este é o contrato do token USDC na rede Pharos — o mesmo listado na
  documentação oficial como "USDC oficial (Circle)". Existem 18.158.760,24 USDC
  em circulação, e cada USDC pode ser dividido em até 6 casas decimais. Ele tem
  um proprietário, o endereço 0x9F8E…4D92, que possui permissões especiais de
  administração. Ele não está pausado, então as transferências funcionam
  normalmente. É um contrato do tipo "proxy": o endereço público nunca muda, mas
  a lógica fica em outro contrato (0xC35B…Eae8), o que permite aos
  administradores atualizar o código.
```

### Como rodar o agente

```bash
npm run agent -- "Who owns the USDC contract?"
npm run agent -- "Quanto WPROS existe?"
npm run agent                                  # modo conversa
```

Exemplo de conversa:

```
you> What is the USDC contract?
  plan: read the state of contract 0xC879…1815 at the latest block
  Chain MCP: get_chain_info, get_code, get_balance, eth_call ×6, get_storage_at ×4 (13)

This is the USDC token — the same one listed in the official Pharos docs as "USDC oficial (Circle)".
There are 18,160,671.28 USDC in circulation. (On-chain this is stored as 18160671281524; dividing by 10^6 gives the real amount.)
The owner is 0x9F8Ea09770Dc38fc61f5a62031b3BE0526D54D92. This address has special admin permissions over the contract.
The contract is not paused: transfers work normally.
It is a "proxy" contract (ZeppelinOS standard): ...

Contract 0xC879C018dB60520F4355C26eD1a6D572cdAC1815 · read at Pharos block 20,177,372
https://www.pharosscan.xyz/address/0xC879C018dB60520F4355C26eD1a6D572cdAC1815

you> And who owns it?
  plan: read the state of contract 0xC879…1815 at the latest block (contract from the previous question)
  reusing the read from under 30 s ago (block 20177372), no new Chain MCP call

The owner is 0x9F8Ea09770Dc38fc61f5a62031b3BE0526D54D92. ...
```

O que ele entende: o que é o contrato, total em circulação, casas decimais, nome/símbolo, dono, pausa, se é atualizável (proxy), saldo de uma carteira, bloco atual e preço do gas. Digite `help` / `ajuda` para ver exemplos.

### Agente com IA (opcional)

Copie `.env.example` para `.env` e preencha **uma** chave (Gemini tem plano gratuito). A ferramenta `send_raw_transaction` é bloqueada: ele só lê.

```bash
npm run agent:ai -- "O que é o contrato do USDC e quem controla ele?"
```

---

## Tarefa 3 — Event/Log Monitor (Easy, 50 pts)

Monitora eventos `Transfer` de um token pelo Chain MCP (`get_logs` filtrado pelo endereço do contrato e pela assinatura do evento, + `get_block_number`). Carrega o histórico recente e depois acompanha blocos novos em tempo real, sem repetir eventos (chave `tx hash + log index`), respeitando o limite de 1000 blocos por consulta. Identifica MINT e BURN e rotula endereços conhecidos. Detalhes e uma execução real pegando eventos ao vivo: [`tasks/03-event-monitor/README.md`](tasks/03-event-monitor/README.md). Ao vivo: [#events](https://pharos-contract-reader.vercel.app/#events).

```bash
npm run monitor -- USDC --min 500                  # ao vivo, só transfers ≥ 500 USDC
npm run monitor -- WPROS --lookback 1000 --once    # varre os últimos 1000 blocos e sai
npm run monitor -- USDC --links                    # com link do explorer de cada tx
```

Opções: `--min <valor>`, `--interval <segundos>`, `--lookback <blocos>`, `--once`, `--links`.

---

## Confiabilidade

O Chain MCP público limita requisições por IP e às vezes derruba conexões. O cliente em `lib/mcp.js` limita chamadas simultâneas, repete automaticamente só falhas de rede (com espera crescente) e nunca confunde uma falha de rede com "o contrato não tem essa função".
