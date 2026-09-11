#!/bin/bash

# Script de deploy executado localmente na Oracle VPS

echo "Parando containers antigos (se houver)..."
docker-compose down

echo "Iniciando build e recriando ambiente em background..."
# O --build força a recriação da imagem do Node.js com as alterações mais recentes
docker-compose up -d --build

echo "Limpeza de imagens órfãs (para poupar disco do servidor)..."
docker image prune -f

echo "Deploy do Vizinhança concluído com sucesso!"
