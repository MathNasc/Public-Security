import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\("\/api\/geocode", geocodeLimiter, async \(req, res\) => \{.*?(?=app\.get\("\/api\/analysis")/s;

const replacement = `app.get("/api/geocode", geocodeLimiter, async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    let searchQuery = query;
    let viaCepData = null;

    // Detect if it's a Brazilian CEP (e.g., 01001-000 or 01001000)
    const cepMatch = query.match(/^\\s*(\\d{5})-?(\\d{3})\\s*$/);
    if (cepMatch) {
      const cleanCep = cepMatch[1] + cepMatch[2];
      try {
        const viaCepRes = await fetch(\`https://viacep.com.br/ws/\${cleanCep}/json/\`);
        const cepData = await viaCepRes.json();
        if (!cepData.erro) {
          viaCepData = cepData;
          // Construct a precise search query for Nominatim based on ViaCEP result
          searchQuery = \`\${cepData.logradouro || ''}, \${cepData.bairro || ''}, \${cepData.localidade || ''}, \${cepData.uf || ''}\`.replace(/^,\\s*/, '').trim();
        }
      } catch (err) {
        logger.warn("ViaCEP lookup failed", { error: err.message });
      }
    }

    const url = \`https://nominatim.openstreetmap.org/search?q=\${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=5&countrycodes=br\`;
    const response = await fetch(url, { headers: { 'User-Agent': 'VizinhancaMVP/1.0' } });
    const data = await response.json();

    const results = data.map((item: any) => ({
      formattedAddress: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      city: item.address?.city || item.address?.town || item.address?.village || (viaCepData ? viaCepData.localidade : undefined),
      state: item.address?.state || (viaCepData ? viaCepData.uf : undefined),
      cep: item.address?.postcode || (viaCepData ? viaCepData.cep : undefined)
    }));

    // If Nominatim didn't find exact coordinates but ViaCEP found the city/state, we could fallback,
    // but usually Nominatim finds it if we pass "logradouro, localidade, uf".
    // If results is empty and it was a CEP, let's try a broader search on Nominatim
    if (results.length === 0 && viaCepData) {
       const fallbackQuery = \`\${viaCepData.localidade}, \${viaCepData.uf}\`;
       const fallbackUrl = \`https://nominatim.openstreetmap.org/search?q=\${encodeURIComponent(fallbackQuery)}&format=json&addressdetails=1&limit=1&countrycodes=br\`;
       const fallbackRes = await fetch(fallbackUrl, { headers: { 'User-Agent': 'VizinhancaMVP/1.0' } });
       const fallbackData = await fallbackRes.json();
       if (fallbackData.length > 0) {
          results.push({
            formattedAddress: \`\${viaCepData.logradouro ? viaCepData.logradouro + ', ' : ''}\${viaCepData.bairro ? viaCepData.bairro + ', ' : ''}\${viaCepData.localidade} - \${viaCepData.uf}, \${viaCepData.cep}\`,
            latitude: parseFloat(fallbackData[0].lat),
            longitude: parseFloat(fallbackData[0].lon),
            city: viaCepData.localidade,
            state: viaCepData.uf,
            cep: viaCepData.cep
          });
       }
    }

    res.json(results);
  } catch (error: any) {
    logger.error("Geocoding API Error", { error: error.message });
    res.status(500).json({ error: "Geocoding failed" });
  }
});

`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
