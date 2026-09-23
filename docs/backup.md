# Backup e restauração

Duas linhas de defesa:

1. **Backup do Supabase** (plano Pro): diário, com 7 dias de retenção, restaurado pelo painel.
2. **Backup próprio** (este repositório): diário, criptografado, guardado 30 dias como artefato privado do GitHub. Não depende do Supabase para ser lido.

## Como funciona o backup próprio

O workflow `.github/workflows/backup.yml` roda todo dia às 04:00 (Brasília):

1. Exporta papéis, estrutura e dados com `supabase db dump`.
2. Compacta e criptografa com [age](https://age-encryption.org) usando a sua **chave pública**.
3. Apaga os arquivos em texto claro e guarda só o arquivo `.age` como artefato do GitHub.

Sem a **chave privada**, que fica só com você, o arquivo é ilegível, inclusive para quem tiver acesso ao repositório.

## Ativar (uma vez, cerca de 10 minutos)

1. Instale o age no seu computador: `brew install age`.
2. Gere o par de chaves e guarde a chave privada em local seguro (gerenciador de senhas e uma cópia offline):

   ```bash
   age-keygen -o ~/financial-backup.key
   ```

   A linha `# public key: age1...` é a chave pública.

3. No Supabase: Project Settings > Database > Connection string > **Session pooler** (funciona em redes só IPv4, como a do GitHub). Copie a URL e troque `[YOUR-PASSWORD]` pela senha do banco.
4. No GitHub: Settings > Secrets and variables > Actions > New repository secret:
   - `SUPABASE_DB_URL`: a URL do passo 3.
   - `BACKUP_AGE_RECIPIENT`: a chave pública `age1...`.
5. Em Actions > Backup do banco > Run workflow, rode uma vez e confira se o artefato apareceu.

Enquanto os segredos não existirem, o workflow termina sem fazer nada.

A URL do banco dá acesso total aos dados. Mantenha a verificação em duas etapas ativa na sua conta do GitHub e troque a senha do banco se suspeitar de vazamento.

## Restaurar

Faça primeiro num projeto Supabase novo e vazio, nunca direto em produção.

```bash
# 1. Baixe o artefato em Actions > execução > Artifacts e descompacte o .zip
age -d -i ~/financial-backup.key -o backup.tar.gz backup-AAAAMMDDTHHMMSSZ.tar.gz.age
mkdir restore && tar -xzf backup.tar.gz -C restore

# 2. Restaure na ordem: papéis, estrutura, dados
psql "$URL_DO_PROJETO_NOVO" -f restore/roles.sql
psql "$URL_DO_PROJETO_NOVO" -f restore/schema.sql
psql "$URL_DO_PROJETO_NOVO" -c "set session_replication_role = replica" -f restore/data.sql
```

`session_replication_role = replica` desliga gatilhos durante a carga dos dados, para a auditoria e os perfis não serem gerados de novo.

Depois, aponte o `.env.local` para o projeto restaurado e rode `npm run verificar`.

## Teste de restauração

Um backup só vale se a restauração foi testada. Faça o procedimento acima a cada 3 meses e anote aqui a data e o resultado.

| Data | Backup usado | Resultado |
| ---- | ------------ | --------- |
|      |              |           |
