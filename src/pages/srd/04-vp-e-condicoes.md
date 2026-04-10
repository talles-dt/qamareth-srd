---
layout: '../../layouts/SrdLayout.astro'
title: 'VP e Condições'
---

# Pool de Vitalidade e Condições

Qamareth não usa pontos de vida. Usa **condições** que alteram o que você pode fazer, e um **Pool de Vitalidade** que determina quantas condições você pode carregar antes de quebrar.

## Pool de Vitalidade (VP)

**VP = Resistência + Resistência (Discernimento)** — a soma dos ratings desses dois sub-atributos, tipicamente 4-10.

VP funciona como um **buffer de condições**:
- Receber dano não subtrai do VP — **adiciona condições** que consomem capacidade de VP.
- Cada condição ocupa 1 ponto de capacidade de VP.
- Quando VP está cheio de condições, o personagem está sob pressão máxima.
- VP recupera através de **Compasso de Pausa** e **Retiro**.

> **VP não é gasto. VP é capacidade.** Determina quantas condições você carrega antes de ficar Comprometido.

## Estados de Resiliência

Todo personagem existe em um de quatro estados:

| Estado | Condições Ativas | Efeito Mecânico |
|---|---|---|
| **Claro** | 0-1 | Conjunto completo de ações. Todas as opções disponíveis. |
| **Pressionado** | 2-3 | Ações pesadas custam +1 batida. Reações limitadas a 1 por compasso. |
| **Comprometido** | 4+ | Reações reduzidas a 0 por compasso. Não pode fazer ações Pesadas. |
| **Quebrado** | Condição fim-de-cena | Personagem não pode continuar na cena. Não necessariamente morte — pode ser retirada, captura, rendição ou colapso. |

### Transição entre Estados

Um personagem transiciona entre estados baseado no **número de condições ativas**. Quando uma condição é removida (por cura, resolução narrativa ou tempo), o personagem pode voltar a um estado mais leve.

## Condições Principais

Condições são a expressão mecânica primária de pressão. Elas mudam **o que você pode fazer**, não o quão bem você faz.

### Combate
| Condição | Efeito | Gatilho |
|---|---|---|
| **Desritmado** | Próxima ação custa +1 batida | Ação interrompida, falha de timing |
| **Exposto** | Próximo golpe contra você é indefeso | Perdeu reação, flanqueado, pego desprevenido |
| **Atordoado** | Pule a reação do próximo compasso | Golpe decisivo, choque sônico/mágico |
| **Sangrando** | Capacidade de VP reduzida em 1 | Condição de arma específica, ferimento grave |
| **Imobilizado** | Não pode mudar de zona | Grapnel, terreno, restrição mágica |
| **Dominado** | Oponente tem opção de batida 0 contra você | Oponente alcançou vantagem esmagadora |
| **Pesado** | Todo movimento custa +1 batida | Custo de armadura, golpe pesado recebido |

### Mágicas
| Condição | Efeito | Gatilho |
|---|---|---|
| **Dissonância** | +2 batidas na próxima execução | Interrupção mágica, falha de execução |
| **Harmônico** | Próxima execução coletiva: +1 tier de escala | Execução perfeita, Transcendência |
| **Saturado** | Execuções da mesma disciplina custam +1 batida até limpar | Execuções sucessivas rápidas |
| **Ressonante** | Todas as execuções na cena têm threshold elevado; Transcendências dobradas | Efeito coletivo de cena |
| **Silenciado** | Não pode usar disciplinas Voz/Instrumento; não pode falar em cena social | Meio destruído, estado social Quebrado |
| **Transbordo de Motivo** | Exceder capacidade de motivo causa dissonância | Muitos motivos em execução única |

### Espirituais
| Condição | Efeito | Gatilho |
|---|---|---|
| **Estado Kenótico** | Poder verdadeiro através de amor sacrificial; vitória através do sofrimento | Prática de kenosis |
| **Foco Nepsis** | Vigilância concede vantagem contra logismoi | Prática da Oração do Coração (5 níveis) |

### Paixões (comportamentais — veja Paixões para detalhes)
| Condição | Efeito | Gatilho |
|---|---|---|
| **Gula** | Acumulação, vício, recusa em compartilhar | Paixão de Gula ativada |
| **Luxúria** | Objetificação de pessoas, sedução manipulativa | Paixão de Luxúria ativada |
| **Avareza** | Amor ao dinheiro/acumulação, medo da pobreza | Paishão de Avareza ativada |
| **Ira** | Fúria, vingança, recusa em perdoar | Paixão de Ira ativada |
| **Tristeza** | Desespero, desesperança, "o império nunca cairá" | Paishão de Tristeza ativada |
| **Acídia** | Preguiça espiritual, pular deveres, "demônio do meio-dia" | Paishão de Acídia ativada |
| **Vainagloria** | Ostentação, performar virtude para aplausos | Paishão de Vainagloria ativada |
| **Soberba** | Auto-suficiência, "não preciso de ninguém" | Paishão de Soberba ativada |

## Criando Novas Condições

O Narrador pode criar condições customizadas para qualquer situação. Uma condição deve:

1. Ter um **nome** (poético, evocativo, tematicamente ressonante)
2. Ter um **efeito mecânico claro** que muda comportamento, não números
3. Ter um **gatilho narrativo** (quando ativa)
4. Ter um **caminho de resolução claro** (como limpa)

## Acúmulo de Condições

Um personagem pode carregar múltiplas condições. Quando condições se acumulam:

- **Mesma condição duas vezes:** A segunda instância eleva o efeito (ex: Desritmado ×2 = próximas DUAS ações custam +1 batida)
- **Condições conflitantes:** A condição mais severa prevalece
- **Gatilho de Cicatriz:** Sobrepõe todas as outras condições para aquele momento específico

---

[← Anterior: Resolução de Ações](/srd/03-resolucao) · [Próximo: Magia Musical →](/srd/05-magia-musical)
