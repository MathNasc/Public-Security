#!/bin/bash

# Script de deploy executado localmente na Oracle VPS

echo "=== Iniciando Deploy do Vizinhança ==="

# 1. Garante a existência do arquivo .env a partir do .env.example
if [ ! -f .env ]; then
  echo "[Info] .env não encontrado. Criando .env a partir de .env.example..."
  cp .env.example .env 2>/dev/null || touch .env
fi

echo "Parando containers antigos (se houver)..."
sudo docker compose down || sudo docker-compose down

echo "Iniciando build e recriando ambiente em background..."
# O --build força a recriação da imagem do Node.js com as alterações mais recentes
sudo docker compose up -d --build || sudo docker-compose up -d --build

echo "Limpeza de imagens órfãs (para poupar disco do servidor)..."
sudo docker image prune -f

echo "Verificando status dos containers..."
sudo docker compose ps || sudo docker-compose ps

echo "=== Deploy do Vizinhança concluído com sucesso! ==="
