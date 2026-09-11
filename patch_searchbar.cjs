const fs = require('fs');
let code = fs.readFileSync('src/components/SearchBar.tsx', 'utf8');

const replacement = `const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada pelo seu navegador.");
      return;
    }
    
    // Verifica se é um contexto seguro (HTTPS ou localhost). 
    // Navegadores bloqueiam a API de geolocalização em HTTP remoto.
    if (window.isSecureContext === false) {
      alert("A localização automática foi bloqueada pelo navegador porque o site não está usando HTTPS.\\n\\nPor favor, digite o seu endereço manualmente na barra de pesquisa.");
      return;
    }
    
    setGeoLoading(true);`;

code = code.replace(/const handleLocateMe = \(\) => \{[\s\S]*?setGeoLoading\(true\);/, replacement);

// Also modify the error block to remove the generic alert and use a more informative one
const errorReplacement = `(error) => {
        setGeoLoading(false);
        console.error("Erro ao obter localização:", error.message || error);
        if (error.code === 1) { // PERMISSION_DENIED
          alert("Permissão de localização negada. Verifique as configurações do seu navegador ou digite o endereço manualmente.");
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          alert("Informação de localização indisponível no momento.");
        } else if (error.code === 3) { // TIMEOUT
          alert("O tempo limite para obter a localização esgotou.");
        } else {
          alert("Não foi possível acessar sua localização. Certifique-se de que o navegador tem permissão.");
        }
      },`;

code = code.replace(/\(error\) => \{[\s\S]*?\},/, errorReplacement);

fs.writeFileSync('src/components/SearchBar.tsx', code);
