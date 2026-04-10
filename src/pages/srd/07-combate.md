---
layout: '../../layouts/SrdLayout.astro'
title: 'Combate'
---

# Combate

O combate em Qamareth usa **economia de batidas**, não iniciativa. Todos agem a cada compasso. Ninguém fica de fora.

## O Compasso

Uma cena de combate é dividida em **COMPASSOS** (rodadas). Cada compasso tem **4 BATIDAS**.

### Classes de Velocidade

| Velocidade | Custo | Descrição |
|---|---|---|
| **Reação** | 0 batidas | Uma ação reativa por compasso. Interrupções, paradas, esquivas. |
| **Ligeiro** | 1 batida | Ações rápidas: fintas, gritos, golpes menores, reposicionamento. |
| **Médio** | 2 batidas | Ações normais: ataques padrão, manobras defensivas, maioria das execuções. |
| **Pesado** | 3-4 batidas | Ações devastadoras: golpes decisivos, execuções grandiosas, movimentos que mudam a cena. |

### Como um Compasso Funciona

1. **Todos declaram ações** no início do compasso.
2. **Ações resolvem em ordem de velocidade:** Reação (0) → Ligeiro (1) → Médio (2) → Pesado (3-4).
3. **Dentro da mesma classe**, o Narrador decide baseado na ficção (quem tem iniciativa narrativa, quem estava pronto para agir).
4. **Após todas as ações**, o compasso termina. Um novo compasso começa com as próximas 4 batidas.

## Declaração de Ações

Cada personagem declara:
- **O que** pretende fazer
- **Contra quem** (se aplicável)
- **Qual velocidade** custa (Ligeiro, Médio ou Pesado)

## Atacar

```
Pool = atributo de Vigor (Força, Agilidade ou Resistência)
Tipo = disciplina de combate (Lâmina, Impacto, Alcance)
Role → conte sucessos → compare ao threshold de defesa do alvo
```

### Threshold de Defesa

| Defesa | Threshold |
|---|---|
| Sem defesa (pego desprevenido) | 1+ |
| Postura defensiva (disciplina Defesa) | 2+ |
| Postura defensiva + escudo | 3+ |
| Postura defensiva + escudo + condição Exposto | Reduza em 1 |

## Dano → Condições, Não Números

Um ataque bem-sucedido **cria condições** no alvo:

| Sucessos Extras | Condição Aplicada |
|---|---|
| Alcançou threshold (sem extras) | Desritmado — próxima ação custa +1 batida |
| +1 sobre threshold | Exposto — próximo golpe é indefeso |
| +2 sobre threshold | Sangrando — capacidade de VP reduzida em 1 |
| +3+ sobre threshold | Atordoado — pule a reação do próximo compasso |

Múltiplas condições do mesmo ataque se acumulam. Se o alvo atingir 4+ condições, fica **Comprometido**. Se atingir uma condição fim-de-cena, fica **Quebrado**.

## Posturas — Condições, Não Modificadores

Personagens podem adotar uma **postura** no início de um compasso. Posturas criam condições, não bônus numéricos:

| Postura | Efeito |
|---|---|
| **Forte** | Seus ataques criam um tier adicional de condição ao acertar. Seu threshold de defesa é reduzido em 1. |
| **Legato** | Pode fazer uma Reação adicional por compasso. Seus ataques criam um tier a menos de condição. |
| **Staccato** | Suas ações Ligeiras podem mirar qualquer classe de velocidade. Suas ações Médias custam +1 batida. |
| **Rubato** | Pode mudar de postura no meio do compasso como Tempo Livre. Seus ataques criam condições escolhidas de dois tiers. |

## Tempo Livre

Certas ações custam **0 batidas** se alinhadas narrativamente com:
- O **Motivo de Origem** do personagem
- Uma **Paixão Dominante** (6-8+) sendo atuada
- Um gatilho de **Cicatriz** que o personagem abraça

Exemplos:
- Personagem com Motivo protetor pode se interpor como Tempo Livre.
- Personagem com Ira 6-8 pode gritar um aviso como Tempo Livre (confronto é sua natureza).
- Personagem cuja Cicatriz ativa sob fogo age com clareza elevada como Tempo Livre.

## Reações

Cada personagem tem **uma Reação por compasso** (0 batidas):
- Aparar um ataque recebido
- Esquivar para segurança
- Gritar um aviso
- Ativar uma Condição de Cicatriz
- Interromper com ação Ligeira (custa 1 batida do próximo compasso)

Reações são narrativas, não gatilhos mecânicos. A ficção deve suportar a reação.

---

[← Anterior: Tensão Harmônica](/srd/06-tensao-harmonica) · [Próximo: Armas e Armaduras →](/srd/08-armas-e-armaduras)
