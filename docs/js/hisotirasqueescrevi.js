// js/hisotirasqueescrevi.js
import { supabase } from './supabase.js'
import { exibirUsuarioLogado } from './userDisplay.js'

/************************************************************
 * [A] LOGIN/LOGOUT
 ************************************************************/
document.addEventListener('DOMContentLoaded', exibirUsuarioLogado)

/************************************************************
 * [B] VARIÁVEIS GLOBAIS (modo de leitura, etc.)
 ************************************************************/
let modoCorrido = true
let partesHistoria = []
let parteAtual = 0
let isTitleListVisible = false
let currentStoryId = null    // para marcador de linha
let textoCompleto = ''       // texto da história
const wrapWidth = 80         // caracteres por linha
const lineHeightPx = 22      // altura aproximada de linha em px

/************************************************************
 * [C] CARREGAR CATEGORIAS NO <select>
 ************************************************************/
async function carregarCategorias() {
  const { data: categorias, error } = await supabase
    .from('categorias')
    .select('id, nome')
    .order('nome', { ascending: true })

  if (error) {
    console.error('Erro ao carregar categorias:', error)
    return
  }

  const sel = document.getElementById('categoria')
  if (!sel) return
  sel.innerHTML = categorias
    .map(cat => `<option value="${cat.id}">${cat.nome}</option>`)
    .join('')
}

/************************************************************
 * [D] TOGGLE DA LISTA LATERAL
 ************************************************************/
function toggleTitleList(show) {
  const titleList = document.getElementById('titleListLeft')
  if (!titleList) return
  titleList.classList.toggle('visible', show)
  isTitleListVisible = show
}
document.body.addEventListener('mousemove', e => {
  if (e.clientX < 50 && !isTitleListVisible) toggleTitleList(true)
})
document.body.addEventListener('mouseleave', () => {
  if (isTitleListVisible) toggleTitleList(false)
})
document.body.addEventListener('click', e => {
  const titleList = document.getElementById('titleListLeft')
  if (isTitleListVisible && titleList && !titleList.contains(e.target)) {
    toggleTitleList(false)
  }
})

/************************************************************
 * [E] LISTAR HISTÓRIAS NA LATERAL
 ************************************************************/
async function mostrarHistorias() {
  const { data: cartoes, error } = await supabase
    .from('cartoes')
    .select(`
      id,
      titulo_cartao,
      autor_cartao,
      data_criacao,
      historias (
        id,
        titulo,
        descricao
      )
    `)
    .order('data_criacao', { ascending: false })

  if (error) {
    console.error('Erro ao buscar histórias:', error)
    return
  }

  const ul = document.getElementById('titleListUl')
  if (!ul) return
  ul.innerHTML = ''

  cartoes.forEach(c => {
    const li = document.createElement('li')
    li.textContent = c.titulo_cartao

    const spanBtns = document.createElement('span')
    spanBtns.classList.add('buttons')

    const lerBtn = document.createElement('button')
    lerBtn.textContent = 'Ler'
    lerBtn.onclick = () => exibirHistoria(c.id)

    const delBtn = document.createElement('button')
    delBtn.textContent = 'Excluir'
    delBtn.onclick = () => excluirHistoria(c.id)

    spanBtns.append(lerBtn, delBtn)
    li.appendChild(spanBtns)
    ul.appendChild(li)
  })
}

/************************************************************
 * [F] INSERIR NOVA HISTÓRIA (e cartão e categoria)
 ************************************************************/
async function salvarHistoria(titulo, descricao, autor, categoriaId) {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user.id
  if (!userId) {
    alert('É necessário estar logado para salvar histórias.')
    return
  }

  // 1) Cria em historias
  const { data: historia, error: errH } = await supabase
    .from('historias')
    .insert({
      titulo,
      descricao,
      user_id: userId
    })
    .select('id')
    .single()

  if (errH) {
    console.error('Erro ao criar história:', errH)
    return
  }

  // 2) Cria cartão
  const { error: errC } = await supabase
    .from('cartoes')
    .insert({
      historia_id: historia.id,
      sinopse_cartao: descricao.slice(0, 100),
      titulo_cartao: titulo,
      autor_cartao: autor || 'Desconhecido'
    })

  if (errC) {
    console.error('Erro ao criar cartão:', errC)
    return
  }

  // 3) Associa categoria
  if (categoriaId) {
    const { error: errHC } = await supabase
      .from('historia_categorias')
      .insert({
        historia_id: historia.id,
        categoria_id: categoriaId,
        user_id: userId
      })
    if (errHC) console.error('Erro ao associar categoria:', errHC)
  }

  form.reset()
  await mostrarHistorias()
}

/************************************************************
 * [G] EXIBIR HISTÓRIA NO CONTEINER
 ************************************************************/
async function exibirHistoria(cartaoId) {
  const { data, error } = await supabase
    .from('cartoes')
    .select(`
      *,
      historias (
        descricao,
        titulo
      )
    `)
    .eq('id', cartaoId)
    .single()

  if (error) {
    console.error('Erro ao carregar história:', error)
    return
  }

  currentStoryId = data.historia_id
  const textoBruto = data.historias.descricao || '(Sem descrição)'
  textoCompleto = formatarTexto(textoBruto)

  document.getElementById('historia-titulo').textContent = data.titulo_cartao
  const container = document.getElementById('historia-conteudo')
  container.innerText = textoCompleto
  container.setAttribute('data-full-text', textoCompleto)

  // resetar modo de leitura
  modoCorrido = true
  partesHistoria = []
  parteAtual = 0
}

/************************************************************
 * [H] EXCLUIR HISTÓRIA (cascata via FK)
 ************************************************************/
async function excluirHistoria(cartaoId) {
  if (!confirm('Deseja realmente excluir esta história?')) return

  // obtém historia_id
  const { data: cartao, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id')
    .eq('id', cartaoId)
    .single()

  if (errC) {
    console.error(errC)
    return
  }

  // deleta historia (cascade em cartoes e associações)
  const { error: errH } = await supabase
    .from('historias')
    .delete()
    .eq('id', cartao.historia_id)

  if (errH) {
    console.error('Erro ao excluir história:', errH)
    return
  }

  await mostrarHistorias()
}

/************************************************************
 * [I] FORMATAÇÃO: a cada 5 pontos finais, insere \n\n
 ************************************************************/
function formatarTexto(str) {
  let contador = 0
  let resultado = ''
  for (let ch of str) {
    resultado += ch
    if (ch === '.') {
      contador++
      if (contador === 5) {
        resultado += '\n\n'
        contador = 0
      }
    }
  }
  return resultado
}

/************************************************************
 * [J] MODO DE LEITURA (paginado x corrido)
 ************************************************************/
function toggleReadingMode() {
  const container = document.getElementById('historia-conteudo')
  const btnVoltar = document.getElementById('btn-voltar')
  const btnContinuar = document.getElementById('btn-continuar')

  if (modoCorrido) {
    const lines = textoCompleto.split(/\r?\n/)
    const linesPerPage = 5
    partesHistoria = []
    for (let i = 0; i < lines.length; i += linesPerPage) {
      partesHistoria.push(lines.slice(i, i + linesPerPage).join('\n'))
    }
    parteAtual = 0
    exibirParteAtual()
    btnVoltar.style.display = partesHistoria.length > 1 ? 'inline-block' : 'none'
    btnContinuar.style.display = partesHistoria.length > 1 ? 'inline-block' : 'none'
    modoCorrido = false
  } else {
    container.innerText = textoCompleto
    btnVoltar.style.display = 'none'
    btnContinuar.style.display = 'none'
    modoCorrido = true
  }
}
function exibirParteAtual() {
  const container = document.getElementById('historia-conteudo')
  container.innerHTML = `<p>${partesHistoria[parteAtual]}</p>`
}
function voltarPagina() {
  if (parteAtual > 0) {
    parteAtual--
    exibirParteAtual()
  }
}
function continuarHistoria() {
  if (parteAtual < partesHistoria.length - 1) {
    parteAtual++
    exibirParteAtual()
  }
}
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase()
  if (['arrowleft','arrowup','a','w'].includes(k)) voltarPagina()
  if (['arrowright','arrowdown','d','s'].includes(k)) continuarHistoria()
})

/************************************************************
 * [K] MARCADOR DE LINHA
 ************************************************************/
function wrapText(str, width) {
  const ret = []
  for (let i = 0; i < str.length; i += width) {
    ret.push(str.slice(i, i + width))
  }
  return ret
}
function highlightLine(lineNumber) {
  const container = document.getElementById('historia-conteudo')
  const full = container.getAttribute('data-full-text') || container.innerText
  const lines = wrapText(full, wrapWidth)
  if (lineNumber < 1 || lineNumber > lines.length) {
    alert('Linha fora do intervalo!')
    return
  }
  lines[lineNumber - 1] = `<span style="background:yellow">${lines[lineNumber - 1]}</span>`
  container.innerHTML = lines.join('<br>')
  container.scrollTo({ top: (lineNumber-1)*lineHeightPx, behavior: 'smooth' })
}
const containerLeitura = document.getElementById('historia-conteudo')
if (containerLeitura) {
  containerLeitura.addEventListener('click', e => {
    if (!currentStoryId) return
    const rect = containerLeitura.getBoundingClientRect()
    const line = Math.floor((e.clientY - rect.top + containerLeitura.scrollTop) / lineHeightPx) + 1
    localStorage.setItem(`lineNumber_${currentStoryId}`, line)
  })
}
function continuarMarcador() {
  if (!currentStoryId) return alert('Nenhuma linha salva para esta história.')
  const saved = localStorage.getItem(`lineNumber_${currentStoryId}`)
  if (!saved) return alert('Nenhuma linha salva para esta história.')
  highlightLine(parseInt(saved, 10))
}

/************************************************************
 * [L] PESQUISA
 ************************************************************/
async function filtrarHistorias(query) {
  const { data: resultados, error } = await supabase
    .from('cartoes')
    .select('id, titulo_cartao, autor_cartao')
    .or(`titulo_cartao.ilike.%${query}%,autor_cartao.ilike.%${query}%`)

  if (error) {
    console.error('Erro na pesquisa:', error)
    return []
  }
  return resultados
}
function exibirSugestoes(lista) {
  const sr = document.getElementById('searchResults')
  if (!sr) return
  if (!lista.length) {
    sr.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`
    sr.style.display = 'block'
    return
  }
  sr.innerHTML = lista.map(story => `
    <div class="suggestion-item" data-id="${story.id}" style="padding:6px; border-bottom:1px solid #ccc; cursor:pointer;">
      <strong>${story.titulo_cartao}</strong><br>
      <em>Autor: ${story.autor_cartao}</em>
    </div>
  `).join('')
  sr.style.display = 'block'
  sr.querySelectorAll('.suggestion-item').forEach(item => {
    item.onclick = () => {
      const id = item.dataset.id
      exibirHistoria(id)
      sr.style.display = 'none'
    }
  })
}

/************************************************************
 * [M] INICIALIZAÇÃO
 ************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  carregarCategorias()
  mostrarHistorias()

  const form = document.getElementById('formPrincipal')
  form?.addEventListener('submit', async e => {
    e.preventDefault()
    const titulo   = document.getElementById('titulo').value.trim()
    const descricao= document.getElementById('descricao').value.trim()
    const autor    = document.getElementById('autor').value.trim()
    const categoriaId = parseInt(document.getElementById('categoria').value, 10)
    if (!titulo || !descricao) return alert('Preencha título e descrição!')
    await salvarHistoria(titulo, descricao, autor, categoriaId)
  })

  const searchBar = document.getElementById('searchBar')
  const searchBtn = document.getElementById('searchBtn')
  const searchResults = document.getElementById('searchResults')
  searchBtn?.addEventListener('click', async () => {
    const q = searchBar.value.trim()
    if (!q) return searchResults.style.display = 'none'
    exibirSugestoes(await filtrarHistorias(q))
  })
  searchBar?.addEventListener('input', async () => {
    const q = searchBar.value.trim()
    if (!q) return searchResults.style.display = 'none'
    exibirSugestoes(await filtrarHistorias(q))
  })
  searchBar?.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      exibirSugestoes(await filtrarHistorias(searchBar.value.trim()))
    }
  })

  document.getElementById('btn-voltar')?.addEventListener('click', voltarPagina)
  document.getElementById('btn-continuar')?.addEventListener('click', continuarHistoria)
  document.getElementById('toggleMode')?.addEventListener('click', toggleReadingMode)
  document.getElementById('btnMarcador')?.addEventListener('click', continuarMarcador)
})
