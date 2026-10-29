""" grafo do circuito.

grafo bipartido: nós 'rede' (cada coluna de cada metade = 1 nó elétrico) e
nós 'componente'; cada aresta é um terminal ligando o componente a uma rede.
assim componentes de 3 terminais (potenciômetro) ficam representados sem gambiarra."""

import json

import networkx as nx

from . import config as cfg


def monta_grafo(componentes):
    G = nx.Graph()
    for comp in componentes:
        G.add_node(comp.id, kind='componente', tipo=comp.tipo, cor=comp.cor, faixa=comp.faixa,
                   metade=cfg.METADES[comp.metade], linha=comp.linha, colunas=comp.colunas)
        for i, rede in enumerate(comp.redes()):
            G.add_node(rede, kind='rede')
            G.add_edge(comp.id, rede, terminal=i)
    return G


def contrai_jumpers(G):
    """ junta as redes ligadas por jumpers (fio = mesmo nó elétrico) e remove os jumpers.
    as redes resultantes recebem nomes como 'C3+B5'."""
    uniao = nx.Graph()
    uniao.add_nodes_from(n for n, d in G.nodes(data=True) if d['kind'] == 'rede')
    for n, d in G.nodes(data=True):
        if d['kind'] == 'componente' and d['tipo'] in cfg.TIPOS_JUMPER:
            redes = list(G.neighbors(n))
            uniao.add_edges_from(zip(redes, redes[1:]))

    novo_nome = {}
    for grupo in nx.connected_components(uniao):
        nome = '+'.join(sorted(grupo, key=_ordem_rede))
        for r in grupo:
            novo_nome[r] = nome

    H = nx.Graph()
    for n, d in G.nodes(data=True):
        if d['kind'] == 'componente' and d['tipo'] not in cfg.TIPOS_JUMPER:
            H.add_node(n, **d)
            for vizinho in G.neighbors(n):
                rede = novo_nome[vizinho]
                H.add_node(rede, kind='rede')
                H.add_edge(n, rede, **G.edges[n, vizinho])
    return H


def _ordem_rede(nome):
    """ 'C3' < 'C10' < 'B0'; nomes unidos ('C3+B5') ordenam pelo primeiro."""
    primeiro = nome.split('+')[0]
    return (cfg.METADES.index(primeiro[0]), int(primeiro[1:]), nome)


def para_dict(G):
    """ formato simples para enviar à interface/backend."""
    componentes = []
    for n, d in G.nodes(data=True):
        if d['kind'] != 'componente':
            continue
        terminais = sorted(G.edges(n, data=True), key=lambda e: e[2]['terminal'])
        componentes.append({'id': n, 'tipo': d['tipo'], 'cor': d['cor'], 'faixa': d.get('faixa'),
                            'posicao': {'metade': d['metade'], 'linha': d['linha'], 'colunas': d['colunas']},
                            'redes': [e[1] for e in terminais]})
    redes = sorted((n for n, d in G.nodes(data=True) if d['kind'] == 'rede'), key=_ordem_rede)
    return {'componentes': sorted(componentes, key=lambda c: c['id']), 'redes': redes}


def para_json(G, **kwargs):
    return json.dumps(para_dict(G), ensure_ascii=False, **kwargs)


def resumo(G):
    """ texto legível: uma linha por componente."""
    d = para_dict(G)
    if not d['componentes']:
        return '  (nenhum componente)'
    return '\n'.join(f"  {c['tipo']:<24} {c['id']:<36} redes: {' - '.join(c['redes'])}" for c in d['componentes'])


_SIMBOLOS = '123456789abcdefghijklmnopqrstuvwxyz'


def desenha_placa(G):
    """ texto: a placa em ASCII (metade de cima, canal, metade de baixo) com cada componente
    no lugar onde foi achado. cada componente é um símbolo; a legenda vem logo abaixo."""
    comps = sorted((d | {'id': n} for n, d in G.nodes(data=True) if d['kind'] == 'componente'),
                   key=lambda d: d['id'])
    celulas = {}
    legenda = []
    for i, c in enumerate(comps):
        simbolo = _SIMBOLOS[i] if i < len(_SIMBOLOS) else '#'
        for col in c['colunas']:
            celulas[(cfg.METADES.index(c['metade']), c['linha'], col)] = simbolo
        cols = c['colunas']
        legenda.append(f"  {simbolo} = {c['tipo']} ({c['cor']}{' + faixa ' + c['faixa'] if c.get('faixa') else ''}) em {c['metade']}{c['linha']}, "
                       f"colunas {cols[0]}-{cols[-1]}  redes: {' - '.join(sorted(set(G.neighbors(c['id'])), key=_ordem_rede))}")

    cabecalho = '       ' + ' '.join(f'{c:>2}' for c in range(cfg.N_COLUNAS))
    linhas = [cabecalho]
    for m in (0, 1):
        for l in range(cfg.N_LINHAS_METADE):
            sockets = ' '.join(f" {celulas.get((m, l, c), '.')}" for c in range(cfg.N_COLUNAS))
            linhas.append(f'  {cfg.METADES[m]}{l}   {sockets}')
        if m == 0:
            linhas.append('       ' + '-' * (3 * cfg.N_COLUNAS - 1))
    return '\n'.join(linhas + legenda)
