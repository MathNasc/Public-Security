# Guia de Deploy e Automação (Oracle Cloud Free Tier)

O projeto **Vizinhança** foi configurado para rodar em total isolamento na sua VPS usando Docker e para atualizar 100% sozinho sempre que você mandar código para o GitHub (Continuous Deployment).

## 🛡️ Prevenção de Conflitos com Outros Projetos
Para garantir que este sistema não interfira no seu outro projeto rodando na mesma VPS:
1. **Porta Diferente:** A aplicação responde pela porta **3008** (e não a 3000 padrão). 
2. **Rede Isolada:** O app e o banco operam numa rede virtual exclusiva chamada \`vizinhanca_network\`.
3. **Sem Conflito de Banco:** A porta 5432 do PostgreSQL foi escondida. O banco de dados do Vizinhança só existe na rede interna do docker e não conflita com outro banco Postgres/MySQL que esteja instalado no servidor.
4. **Volume Nomeado:** Os dados do banco são guardados em \`vizinhanca_pgdata\`, separando-os de backups genéricos.

## 🚀 Como Configurar a Automação (GitHub Actions)

A cada \`git push\` na branch \`main\`, o GitHub vai acessar seu servidor Oracle e atualizar o site sozinho.

### Passo 1: No seu Servidor Oracle
1. Clone o repositório para uma pasta:
\`\`\`bash
git clone https://github.com/SEU-USUARIO/vizinhanca.git /home/ubuntu/vizinhanca
\`\`\`

### Passo 2: No repositório do GitHub
Vá em **Settings > Secrets and variables > Actions**, e crie as seguintes variáveis (*New repository secret*):
- \`SERVER_HOST\`: O endereço IP público da sua máquina Oracle.
- \`SERVER_USER\`: Seu usuário da máquina (ex: \`ubuntu\` ou \`opc\`).
- \`SERVER_SSH_KEY\`: O conteúdo da sua chave privada SSH (o arquivo \`.pem\` ou \`id_rsa\`) usada para logar no servidor.
- \`PROJECT_PATH\`: O caminho onde você fez o clone na VPS (ex: \`/home/ubuntu/vizinhanca\`).

**Pronto!** A partir de agora, qualquer push atualizará o seu servidor automaticamente, sem dar conflitos e sem precisar derrubar nada. O comando de deploy ainda limpará imagens velhas para poupar o limite de 200GB de disco do plano Oracle Free.

## 🌐 Acesso Externo
- O seu aplicativo estará rodando na porta **3008**.
- **Importante:** Lembre-se de ir no painel da Oracle Cloud (VCN > Security Lists) e criar uma Ingress Rule liberando a porta TCP **3008**.
- Acesse via: \`http://IP_DA_SUA_MAQUINA:3008\`
