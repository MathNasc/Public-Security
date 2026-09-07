# RUNBOOK: Security & Rate Limiting Issues

## Cenários e Resoluções

### 1. Ataque de Negação de Serviço no Geocoder (Abuso da Nominatim)
- **O que aconteceu?** Alguém disparou milhares de consultas para `/api/geocode`, resultando em Rate Limit da infraestrutura de Nominatim downstream ou estourando a fatura da Cloud.
- **Como confirmar?** Logs apontando alto volume de erro 429 retornado por nossos middlewares, ou IPs específicos gerando pico de tráfego.
- **Como mitigar?** O `rateLimiter.ts` protege esta rota (20 requisições/min/IP). Em caso de abuso distribuído (DDoS), a camada de CDN (ex: Cloudflare) ou WAF deve assumir a proteção.
- **Como recuperar?** Bloquear o Range de IPs maliciosos na porta de entrada (Nginx/WAF).
- **Como evitar recorrência?** Migrar para uma Geocoding API corporativa (ex: Google Maps API) usando tokens com quotas hard-capped de billing na GCP.

### 2. Acesso Indevido a API Administrativa
- **O que aconteceu?** Tentativas repetidas de `POST /api/admin/*` rejeitadas com erro 401.
- **Como confirmar?** Filtrar `event: admin_auth_rejected` nos Logs.
- **Como mitigar?** O `adminAuth.ts` já impede a execução sem o `ADMIN_SECRET` injetado na .env. Rodar ciclo (rotate) do Secret se houver suspeita de vazamento por logs antigos ou prints de tela de operadores.
