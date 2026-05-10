# Sistema de Sincronização Híbrida (Hybrid Sync)

## 📋 Visão Geral

O sistema de sincronização híbrida combina o armazenamento local (`localStorage`) com o Supabase para garantir que seus dados sejam sempre persistidos, mesmo em cenários de conectividade intermitente.

---

## 🎯 Como Funciona

### **Fluxo de Salvamento**

1. **Salva no localStorage Imediatamente**
   - Quando você digita um item na tela "Live", ele é salvo imediatamente no `localStorage`
   - Isso garante que os dados estejam disponíveis localmente

2. **Tenta Sincronizar com o Supabase**
   - O sistema tenta enviar o item para o Supabase em segundo plano
   - Se a conexão estiver ativa, o item é sincronizado rapidamente
   - Se falhar, o item entra em uma **fila de sincronização**

3. **Sincronização da Fila**
   - Itens que falharam em sincronizar ficam em uma fila local
   - A fila é sincronizada automaticamente a cada 5 segundos (se online)
   - Quando a internet reconectar, a sincronização é retomada automaticamente

---

## 🔄 Cenários de Uso

### **Cenário 1: Conexão Estável (Ideal)**
```
Digitação → localStorage (✓) → Supabase (✓) → Sincronizado
```
- Tudo funciona normalmente
- Indicador mostra: **ONLINE** (verde)

### **Cenário 2: Conexão Intermitente**
```
Digitação → localStorage (✓) → Supabase (✗) → Fila (⏳) → Supabase (✓)
```
- Dados são salvos localmente
- Tentativas de sincronização continuam em background
- Indicador mostra: **SYNC 3** (amarelo - 3 itens na fila)

### **Cenário 3: Sem Internet (Durante a Live)**
```
Digitação → localStorage (✓) → Supabase (✗) → Fila (⏳)
```
- Dados são salvos apenas localmente
- Indicador mostra: **OFFLINE** (amarelo)
- No dia seguinte, quando conectar, tudo é sincronizado

### **Cenário 4: Acerto no Dia Seguinte Sem Internet**
```
localStorage (dados salvos) → Acesso Local (✓)
```
- Você pode acessar e fazer o acerto normalmente
- Quando reconectar, os dados são sincronizados com o Supabase

---

## 📊 Indicadores de Status

Na **Navbar** (canto superior direito), você verá dois indicadores:

### **Indicador LIVE**
- 🔴 **Pulsante**: Live ativa
- ⚫ **Inativo**: Live desligada

### **Indicador de Sincronização**
| Status | Cor | Significado |
|--------|-----|------------|
| **ONLINE** | 🟢 Verde | Conectado ao Supabase e sem itens na fila |
| **SYNC 3** | 🟡 Amarelo | Conectado mas com 3 itens aguardando sincronização |
| **OFFLINE** | 🟡 Amarelo | Sem conexão com a internet |

---

## 🔌 Sincronização Manual

### **Botão de Sincronização**
Clique no ícone ⚡ (Zap) na navbar para:
- Forçar sincronização imediata da fila
- Verificar status de itens pendentes
- Ver quantos itens foram sincronizados

### **O Que Acontece**
```
Clique em ⚡ → Sistema sincroniza fila com Supabase → Notificação de sucesso
```

---

## 💾 Dados Salvos Localmente

O sistema sincroniza automaticamente os seguintes dados:

| Tipo | Armazenamento | Sincronização |
|------|---------------|-----------------|
| **Lista de Compras** | localStorage | Automática |
| **Itens de Compra** | localStorage + Supabase | Automática |
| **Clientes** | localStorage + Supabase | Automática |
| **Pagamentos** | localStorage + Supabase | Automática |
| **Entregas** | localStorage + Supabase | Automática |
| **Config da Live** | localStorage | Automática |

---

## 🛡️ Tratamento de Erros

### **Erros Temporários** (ex: timeout, conexão perdida)
- ✓ Item fica na fila
- ✓ Sistema tenta sincronizar automaticamente
- ✓ Você recebe notificação ao reconectar

### **Erros Persistentes** (ex: validação falhou)
- ⚠️ Item é removido da fila após 3 tentativas
- 📝 Erro é registrado no console
- ✓ Você pode corrigir e reenviar manualmente

---

## 📱 Modo Offline - Passo a Passo

### **Durante a Live (Sem Internet)**

1. **Você está digitando normalmente**
   - `shoppingList` → `localStorage` ✓
   - `purchases` → `localStorage` ✓

2. **Sistema tenta sincronizar**
   - Falha → Itens entram na fila ⏳
   - Notificação: "⚠️ Modo Offline: Dados serão sincronizados quando reconectar"

3. **Indicador muda para OFFLINE**
   - Navbar mostra: **OFFLINE** 🟡

### **No Dia Seguinte (Acerto)**

1. **Sem Internet Ainda**
   - Você consegue acessar os dados do `localStorage`
   - Pode fazer o acerto normalmente
   - Tudo funciona localmente

2. **Internet Volta**
   - Sistema detecta conexão automaticamente
   - Sincroniza fila inteira com Supabase
   - Indicador muda para **ONLINE** 🟢
   - Notificação: "✓ 5 item(ns) sincronizado(s) com sucesso!"

---

## 🔧 Configuração e Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Se essas variáveis não estiverem configuradas:
- Sistema funciona apenas offline
- Dados são salvos no `localStorage`
- Sincronização com Supabase não ocorre

---

## 📊 Fila de Sincronização

### **Visualizar Fila**
A fila é armazenada no `localStorage` com a chave: `sync_queue`

### **Limite de Tentativas**
- Cada item tem **máximo 3 tentativas** de sincronização
- Após 3 falhas, o item é removido da fila
- Erro é registrado para debug

### **Tamanho Máximo**
- Sem limite teórico, mas recomendado manter < 1000 itens

---

## 🚀 Boas Práticas

### **✅ Recomendado**
- Usar o botão de sincronização manual (⚡) após reconectar
- Verificar o indicador de status regularmente
- Deixar o app aberto durante a live para sincronização contínua

### **❌ Não Recomendado**
- Sair do app e voltar várias vezes (pode interromper sincronização)
- Limpar localStorage manualmente (apaga fila de sincronização)
- Desabilitar JavaScript no navegador (quebra todo o sistema)

---

## 🔍 Monitoramento e Debug

### **Console do Navegador (F12)**
Log de sincronizações:
```javascript
// No console você verá:
// "✓ Sincronizado: purchase (ID: abc123)"
// "Sincronização: 5 sucesso, 0 falhas"
// "🟢 Conexão restaurada! Sincronizando dados..."
```

### **Verificar Fila**
```javascript
// No console, digite:
JSON.parse(localStorage.getItem('sync_queue'))
// Mostra todos os itens aguardando sincronização
```

### **Limpar Fila (Emergência)**
```javascript
// No console, digite:
localStorage.removeItem('sync_queue')
// ⚠️ Use apenas se tiver certeza!
```

---

## 📞 Troubleshooting

### **"Modo Offline: Dados serão sincronizados quando reconectar"**
- **Causa**: Sem conexão com a internet
- **Solução**: Verifique sua conexão e aguarde reconectar

### **"SYNC 5" aparece na navbar**
- **Causa**: 5 itens aguardando sincronização
- **Solução**: Clique em ⚡ para sincronizar manualmente ou aguarde 5 segundos

### **Dados não aparecem no dia seguinte**
- **Causa**: localStorage foi limpo ou Supabase não tem os dados
- **Solução**: Verifique se você estava online durante a live

### **"Máximo de tentativas atingido"**
- **Causa**: Item falhou 3 vezes em sincronizar
- **Solução**: Verificar o erro no console e tentar novamente

---

## 📈 Próximas Melhorias

- [ ] Sincronização incremental (apenas deltas)
- [ ] Compressão de fila para economizar storage
- [ ] Estatísticas de sincronização
- [ ] Backup automático em arquivo
- [ ] Sincronização de imagens (fotos de produtos)

---

## ✅ Resumo das Melhorias Implementadas

| Melhoria | Status | Benefício |
|----------|--------|-----------|
| Sincronização automática | ✅ | Dados sempre persistidos |
| Monitoramento de conexão | ✅ | Detecta quando conecta/desconecta |
| Fila de sincronização | ✅ | Não perde dados offline |
| Indicador visual | ✅ | Você sabe o status em tempo real |
| Sincronização manual | ✅ | Controle total quando precisar |
| Tratamento de erros | ✅ | Recuperação automática de falhas |

---

## 📝 Notas Importantes

1. **O localStorage é apenas temporário**: Se o usuário limpar o navegador, os dados locais são perdidos
2. **Supabase é a fonte da verdade**: Sempre sincronize com Supabase quando possível
3. **Reconexão automática**: Assim que voltar online, sincroniza automaticamente
4. **Sem perda de dados**: Mesmo offline, seus dados estão salvos localmente

---

Desenvolvido com ❤️ para garantir que suas vendas na live nunca se percam!
